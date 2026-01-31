const axios = require('axios');

async function probe() {
    const urls = [
        'http://localhost:3001/api/sessions',
        'http://localhost:3001/api/sessions?all=true',
        'http://localhost:3001/api/default/messages',
        'http://localhost:3001/api/messages',
        'http://localhost:3001/api/docs',
        'http://localhost:3001/dashboard/api/sessions'
    ];

    for (const url of urls) {
        try {
            console.log(`GET ${url}...`);
            const res = await axios.get(url, { headers: { 'X-Api-Key': 'secret' } });
            console.log(`[OK] ${url} -> Status: ${res.status}`);
            if (url.includes('sessions')) console.log('Sessions:', JSON.stringify(res.data, null, 2));
        } catch (e) {
            console.log(`[ERR] ${url} -> ${e.message} (${e.response?.status})`);
        }
    }
}

probe();
