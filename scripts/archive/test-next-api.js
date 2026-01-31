const axios = require('axios');

async function main() {
    console.log('Testing Next.js API /api/waha/start...');
    try {
        const res = await axios.post('http://localhost:3000/api/session/start');
        console.log('Success:', res.data);
    } catch (e) {
        console.error('Failed:', e.message);
        if (e.response) {
            console.error('Status:', e.response.status);
            console.error('Data:', JSON.stringify(e.response.data, null, 2));
        }
    }
}

main();
