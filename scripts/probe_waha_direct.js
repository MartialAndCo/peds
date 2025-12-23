const axios = require('axios');

async function checkMessage() {
    const rawId = 'false_33695472237@c.us_2A80C296B6907E7D85BC';
    // const strippedId = rawId.split('_').slice(1).join('_'); // 336...@c.us_...
    // Actually standard ID is false_remoteJid_id.
    // Let's keep it but encode it.

    const encodedId = encodeURIComponent(rawId);

    // IDs to test
    const ids = [rawId, encodedId];

    // Endpoints to test (Query Param style)
    const base = 'http://localhost:3001/api/messages';

    for (const id of ids) {
        const url = `${base}/${id}/media?session=default`;
        try {
            console.log(`Checking ${url}...`);
            const res = await axios.get(url, {
                headers: { 'X-Api-Key': 'secret' },
                responseType: 'arraybuffer'
            });
            console.log(`[SUCCESS] ${url} -> Type: ${res.headers['content-type']}, Size: ${res.data.length}`);
        } catch (e) {
            console.log(`[FAILED] ${url} -> ${e.message} (Status: ${e.response?.status})`);
        }
    }
}

checkMessage();
