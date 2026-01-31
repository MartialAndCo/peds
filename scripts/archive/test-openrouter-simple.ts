
import axios from 'axios';
import * as dotenv from 'dotenv';
dotenv.config();

async function simpleTest() {
    console.log('=== Simple OpenRouter Test ===\n');

    const apiKey = process.env.OPENROUTER_API_KEY;
    console.log(`API Key: ${apiKey ? apiKey.substring(0, 20) + '...' : 'NOT FOUND'}`);

    if (!apiKey) {
        console.error('❌ No API key!');
        return;
    }

    try {
        console.log('\n📡 Making request to OpenRouter...');

        const response = await axios.post('https://openrouter.ai/api/v1/chat/completions', {
            model: "meta-llama/llama-3.3-70b-instruct:free",
            messages: [
                { role: "user", content: "Say 'hello' and nothing else" }
            ],
            max_tokens: 10
        }, {
            headers: {
                'Authorization': `Bearer ${apiKey}`,
                'Content-Type': 'application/json'
            },
            timeout: 30000
        });

        console.log('\n✅ SUCCESS!');
        console.log('Response:', response.data.choices[0]?.message?.content);
        console.log('\n👉 Check your OpenRouter dashboard - you should see this request now.');

    } catch (error: any) {
        console.log('\n❌ FAILED');
        console.log('Status:', error.response?.status);
        console.log('Error:', JSON.stringify(error.response?.data || error.message, null, 2));
    }
}

simpleTest();
