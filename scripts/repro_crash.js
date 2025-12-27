const axios = require('axios');

const WEBHOOK_URL = 'http://localhost:3000/api/webhooks/whatsapp';
const PHONE = '33999999999'; // Use same phone as simulation to reuse context? Or new one?
// Use new one to avoid context mix
const ID = `33888888888@c.us`;

async function main() {
    console.log(`🧪 reproducing crash with "Send a pic"...`);
    try {
        const res = await axios.post(WEBHOOK_URL, {
            event: 'message',
            payload: {
                id: `crash_test_${Date.now()}`,
                from: ID,
                body: "Working unfortunately. Send a pic?",
                fromMe: false,
                _data: { notifyName: "CrashTestUser" },
                type: 'chat',
                timestamp: Math.floor(Date.now() / 1000)
            }
        });
        console.log(`Response: ${res.status}`);
    } catch (e) {
        console.error(`Webhook Failed: ${e.message}`);
        if (e.response) {
            console.error('Status:', e.response.status);
            console.error('Data:', JSON.stringify(e.response.data, null, 2));
        }
    }
}

main();
