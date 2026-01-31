const axios = require('axios');

async function listMessages() {
    // List last 10 messages from 'default' session to see format
    const url = `http://localhost:3001/api/default/messages?limit=10`;
    try {
        console.log(`Checking ${url}...`);
        const res = await axios.get(url, { headers: { 'X-Api-Key': 'secret' } });
        console.log("Success! Messages found:");
        res.data.forEach(m => {
            console.log(`ID: ${m.id} | HasMedia: ${m.hasMedia}`);
        });
    } catch (e) {
        console.log(`[FAILED] ${url} -> ${e.message} (Status: ${e.response?.status})`);
        console.log("Response data:", e.response?.data);
    }
}

listMessages();
