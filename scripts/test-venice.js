
const axios = require('axios');
const dotenv = require('dotenv');
dotenv.config();

const API_KEY = process.env.VENICE_API_KEY;
const MODEL = process.env.VENICE_MODEL || 'venice-uncensored';

console.log(`Testing Venice API with Model: ${MODEL}`);
console.log(`API Key present: ${!!API_KEY}`);

async function testVenice() {
    try {
        const response = await axios.post('https://api.venice.ai/api/v1/chat/completions', {
            model: MODEL,
            messages: [
                { role: 'system', content: 'You are a test bot.' },
                { role: 'user', content: 'Hello, are you working?' }
            ],
            max_tokens: 10
        }, {
            headers: {
                'Authorization': `Bearer ${API_KEY}`,
                'Content-Type': 'application/json'
            }
        });

        console.log('✅ Success:', response.data.choices[0].message.content);
    } catch (error) {
        console.error('❌ Error:', error.response ? error.response.data : error.message);
        if (error.response && error.response.status === 402) {
            console.error('⚠️ PAYMENT REQUIRED (402). Check Balance/USD Limit/Diem Quota.');
        }
    }
}

testVenice();
