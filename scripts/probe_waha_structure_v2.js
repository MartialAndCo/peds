const axios = require('axios');

async function checkMessages() {
    const session = 'default';
    const baseUrl = 'http://localhost:3001';

    // 1. Try to list messages
    const listUrl = `${baseUrl}/api/messages?session=${session}&limit=5`;
    try {
        console.log(`GET ${listUrl}...`);
        const res = await axios.get(listUrl, { headers: { 'X-Api-Key': 'secret' } });
        console.log(`[SUCCESS] List Messages found ${res.data.length} items`);

        // 2. If messages found, try to get media from one that has media
        const mediaMsg = res.data.find(m => m.hasMedia);
        if (mediaMsg) {
            console.log(`Found message with media: ${mediaMsg.id}`);
            const encodedId = encodeURIComponent(mediaMsg.id);
            const mediaUrl = `${baseUrl}/api/messages/${encodedId}/media?session=${session}`;

            console.log(`GET ${mediaUrl}...`);
            try {
                const mediaRes = await axios.get(mediaUrl, {
                    headers: { 'X-Api-Key': 'secret' },
                    responseType: 'arraybuffer'
                });
                console.log(`[SUCCESS] Media Downloaded: ${mediaRes.headers['content-type']} (${mediaRes.data.length} bytes)`);
            } catch (mediaErr) {
                console.log(`[FAILED] Media Download: ${mediaErr.message} (${mediaErr.response?.status})`);
            }
        } else {
            console.log("No messages with media found in the last 5.");
        }

    } catch (e) {
        console.log(`[FAILED] List Messages: ${e.message} (${e.response?.status})`);
        console.log('Response:', e.response?.data);
    }
}

checkMessages();
