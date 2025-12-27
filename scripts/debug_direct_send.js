const axios = require('axios');

async function test() {
    console.log("Calling WhatsApp Service directly...");
    try {
        const res = await axios.post('http://localhost:3001/api/sendText', {
            chatId: '33999999999@c.us',
            text: "Direct Test Message"
        }, {
            headers: { 'x-api-key': 'secret' }
        });
        console.log("Success:", res.data);
    } catch (e) {
        console.error("Failed:", e.message);
        if (e.response) {
            console.error("Status:", e.response.status);
            console.error("Data:", JSON.stringify(e.response.data, null, 2));
        }
    }
}
test();
