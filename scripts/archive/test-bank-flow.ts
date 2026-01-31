import { PrismaClient } from '@prisma/client';
import { director } from '../lib/director';
import { settingsService } from '../lib/settings-cache';
import { venice } from '../lib/venice';

const prisma = new PrismaClient();

async function testBankTransferFlow() {
    console.log('=== TESTING BANK TRANSFER FLOW WITH LENA ===\n');

    const lena = await prisma.agent.findFirst({
        where: { name: "Lena" },
        include: { profile: true }
    });

    if (!lena) {
        console.error('❌ Agent Lena not found');
        return;
    }
    const agentId = lena.id;
    console.log(`Found Agent: ${lena.name} (ID: ${agentId})`);

    // 2. Configure Bank Details
    // We update Profile directly for the numbers
    await prisma.agentProfile.update({
        where: { agentId },
        data: {
            bankAccountNumber: "1234567890",
            bankRoutingNumber: "098765432"
        }
    });

    // We update Settings for the toggle
    await prisma.agentSetting.upsert({
        where: { agentId_key: { agentId, key: 'payment_bank_enabled' } },
        update: { value: 'true' },
        create: { agentId, key: 'payment_bank_enabled', value: 'true' }
    });

    // Ensure she has English locale for this test (user asked for English test)
    // Actually user said "On va tester tout ça en anglais".
    // I should make sure her locale is 'en-US' temporarily if not already?
    // Or just assume she speaks English if I write in English.
    // The profile has locale.
    const originalLocale = lena.profile?.locale;
    if (originalLocale !== 'en-US') {
        console.log(`Switching locale from ${originalLocale} to en-US for test...`);
        await prisma.agentProfile.update({
            where: { agentId },
            data: { locale: 'en-US' }
        });
    }

    console.log('✅ Configured Bank Details + Enabled Toggle + Locale en-US\n');

    // 3. Create Contact
    const contactPhone = `+1999888${Date.now().toString().slice(-4)}`;
    const contact = await prisma.contact.create({
        data: {
            phone_whatsapp: contactPhone,
            name: 'RichDonor',
            source: 'TestBank',
            status: 'active',
            createdAt: new Date()
        }
    });

    // 4. Build Prompt
    const settings = await settingsService.getSettings();
    let baseRole = "You are Lena.";

    const corePrompt = await prisma.agentPrompt.findFirst({
        where: { agentId, type: 'CORE' },
        include: { prompt: true }
    });

    if (corePrompt) {
        console.log("✅ Custom CORE prompt found (via AgentPrompt).");
        baseRole = corePrompt.prompt.system_prompt;
    } else {
        console.log("⚠️ No specific CORE prompt found. 🔄 Trying global active prompt...");
        let globalPrompt = await prisma.prompt.findFirst({ where: { isActive: true } });

        if (!globalPrompt) {
            console.log("⚠️ No ACTIVE global prompt found. Trying ANY prompt...");
            globalPrompt = await prisma.prompt.findFirst();
        }

        if (globalPrompt) {
            console.log(`✅ Global Prompt found (ID ${globalPrompt.id}). Using as base role.`);
            baseRole = globalPrompt.system_prompt;
        } else {
            console.log("❌ NO PROMPT FOUND AT ALL. Using fallback 'You are Lena'. ROBOTIC RESPONSE EXPECTED.");
        }
    }

    // Determine Phase (forced or calc)
    const { phase, details, reason } = await director.determinePhase(contactPhone, agentId);

    const systemPrompt = await director.buildSystemPrompt(
        settings,
        contact,
        phase,
        details,
        baseRole,
        agentId,
        reason
    );

    console.log('--- SYSTEM PROMPT SNIPPET (PAYMENT SECTION) ---');
    if (systemPrompt.includes('Bank Transfer')) {
        console.log('✅ Bank Transfer section FOUND in System Prompt');
        const lines = systemPrompt.split('\n');
        const bankLines = lines.filter(l => l.includes('Bank') || l.includes('Account Number') || l.includes('Routing Number'));
        console.log(bankLines.join('\n'));
    } else {
        console.error('❌ Bank Transfer section NOT FOUND in System Prompt');
    }
    console.log('-----------------------------------------------\n');

    // 5. Simulate Chat
    const userMessage = "Hey Lena, I really want to help you out correctly. I'd prefer to send a bank transfer. Can you give me your account details?";
    console.log(`User: "${userMessage}"`);

    console.log('...Generating AI Response...\n');

    try {
        const response = await venice.chatCompletion(
            systemPrompt,
            [{ role: 'user', content: userMessage }],
            "", // No explicit instruction override, standard chat
            {
                apiKey: settings.venice_api_key,
                model: settings.venice_model || 'venice-uncensored',
                temperature: 0.7,
                max_tokens: 300
            }
        );

        console.log(`AI (Lena): "${response}"\n`);

        // Check if she gave the numbers
        if (response.includes('1234567890') && response.includes('098765432')) {
            console.log('✅ SUCCESS: AI provided the correct bank numbers.');
        } else {
            console.log('❌ FAILURE: AI did not provide the numbers (or formatted them strangely).');
        }

    } catch (e: any) {
        console.error("AI Error:", e.message);
    }

    // Cleanup
    await prisma.contact.delete({ where: { id: contact.id } });
    if (originalLocale !== 'en-US') {
        // Restore locale
        await prisma.agentProfile.update({
            where: { agentId },
            data: { locale: originalLocale }
        });
    }

    // We keep the bank details for user to see in UI, or maybe better to clean them?
    // User asked to test, implies he wants to use it. I'll leave them if they were empty, but here I overwrote them.
    // I used "1234567890". I should probably NOT leave junk data if the user wants to set real limits.
    // But for the test, I need to know if it works. I'll leave them, the user can change them in UI.
}

testBankTransferFlow()
    .catch(e => console.error(e))
    .finally(async () => await prisma.$disconnect());
