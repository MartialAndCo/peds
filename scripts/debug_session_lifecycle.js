const axios = require('axios');

async function debugSession() {
    const session = 'default';
    const baseUrl = 'http://localhost:3001';
    const apiKey = 'secret';
    const headers = { 'X-Api-Key': apiKey, 'Content-Type': 'application/json' };

    console.log(`[DEBUG] Starting debugging for session: ${session}`);

    // 1. Get Status
    try {
        const res = await axios.get(`${baseUrl}/api/sessions/${session}`, { headers });
        console.log(`[INITIAL] Status: ${res.data.status}`);
    } catch (e) {
        console.log(`[INITIAL] Session might not exist or error: ${e.message}`);
    }

    // 2. Start Session
    try {
        console.log(`[ACTION] Starting session...`);
        const startRes = await axios.post(`${baseUrl}/api/sessions`, {
            name: session,
            config: {
                proxy: null,
                debug: true,
                webhooks: [
                    {
                        url: "http://localhost:3005/api/webhooks/waha",
                        events: ["message", "message.any", "state.change"]
                    }
                ]
            }
        }, { headers });
        console.log(`[START] Response: ${startRes.status} - ${JSON.stringify(startRes.data)}`);
    } catch (e) {
        console.log(`[START] Failed: ${e.message}`);
        if (e.response && e.response.status === 422) {
            console.log(`[START] Session exists, trying to restart...`);
            await axios.post(`${baseUrl}/api/sessions/${session}/restart`, {}, { headers });
        }
    }

    // 3. Poll Status
    let count = 0;
    const interval = setInterval(async () => {
        count++;
        if (count > 20) { // monitor for 10 seconds
            clearInterval(interval);
            console.log("[DONE] Monitoring finished.");
            return;
        }

        try {
            const res = await axios.get(`${baseUrl}/api/sessions/${session}`, { headers });
            console.log(`[POLL #${count}] Status: ${res.data.status}`);
            if (res.data.status === 'STOPPED' || res.data.status === 'FAILED') {
                console.log(`[CRASH DETECTED] Details:`, JSON.stringify(res.data, null, 2));
                // clearInterval(interval); 
            }
        } catch (e) {
            console.log(`[POLL #${count}] Error: ${e.message}`);
        }
    }, 500);
}

debugSession();
