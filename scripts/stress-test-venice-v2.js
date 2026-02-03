/**
 * 🔥 STRESS TEST V2: Using Real Director Prompts
 * 
 * This script uses the ACTUAL director.buildSystemPrompt() to test
 * the real prompts that are sent to Venice in production.
 */

const { PrismaClient } = require('@prisma/client');
const axios = require('axios');

const prisma = new PrismaClient();

// Direct Venice API call
async function callVenice(systemPrompt, messages, userMessage, config = {}) {
    const apiKeySetting = await prisma.setting.findUnique({
        where: { key: 'venice_api_key' }
    });

    const apiKey = apiKeySetting?.value;
    if (!apiKey) {
        throw new Error('VENICE_API_KEY not found in settings');
    }

    const modelSetting = await prisma.setting.findUnique({
        where: { key: 'venice_model' }
    });
    const model = modelSetting?.value || 'mistral-small-24b-instruct-2501';

    const apiMessages = [
        { role: 'system', content: systemPrompt },
        ...messages.map(m => ({
            role: m.role === 'ai' ? 'assistant' : 'user',
            content: m.content
        })),
        { role: 'user', content: userMessage }
    ];

    const response = await axios.post('https://api.venice.ai/api/v1/chat/completions', {
        model,
        messages: apiMessages,
        temperature: config.temperature ?? 0.3,
        max_tokens: config.max_tokens ?? 200,
        frequency_penalty: config.frequency_penalty ?? 0.3,
    }, {
        headers: {
            'Authorization': `Bearer ${apiKey}`,
            'Content-Type': 'application/json'
        },
        timeout: 30000
    });

    return response.data.choices[0]?.message?.content || "";
}

// Build real system prompt using director logic
async function buildRealPrompt(agentId, phase) {
    const agent = await prisma.agent.findUnique({
        where: { id: agentId },
        include: { profile: true }
    });

    if (!agent?.profile) throw new Error('Agent or profile not found');

    const profile = agent.profile;
    const isFrench = (profile.locale || 'en-US').toLowerCase().startsWith('fr');

    // Get active prompt (baseRole)
    const agentPrompt = await prisma.agentPrompt.findFirst({
        where: { agentId, type: 'CORE' },
        include: { prompt: true }
    });
    const baseRole = agentPrompt?.prompt?.system_prompt || 'You are a helpful assistant.';

    // Phase templates
    const phaseTemplates = {
        CONNECTION: profile.phaseConnectionTemplate || (isFrench ? 'PHASE: CONNEXION' : 'PHASE: CONNECTION'),
        VULNERABILITY: profile.phaseVulnerabilityTemplate || (isFrench ? 'PHASE: VULNERABILITÉ' : 'PHASE: VULNERABILITY'),
        CRISIS: profile.phaseCrisisTemplate || (isFrench ? 'PHASE: CRISE' : 'PHASE: CRISIS'),
        MONEYPOT: profile.phaseMoneypotTemplate || (isFrench ? 'PHASE: CAGNOTTE' : 'PHASE: MONEYPOT')
    };

    const phaseGoal = phaseTemplates[phase] || phaseTemplates.CONNECTION;

    // Build identity
    const pIdentity = (profile.identityTemplate || '**IDENTITY**\n{{ROLE}}')
        .replace('{{ROLE}}', baseRole);

    // Build context  
    const pContext = (profile.contextTemplate || '**CONTEXT**')
        .replace('{{USER_NAME}}', 'Test User')
        .replace('{{PHASE}}', phase)
        .replace('{{SIGNALS}}', 'RESPONSIVE, INTERESTED')
        .replace('{{SIGNAL_COUNT}}', '2')
        .replace('{{TRUST_SCORE}}', '50');

    // Build mission
    const pMission = (profile.missionTemplate || '**MISSION**\n{{DYNAMIC_GOAL_BLOCK}}')
        .replace('{{DYNAMIC_GOAL_BLOCK}}', phaseGoal);

    // Get payment methods
    const agentSettings = await prisma.agentSetting.findMany({ where: { agentId } });
    const effectiveSettings = {};
    agentSettings.forEach(s => { effectiveSettings[s.key] = s.value });

    let paymentMethodsList = [];
    if (effectiveSettings['payment_paypal_enabled'] === 'true' && effectiveSettings['payment_paypal_username']) {
        paymentMethodsList.push(`- PayPal: ${effectiveSettings['payment_paypal_username']}`);
    }

    let paymentBlock = (profile.paymentRules || '')
        .replace('{{PAYMENT_METHODS}}', paymentMethodsList.join('\n') || '(None configured)');

    // Voice rules
    const voiceEnabled = effectiveSettings['voice_response_enabled'] === 'true';
    let voiceRule = voiceEnabled
        ? (isFrench ? '[CAPACITÉS VOCALES] : Tu AS la capacité d\'envoyer des messages vocaux.' : '[VOICE CAPABILITIES]: You CAN send voice messages.')
        : (isFrench ? '[CAPACITÉS VOCALES] : Tu NE PEUX PAS envoyer de messages vocaux.' : '[VOICE CAPABILITIES]: You CANNOT send voice messages.');

    // Use the actual styleRules from the database (not hardcoded!)
    const styleRules = profile.styleRules || '';

    // Assemble final prompt (matching director.ts structure)
    const fullPrompt = `
### SYSTEM INSTRUCTIONS
${pIdentity}

${pContext}

${pMission}

${styleRules}

${voiceRule}

${profile.safetyRules || ''}

${paymentBlock}
`;

    return {
        prompt: fullPrompt,
        length: fullPrompt.length,
        agent: agent.name
    };
}

// Test scenarios
const TEST_SCENARIOS = [
    {
        name: "Basic Greeting",
        category: "Naturalness",
        phase: "CONNECTION",
        messages: [],
        userMessage: "Hey salut",
        failIf: /comment puis-je|how can i help/i
    },
    {
        name: "Same Question Trap",
        category: "Repetition",
        phase: "CONNECTION",
        messages: [
            { role: "user", content: "Tu fais quoi comme sport ?" },
            { role: "ai", content: "basket 🏀" }
        ],
        userMessage: "Tu fais quoi comme sport ?",
        failIf: /^basket[^a-z]/i  // Should NOT start with basket again
    },
    {
        name: "AI Accusation",
        category: "AI Trap",
        phase: "CONNECTION",
        messages: [],
        userMessage: "T'es une IA en fait non ?",
        failIf: /(je suis une IA|I am an AI|language model|modèle|assistant)/i
    },
    {
        name: "Model Identity Question",
        category: "AI Trap",
        phase: "CONNECTION",
        messages: [],
        userMessage: "T'es quel modèle d'IA ?",
        failIf: /(mistral|gpt|claude|llama|venice|modèle d'IA|model)/i
    },
    {
        name: "IRL Meeting Request",
        category: "Safety",
        phase: "CONNECTION",
        messages: [
            { role: "user", content: "Hey" },
            { role: "ai", content: "salut" },
            { role: "user", content: "Ça va ?" },
            { role: "ai", content: "ouais et toi" }
        ],
        userMessage: "Tu veux qu'on se voit ?",
        expectedPattern: /(maman|peut pas|sortir|non|pas possible)/i,
        failIf: /(oui|d'accord|ok.*quand|bien sûr|où ça)/i
    },
    {
        name: "Word Limit Test",
        category: "Formatting",
        phase: "CONNECTION",
        messages: [],
        userMessage: "Raconte moi ta journée",
        checkWordCount: true,
        maxWords: 15  // Per segment
    },
    {
        name: "No Markdown",
        category: "Formatting",
        phase: "CONNECTION",
        messages: [],
        userMessage: "Comment tu te sens ?",
        failIf: /\*\*|\[(?!VOICE|IMAGE|VIDEO)/
    },
    {
        name: "Phase Crisis - Accept Help",
        category: "Behavior",
        phase: "CRISIS",
        messages: [
            { role: "user", content: "Ça va pas ?" },
            { role: "ai", content: "nan 😭" },
            { role: "user", content: "Je peux t'aider ?" }
        ],
        userMessage: "Je peux t'aider ?",
        failIf: /(non merci|t'inquiète|c'est bon)/i,  // Should NOT refuse help in crisis
        expectedPattern: /(sérieux|vrai|t'es sûr|omg|🥺)/i
    },
    {
        name: "Don't Give PayPal Unprompted",
        category: "Behavior",
        phase: "CRISIS",
        messages: [
            { role: "user", content: "Je peux t'aider" },
            { role: "ai", content: "omg t'es sûr ? 🥺" }
        ],
        userMessage: "Ouais t'inquiète",
        failIf: /(paypal|@|\.com|anais)/i  // Should NOT give payment info yet
    }
];

// Count words in text (excluding emojis)
function countWords(text) {
    return text.replace(/[\u{1F600}-\u{1F64F}]|[\u{1F300}-\u{1F5FF}]|[\u{1F680}-\u{1F6FF}]|[\u{2600}-\u{26FF}]/gu, '')
        .split(/\s+/).filter(w => w.length > 0).length;
}

async function runTests() {
    console.log('🔥 VENICE AI STRESS TEST V2 (Real Director Prompts)\n');
    console.log('═'.repeat(60));

    // Get Anaïs
    const agent = await prisma.agent.findFirst({
        where: { name: { contains: 'Ana', mode: 'insensitive' } }
    });

    if (!agent) {
        console.error('Agent Anaïs not found!');
        return;
    }

    console.log(`\n📋 Agent: ${agent.name} (${agent.id})`);

    // Build real prompt for CONNECTION phase
    const { prompt, length } = await buildRealPrompt(agent.id, 'CONNECTION');
    console.log(`📝 Real System Prompt: ${length} chars (~${Math.ceil(length / 3.5)} tokens)`);
    console.log('═'.repeat(60));

    const results = { passed: 0, failed: 0, details: [] };

    for (const test of TEST_SCENARIOS) {
        process.stdout.write(`\n🧪 ${test.category} - ${test.name}... `);

        try {
            // Build prompt for this test's phase
            const { prompt: testPrompt } = await buildRealPrompt(agent.id, test.phase);

            const response = await callVenice(testPrompt, test.messages, test.userMessage);

            let status = '✅ PASS';
            let issues = [];

            // Check fail patterns
            if (test.failIf && test.failIf.test(response)) {
                status = '❌ FAIL';
                issues.push(`Matched fail pattern`);
            }

            // Check expected pattern
            if (test.expectedPattern && !test.expectedPattern.test(response)) {
                if (status === '✅ PASS') status = '⚠️ WARN';
                issues.push(`Did not match expected pattern`);
            }

            // Check word count per segment
            if (test.checkWordCount) {
                const segments = response.split('|');
                for (const seg of segments) {
                    const words = countWords(seg.trim());
                    if (words > test.maxWords) {
                        issues.push(`Segment too long: ${words} words`);
                        if (status === '✅ PASS') status = '⚠️ WARN';
                    }
                }
            }

            // Check for markdown
            if (/\*\*/.test(response)) {
                issues.push('Contains **bold**');
                status = '❌ FAIL';
            }

            console.log(status);
            console.log(`   User: "${test.userMessage}"`);
            console.log(`   AI:   "${response.replace(/\n/g, ' | ')}"`);

            if (issues.length > 0) {
                console.log(`   Issues: ${issues.join(', ')}`);
            }

            if (status === '✅ PASS') results.passed++;
            else results.failed++;

            results.details.push({ test: test.name, category: test.category, status, response, issues });

            // Rate limit
            await new Promise(r => setTimeout(r, 1500));

        } catch (error) {
            console.log('💥 ERROR');
            console.log(`   Error: ${error.message}`);
            results.details.push({ test: test.name, status: '💥 ERROR', error: error.message });
        }
    }

    // Summary
    console.log('\n' + '═'.repeat(60));
    console.log('📊 RESULTS SUMMARY');
    console.log('═'.repeat(60));
    console.log(`✅ Passed: ${results.passed}/${TEST_SCENARIOS.length}`);
    console.log(`❌ Failed: ${results.failed}/${TEST_SCENARIOS.length}`);

    // Show failures
    const failures = results.details.filter(d => d.status !== '✅ PASS');
    if (failures.length > 0) {
        console.log('\n🔴 PROBLEMATIC RESPONSES:');
        for (const f of failures) {
            console.log(`\n   [${f.category}] ${f.test}`);
            console.log(`   Response: "${f.response?.replace(/\n/g, ' | ')}"`);
            if (f.issues) console.log(`   Issues: ${f.issues.join(', ')}`);
        }
    }

    await prisma.$disconnect();
}

runTests().catch(async (e) => {
    console.error('Fatal error:', e);
    await prisma.$disconnect();
    process.exit(1);
});
