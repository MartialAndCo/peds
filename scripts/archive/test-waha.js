const axios = require('axios');

const ENDPOINT = 'http://localhost:3001';
const API_KEY = 'secret';
const SESSION = 'default';

async function main() {
    console.log(`Checking WAHA at ${ENDPOINT}...`);
    try {
        // 1. Check Status with all=true
        console.log('1. Get Sessions (all=true)...');
        const resList = await axios.get(`${ENDPOINT}/api/sessions?all=true`, {
            headers: { 'X-Api-Key': API_KEY }
        });
        console.log('Sessions (all=true):', resList.data);

        // 2. Direct Get
        try {
            const resDirect = await axios.get(`${ENDPOINT}/api/sessions/${SESSION}`, {
                headers: { 'X-Api-Key': API_KEY }
            });
            console.log('Direct Get:', resDirect.data);
        } catch (e) { console.log('Direct Get Failed:', e.message) }

        // 3. Force Start
        console.log('Attempting Force START...');
        try {
            const resStart = await axios.post(`${ENDPOINT}/api/sessions/${SESSION}/start`, {}, {
                headers: { 'X-Api-Key': API_KEY }
            });
            console.log('Start Result:', resStart.data);
        } catch (e) {
            console.log('Start Failed:', e.message);
            if (e.response) console.log(e.response.data);
        }

    } catch (error) {
        console.error('ERROR:', error.message);
        if (error.response) {
            console.error('Status:', error.response.status);
            console.error('Data:', error.response.data);
        }
    }
}

main();
