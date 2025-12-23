const axios = require('axios');

async function checkMessage() {
    const session = 'default';
    const chatId = '33695472237@c.us';
    const messageId = 'false_33695472237@c.us_2A80C296B6907E7D85BC';

    // Construct URL for chats controller
    // Route: /api/{session}/chats/{chatId}/messages/{messageId}
    // Encode components
    const encodedChatId = encodeURIComponent(chatId);
    const encodedMsgId = encodeURIComponent(messageId);

    // Testing encoded and unencoded to be sure
    const urls = [
        `http://localhost:3001/api/${session}/chats/${chatId}/messages/${messageId}`,
        `http://localhost:3001/api/${session}/chats/${encodedChatId}/messages/${encodedMsgId}`
    ];

    for (const url of urls) {
        try {
            console.log(`Checking ${url}...`);
            const res = await axios.get(url, { headers: { 'X-Api-Key': 'secret' } });
            console.log(`[SUCCESS] Message Data:`, JSON.stringify(res.data, null, 2));
        } catch (e) {
            console.log(`[FAILED] ${url} -> ${e.message} (Status: ${e.response?.status})`);
        }
    }
}

checkMessage();
