const axios = require('axios');

async function debugPut() {
    const session = 'default';
    const baseUrl = 'http://13.60.16.81:3000';
    const apiKey = 'azerty1234567890azerty1234567890';
    const headers = { 'X-Api-Key': apiKey, 'Content-Type': 'application/json' };

    console.log(`[DEBUG] Testing PUT for session: ${session}`);

    const webhookUrl = 'http://localhost:3005/api/webhooks/waha';
    const sessionConfig = {
        proxy: null,
        debug: false,
        webhooks: [
            {
                url: webhookUrl,
                events: ['message', 'message.any', 'state.change']
            }
        ]
    };

    // 1. Send PUT
    try {
        console.log(`[ACTION] Sending PUT to update/restart session...`);
        // Matches app/api/session/start/route.ts logic
        const updateRes = await axios.put(`${baseUrl}/api/sessions/${session}`, {
            config: sessionConfig
        }, { headers });
        console.log(`[PUT] Response: ${updateRes.status}`);

        console.log(`[ACTION] Sending POST start...`);
        await axios.post(`${baseUrl}/api/sessions/${session}/start`, {}, { headers });
        console.log(`[START] Signal sent.`);
    } catch (e) {
        console.log(`[PUT/START] Failed: ${e.message}`);
        if (e.response) console.log(`[ERROR] Data:`, e.response.data);
    }

    // 2. Poll Status
    let count = 0;
    const interval = setInterval(async () => {
        count++;
        if (count > 20) {
            clearInterval(interval);
            console.log("[DONE] Monitoring finished.");
            return;
        }

        try {
            const res = await axios.get(`${baseUrl}/api/sessions/${session}`, { headers });
            console.log(`[POLL #${count}] Status: ${res.data.status}`);
            if (res.data.status === 'STOPPED' || res.data.status === 'FAILED') {
                console.log(`[CRASH DETECTED] Details:`, JSON.stringify(res.data, null, 2));
            }
        } catch (e) {
            console.log(`[POLL #${count}] Error: ${e.message}`);
        }
    }, 500);
}

debugPut();
