const axios = require('axios');
const mime = require('mime-types');

async function checkFile() {
    const id = 'false_33695472237@c.us_2A80C296B6907E7D85BC';
    const session = 'default';
    const endpoint = 'http://localhost:3001/api/files'; // Guessing
    const mimetype = 'audio/ogg; codecs=opus'; // From previous log

    const possibleExts = ['ogg', 'opus', 'oga', 'mp3'];

    // Also try without extension just in case? No, static server needs it.

    for (const ext of possibleExts) {
        const url = `${endpoint}/${session}/${id}.${ext}`;
        try {
            console.log(`Checking ${url}...`);
            const res = await axios.get(url, { headers: { 'X-Api-Key': 'secret' } });
            console.log(`[SUCCESS] Found file! ${url}`);
            return;
        } catch (e) {
            console.log(`[FAIL] ${url} -> ${e.message}`);
        }
    }
}

checkFile();
