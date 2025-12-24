const axios = require('axios');

async function testConnection() {
    const url = 'http://13.60.16.81:3000/api/sessions?all=true';
    console.log(`Testing connection to: ${url}`);
    const key = 'azerty1234567890azerty1234567890';
    console.log(`Using Key: '${key}' (Length: ${key.length})`);

    try {
        const response = await axios.get(url, {
            headers: { 'X-Api-Key': key },
            timeout: 5000
        });
        console.log('✅ Success! Server responded:', response.status);
        console.log('Data:', JSON.stringify(response.data, null, 2));
    } catch (error) {
        console.log('❌ Connection Failed!');
        if (error.code === 'ECONNREFUSED') {
            console.log('Reason: Connection Refused. The server is not accepting connections on port 3000.');
            console.log('Check: Is Docker running? Did you map ports (-p 3000:3000)?');
        } else if (error.code === 'ETIMEDOUT') {
            console.log('Reason: Timeout. The server did not respond in time.');
            console.log('Check: AWS Security Group (Firewall). Is port 3000 open to 0.0.0.0/0?');
        } else {
            console.log('Error:', error.message);
        }
    }
}

testConnection();
