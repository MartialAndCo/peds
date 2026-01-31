const axios = require('axios');

const URL = 'http://localhost:3000/api/webhooks/whatsapp';

const payload = {
    event: 'message',
    payload: {
        id: `false_debug_${Date.now()}@lid`,
        from: "33753777980@c.us",
        body: "How old are you?",
        fromMe: false,
        _data: {
            notifyName: "+33 7 53 77 79 80",
            mimetype: undefined
        },
        type: "chat",
        timestamp: 1766771714
    }
};

async function test() {
    console.log('Sending payload to:', URL);
    console.log(JSON.stringify(payload, null, 2));
    try {
        const res = await axios.post(URL, payload);
        console.log('Response Status:', res.status);
        console.log('Response Data:', res.data);
    } catch (e) {
        console.error('Error:', e.message);
        if (e.response) {
            console.error('Status:', e.response.status);
            console.error('Data:', e.response.data);
        }
    }
}

test();
