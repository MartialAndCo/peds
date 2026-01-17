
const axios = require('axios');

async function testRepetition() {
    console.log("--- STARTING REPETITION TEST ---");
    const endpoint = 'http://localhost:3000/api/webhooks/whatsapp';

    // Simulating a burst of 3 identical messages from the user (common scenario where user taps send multiple times or network lag)
    // OR simluating the AI needing to reply to 3 rapid messages without repeating itself.

    // We'll simulate 3 rapid messages: "Hello", "Hello", "Hello"
    // The expected behavior: The AI should answer the first one, and for the others either say "I just answered" or ignore/vary.
    // BUT our fix is about the AI NOT repeating ITSELF.
    // So let's send 3 DIFFERENT messages that might trigger similar responses and see if it varies.
    // Message 1: "You good?"
    // Message 2: "You okay?"
    // Message 3: "Alles gut?" (German/English logic test) -> No let's stick to "You alright?"

    const messages = [
        "You good?",
        "You okay?",
        "You alright?"
    ];

    // We need to trigger the CRON manually or rely on the queue.
    // Beause this is an integration test, we'll push to the real webhook (which queues them).
    // Then we manually trigger the CRON processor.

    const agentId = 1; // Assuming Default Agent
    const conversationId = "test_repetition_" + Date.now();

    const secret = "9f3c7a2d1b8e4a6f5c0d9e2a7b1f4c8d6e3a5b9c0f2d4a8e7b1c6d5f0";

    for (const msg of messages) {
        console.log(`Sending: "${msg}"`);
        await axios.post(endpoint, {
            object: 'whatsapp_business_account',
            entry: [{
                changes: [{
                    value: {
                        metadata: { phone_number_id: '12345' },
                        contacts: [{ wa_id: '1234567890', profile: { name: 'TestUser' } }],
                        messages: [{
                            from: '1234567890',
                            id: 'msg_' + Date.now() + Math.random(),
                            timestamp: Math.floor(Date.now() / 1000),
                            type: 'text',
                            text: { body: msg }
                        }]
                    },
                    field: 'messages'
                }]
            }]
        }, {
            headers: {
                'x-internal-secret': secret, // Correct header expected by route.ts
                'Content-Type': 'application/json'
            }
        });
        await new Promise(r => setTimeout(r, 100)); // Small network delay
    }

    console.log("Messages Queued. Now triggering CRON processing (BURST)...");

    // Trigger CRON
    try {
        const cronSecret = "e3f9a1c4d8b2f0a7c5e6d9b1a4f8c2d0e7b5a9c3f1d4b8e6a2f0c7"; // AUTH_TOKEN from .env
        const res = await axios.get(`http://localhost:3000/api/cron/process-incoming?secret=${cronSecret}`);
        console.log("CRON Result:", res.data);
    } catch (e: any) {
        console.log("CRON Trigger Error:", e.response?.data || e.message);
    }

    console.log("--- TEST COMPLETE (Check Logs for 'Burst detected' and AI responses) ---");
}

testRepetition();
