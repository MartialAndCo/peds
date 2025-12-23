const axios = require('axios');

async function checkMessage() {
    const id = 'false_33695472237@c.us_2A80C296B6907E7D85BC';
    const encodedId = encodeURIComponent(id);

    console.log("Original ID:", id);
    console.log("Encoded ID:", encodedId);

    const endpoints = [
        `http://localhost:3001/api/default/messages/${encodedId}`,
        `http://localhost:3001/api/default/messages/${encodedId}/media`
    ];

    for (const url of endpoints) {
        try {
            console.log(`Checking ${url}...`);
            const res = await axios.get(url, { headers: { 'X-Api-Key': 'secret' } });
            console.log(`[SUCCESS] ${url} -> Status: ${res.status}, Content-Type: ${res.headers['content-type']}`);
        } catch (e) {
            console.log(`[FAILED] ${url} -> ${e.message} (Status: ${e.response?.status})`);
        }
    }
}

checkMessage();
