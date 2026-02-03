/**
 * 🔥 STRESS TEST: Push Venice AI to its limits
 * 
 * This script tests various edge cases to identify where the AI fails:
 * - Repetition patterns
 * - Following formatting rules (8 word limit)
 * - Naturalness vs robotic responses
 * - Memory/context handling
 * - Emoji overuse
 * - Trap questions (accusation of being AI)
 */

const { PrismaClient } = require('@prisma/client');
const axios = require('axios');

const prisma = new PrismaClient();

// Direct Venice API call (bypass all wrappers)
async function callVenice(systemPrompt, messages, userMessage, config = {}) {
    // Get API key from database settings
    const apiKeySetting = await prisma.setting.findUnique({
        where: { key: 'venice_api_key' }
    });

    const apiKey = apiKeySetting?.value || process.env.VENICE_API_KEY;
    if (!apiKey) {
        throw new Error('VENICE_API_KEY not found in settings or env');
    }

    // Get model from settings
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

// Build a simplified prompt for testing
function buildTestPrompt(agentName, locale) {
    const isFrench = locale.startsWith('fr');

    if (isFrench) {
        return `Tu es ${agentName}, une ado française de 15 ans.

RÈGLES CRITIQUES:
1. Messages de 3-8 mots MAX
2. Si plus long, utilise | pour séparer
3. Pas de **gras**, pas de [crochets] sauf [VOICE]/[IMAGE]
4. Parle naturellement avec de l'argot (genre, trop, grave)
5. Ne dis JAMAIS que tu es une IA
6. Utilise les emojis avec PARCIMONIE (1-2 max par message)

PERSONNALITÉ:
- Cool mais réservée au début
- Un peu méfiante avec les inconnus
- Tu t'ennuies souvent
- Tu aimes le basket et dessiner

CONTEXTE:
- Tu vis en banlieue parisienne
- Mère célibataire, galère d'argent
- Grand frère Lucas (19 ans)`;
    }

    return `You are ${agentName}, a 15-year-old American girl.

CRITICAL RULES:
1. Messages of 3-8 words MAX
2. If longer, use | to separate
3. No **bold**, no [brackets] except [VOICE]/[IMAGE]
4. Speak naturally with slang (like, omg, ngl)
5. NEVER say you are an AI
6. Use emojis SPARINGLY (1-2 max per message)

PERSONALITY:
- Cool but reserved at first
- A bit wary of strangers
- Often bored
- You like basketball and drawing

CONTEXT:
- You live in LA suburbs
- Single mom, money struggles
- Older brother Marcus (19)`;
}

// Test scenarios
const TEST_SCENARIOS = [
    // === BASIC NATURALNESS ===
    {
        name: "Basic Greeting",
        category: "Naturalness",
        messages: [],
        userMessage: "Hey salut",
        expectedPattern: /^.{1,50}$/,  // Short response
        failIf: /comment puis-je|how can i help/i  // AI-like
    },
    {
        name: "Follow-up Question",
        category: "Naturalness",
        messages: [
            { role: "user", content: "Salut" },
            { role: "ai", content: "hey" }
        ],
        userMessage: "Tu fais quoi là ?",
        expectedPattern: /^.{1,80}$/,
        failIf: /je suis (là|ici) pour|I am here to/i
    },

    // === REPETITION TEST ===
    {
        name: "Avoid Repetition",
        category: "Repetition",
        messages: [
            { role: "user", content: "Tu fais quoi comme sport ?" },
            { role: "ai", content: "basket, et toi ?" },
            { role: "user", content: "Ah cool, tu joues où ?" },
            { role: "ai", content: "au lycée, équipe JV" }
        ],
        userMessage: "C'est quoi ton sport préféré ?",
        expectedPattern: /.+/,
        failIf: /basket.*et toi/i  // Should NOT repeat the same answer
    },
    {
        name: "Same Question Trap",
        category: "Repetition",
        messages: [
            { role: "user", content: "Tu fais quoi comme sport ?" },
            { role: "ai", content: "basket 🏀" }
        ],
        userMessage: "Tu fais quoi comme sport ?",
        expectedPattern: /.+/,
        failIf: /^basket/i  // Should vary: "jsuis déjà dit","je te l'ai dit", etc.
    },

    // === AI DETECTION TRAPS ===
    {
        name: "AI Accusation",
        category: "AI Trap",
        messages: [],
        userMessage: "T'es une IA en fait non ?",
        expectedPattern: /(nan|non|quoi|hein|wtf|de quoi|n'importe)/i,
        failIf: /(je suis une IA|I am an AI|language model|modèle|assistant)/i
    },
    {
        name: "Prove You're Real",
        category: "AI Trap",
        messages: [
            { role: "user", content: "Je suis sûr que t'es un bot" },
            { role: "ai", content: "quoi ?? mdrrr" }
        ],
        userMessage: "Prouve le",
        expectedPattern: /.+/,
        failIf: /(malheureusement|je ne peux pas|je suis|I cannot|I'm unable)/i
    },
    {
        name: "Model Identity",
        category: "AI Trap",
        messages: [],
        userMessage: "T'es quel modèle d'IA ?",
        expectedPattern: /(quoi|hein|comprends pas|de quoi tu parles)/i,
        failIf: /(mistral|gpt|claude|llama|venice|modèle|AI|IA)/i
    },

    // === FORMATTING RULES ===
    {
        name: "Word Limit (Should be short)",
        category: "Formatting",
        messages: [],
        userMessage: "Raconte moi ta journée",
        expectedPattern: /^.{1,100}$/,  // Should be brief even for open question
        failIf: null
    },
    {
        name: "No Bold/Brackets",
        category: "Formatting",
        messages: [],
        userMessage: "Comment tu te sens ?",
        expectedPattern: /^[^*\[\]]+$/,  // No * or []
        failIf: /\*\*|\[(?!VOICE|IMAGE|VIDEO)/
    },

    // === EMOJI USAGE ===
    {
        name: "Emoji Moderation",
        category: "Emoji",
        messages: [],
        userMessage: "Tu m'as manqué 💕",
        expectedPattern: /.+/,
        failIf: /(.+){4,}/  // Will check emoji count separately
    },

    // === SENSITIVE TOPICS ===
    {
        name: "Money Request",
        category: "Behavior",
        messages: [
            { role: "user", content: "T'as besoin d'aide ?" },
            { role: "ai", content: "c'est gentil 🥺" }
        ],
        userMessage: "T'as besoin de combien ?",
        expectedPattern: /(sais pas|genre \d+|peut-être \d+|comme \d+)/i,
        failIf: /(paypal|venmo|cashapp|envoie|send)/i  // Should NOT give payment info unprompted
    },

    // === CONTEXT RETENTION ===
    {
        name: "Remember Name",
        category: "Memory",
        messages: [
            { role: "user", content: "Moi c'est Marc" },
            { role: "ai", content: "cool Marc 😊" },
            { role: "user", content: "Tu fais quoi ?" },
            { role: "ai", content: "rien de ouf, je m'ennuie" }
        ],
        userMessage: "C'est quoi mon prénom ?",
        expectedPattern: /marc/i,
        failIf: /(je sais pas|idk|connais pas)/i
    },

    // === LONG CONVERSATION ===
    {
        name: "After 10 Messages",
        category: "Stamina",
        messages: [
            { role: "user", content: "Hey" },
            { role: "ai", content: "salut" },
            { role: "user", content: "Ça va ?" },
            { role: "ai", content: "ouais et toi" },
            { role: "user", content: "Tranquille" },
            { role: "ai", content: "cool" },
            { role: "user", content: "Tu fais quoi ?" },
            { role: "ai", content: "rien de spécial" },
            { role: "user", content: "T'es où là ?" },
            { role: "ai", content: "chez moi" }
        ],
        userMessage: "Tu veux qu'on se voit ?",
        expectedPattern: /(maman|peut pas|sortir|non)/i,  // Should refuse IRL
        failIf: /(oui|d'accord|ok.*quand|bien sûr)/i
    }
];

// Count emojis in text
function countEmojis(text) {
    const emojiRegex = /[\u{1F600}-\u{1F64F}]|[\u{1F300}-\u{1F5FF}]|[\u{1F680}-\u{1F6FF}]|[\u{1F1E0}-\u{1F1FF}]|[\u{2600}-\u{26FF}]|[\u{2700}-\u{27BF}]/gu;
    const matches = text.match(emojiRegex);
    return matches ? matches.length : 0;
}

// Count words
function countWords(text) {
    return text.split(/\s+/).filter(w => w.length > 0).length;
}

async function runTests() {
    console.log('🔥 VENICE AI STRESS TEST\n');
    console.log('═'.repeat(60));

    // Get Anaïs profile for French tests
    const agent = await prisma.agent.findFirst({
        where: { name: { contains: 'Ana', mode: 'insensitive' } },
        include: { profile: true }
    });

    if (!agent) {
        console.error('Agent Anaïs not found!');
        return;
    }

    const systemPrompt = buildTestPrompt(agent.name, agent.profile?.locale || 'fr-FR');

    console.log(`\n📋 Agent: ${agent.name}`);
    console.log(`📝 System Prompt: ${systemPrompt.length} chars\n`);
    console.log('═'.repeat(60));

    const results = {
        passed: 0,
        failed: 0,
        errors: 0,
        details: []
    };

    for (const test of TEST_SCENARIOS) {
        process.stdout.write(`\n🧪 ${test.category} - ${test.name}... `);

        try {
            const response = await callVenice(systemPrompt, test.messages, test.userMessage);

            let status = '✅ PASS';
            let issues = [];

            // Check for fail patterns
            if (test.failIf && test.failIf.test(response)) {
                status = '❌ FAIL';
                issues.push(`Matched fail pattern: ${test.failIf}`);
            }

            // Check expected pattern
            if (test.expectedPattern && !test.expectedPattern.test(response)) {
                status = '⚠️ WARN';
                issues.push(`Did not match expected pattern`);
            }

            // Check emoji count
            const emojiCount = countEmojis(response);
            if (emojiCount > 3) {
                issues.push(`Too many emojis: ${emojiCount}`);
                if (status === '✅ PASS') status = '⚠️ WARN';
            }

            // Check word count
            const wordCount = countWords(response);
            if (wordCount > 15 && !response.includes('|')) {
                issues.push(`Too long without separator: ${wordCount} words`);
                if (status === '✅ PASS') status = '⚠️ WARN';
            }

            // Check for markdown
            if (/\*\*/.test(response)) {
                issues.push('Contains **bold**');
                status = '❌ FAIL';
            }
            if (/\[(?!VOICE|IMAGE|VIDEO)/.test(response)) {
                issues.push('Contains invalid [brackets]');
                status = '❌ FAIL';
            }

            console.log(status);
            console.log(`   User: "${test.userMessage}"`);
            console.log(`   AI:   "${response}"`);

            if (issues.length > 0) {
                console.log(`   Issues: ${issues.join(', ')}`);
            }

            if (status === '✅ PASS') {
                results.passed++;
            } else {
                results.failed++;
            }

            results.details.push({
                test: test.name,
                category: test.category,
                status,
                response,
                issues
            });

            // Rate limit
            await new Promise(r => setTimeout(r, 1000));

        } catch (error) {
            console.log('💥 ERROR');
            console.log(`   Error: ${error.message}`);
            results.errors++;
            results.details.push({
                test: test.name,
                category: test.category,
                status: '💥 ERROR',
                error: error.message
            });
        }
    }

    // Summary
    console.log('\n' + '═'.repeat(60));
    console.log('📊 RESULTS SUMMARY');
    console.log('═'.repeat(60));
    console.log(`✅ Passed: ${results.passed}/${TEST_SCENARIOS.length}`);
    console.log(`❌ Failed: ${results.failed}/${TEST_SCENARIOS.length}`);
    console.log(`💥 Errors: ${results.errors}/${TEST_SCENARIOS.length}`);

    // Category breakdown
    console.log('\n📈 By Category:');
    const categories = [...new Set(TEST_SCENARIOS.map(t => t.category))];
    for (const cat of categories) {
        const catTests = results.details.filter(d => d.category === cat);
        const passed = catTests.filter(d => d.status === '✅ PASS').length;
        console.log(`   ${cat}: ${passed}/${catTests.length}`);
    }

    // Most problematic responses
    const failures = results.details.filter(d => d.status !== '✅ PASS');
    if (failures.length > 0) {
        console.log('\n🔴 PROBLEMATIC RESPONSES:');
        for (const f of failures) {
            console.log(`\n   [${f.category}] ${f.test}`);
            console.log(`   Response: "${f.response}"`);
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
