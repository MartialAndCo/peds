const axios = require('axios');
async function main() {
    try {
        await axios.get('http://localhost:3000/api/webhooks/whatsapp'); // Method Not Allowed is fine, just connection
        console.log('✅ Localhost is UP');
    } catch (e) {
        if (e.response) console.log(`✅ Localhost is UP (Status: ${e.response.status})`);
        else console.log(`❌ Localhost DOWN: ${e.message}`);
    }
}
main();
