const axios = require('axios');

const IP = 'http://13.60.16.81:3000';

async function probe() {
    console.log(`Probing ${IP}...`);

    // 1. Try New Service Endpoint
    try {
        console.log('Attempting GET /status (New Service)...');
        const res = await axios.get(`${IP}/status`, { timeout: 3000 });
        console.log('✅ /status responded:', res.status, res.data);
    } catch (e) {
        console.log('❌ /status failed:', e.message);
        if (e.response) console.log('   Response:', e.response.status, e.response.data);
    }

    console.log('---');

    // 2. Try Old WAHA Endpoint
    try {
        console.log('Attempting GET /api/sessions (Old WAHA)...');
        const res = await axios.get(`${IP}/api/sessions`, { timeout: 3000 });
        console.log('✅ /api/sessions responded:', res.status, res.data);
    } catch (e) {
        console.log('❌ /api/sessions failed:', e.message);
        if (e.response) console.log('   Response:', e.response.status, e.response.data);
    }
}

probe();
