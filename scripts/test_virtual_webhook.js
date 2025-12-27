const axios = require('axios');

const URL = 'https://main.die6qcz48fek8.amplifyapp.com/api/webhooks/whatsapp';
const VIRTUAL_ID = '33999999999@c.us';

async function test() {
    console.log('Sending VIRTUAL payload to:', URL);
    try {
        const res = await axios.post(URL, {
            event: 'message',
            payload: {
                id: `test_${Date.now()}`,
                from: VIRTUAL_ID,
                body: "Hello Simulation",
                fromMe: false,
                _data: { notifyName: "Thomas" },
                type: 'chat',
                timestamp: Math.floor(Date.now() / 1000)
            }
        });
        console.log('Response:', res.status, res.data);
    } catch (e) {
        console.error('Error:', e.message);
        if (e.response) console.error('Data:', e.response.data);
    }
}

test();
