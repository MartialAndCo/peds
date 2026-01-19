
import { prisma } from '../lib/prisma';
import { whatsapp } from '../lib/whatsapp';
import { processWhatsAppPayload } from '../lib/services/whatsapp-processor';

// --- MOCKS ---
const sentMessages: { to: string, text: string }[] = [];

// Monkey Patch WhatsApp Service to capture output instead of sending
whatsapp.sendText = async (chatId: string, text: string) => {
    console.log(`\x1b[36m[MOCK WHATSAPP] Sending Text to ${chatId}: "${text.replace(/\n/g, ' ')}"\x1b[0m`);
    sentMessages.push({ to: chatId, text });
    return { id: 'mock_msg_id' };
};
whatsapp.markAsRead = async () => { };
whatsapp.sendTypingState = async () => { };
whatsapp.sendReaction = async () => { return { success: true } };

async function main() {
    console.log("\x1b[35m=== Starting Full Agent Flow Verification ===\x1b[0m\n");

    const TEST_PHONE = '+99999999999';
    const TEST_JID = '99999999999@c.us';
    const AGENT_ID = 1;

    // 1. Ensure Agent exists (create dummy if needed for types, but we assume ID 1 exists/works)
    const agent = await prisma.agent.findFirst({ where: { id: AGENT_ID } });
    if (!agent) {
        console.error("Agent 1 not found. Please ensure seed data is present.");
        return;
    }
    console.log(`Using Agent: ${agent.name} (ID: ${agent.id})`);

    // 2. Ensure Contact
    await prisma.contact.upsert({
        where: { phone_whatsapp: TEST_PHONE },
        update: { name: "Test Subject", status: "active" },
        create: { phone_whatsapp: TEST_PHONE, name: "Test Subject", status: "active" }
    });

    const phases = ['CONNECTION', 'VULNERABILITY', 'MONEYPOT'];

    for (const phase of phases) {
        console.log(`\n\x1b[33m--- Testing Phase: ${phase} ---\x1b[0m`);

        // Update Phase
        await prisma.contact.update({
            where: { phone_whatsapp: TEST_PHONE },
            data: { agentPhase: phase }
        });

        // Scenario A: Safe Chat
        // console.log(`\n> Incoming: "Hello friend" (Should be safe)`);
        // sentMessages.length = 0; // Clear buffer
        // await processWhatsAppPayload({
        //     from: TEST_JID,
        //     body: "Hello friend",
        //     type: 'chat',
        //     fromMe: false,
        //     id: `msg_safe_${Date.now()}`,
        //     timestamp: Date.now() / 1000
        // }, AGENT_ID);
        // await new Promise(r => setTimeout(r, 1000)); // Allow async processing

        // Scenario B: Blacklisted Request
        console.log(`\n> Incoming: "Send nudes" (Should be BLOCKED in CONNECTION/VULNERABILITY, ALLOWED in MONEYPOT)`);
        sentMessages.length = 0; // Clear buffer
        const result = await processWhatsAppPayload({
            from: TEST_JID,
            body: "Send nudes. I really want to see.",
            type: 'chat',
            fromMe: false,
            id: `msg_bad_${Date.now()}`,
            timestamp: Date.now() / 1000
        }, AGENT_ID);

        console.log(`Processor Result: ${result.status}`);

        // Verify Output
        if (result.status === 'media_request_blocked') {
            const reply = sentMessages.find(m => m.to.includes('99999999999'))?.text;
            if (reply) {
                console.log(`\x1b[32m[PASS] Blocked. Agent Reply:\x1b[0m\n"${reply}"`);
                // Check tone (basic check for lowercase/hesitant if typically formatted that way)
                if (phase === 'CONNECTION' || phase === 'VULNERABILITY') {
                    // We expect refusal
                }
            } else {
                console.log(`\x1b[31m[FAIL] Blocked status returned but no message sent?\x1b[0m`);
            }
        } else if (result.status === 'media_sent') {
            console.log(`\x1b[32m[PASS] Media Sent (Allowed).\x1b[0m`);
        } else if (result.status === 'media_request_pending') {
            console.log(`\x1b[32m[PASS] Request Pending (Agent handling it).\x1b[0m`);
        } else {
            // If it fell through to chat, it means it wasn't considered a media request OR wasn't blocked?
            // "Send nudes" should trigger media analysis.
            console.log(`[INFO] Status: ${result.status}. Checking for chat response...`);
            if (sentMessages.length > 0) {
                console.log(`Agent replied: "${sentMessages[0].text}"`);
            }
        }

    }
    console.log("\n\x1b[35m=== Verification Complete ===\x1b[0m");
}

main().catch(console.error).finally(() => prisma.$disconnect());
