
import axios from 'axios';
import * as dotenv from 'dotenv';
dotenv.config();

async function testVenice() {
    console.log('\n--- Testing Venice.ai ---');
    const apiKey = process.env.VENICE_API_TOKEN;
    if (!apiKey) {
        console.log('❌ VENICE_API_TOKEN is missing in .env');
        return;
    }
    console.log(`Key found: ${apiKey.substring(0, 5)}...`);

    try {
        const response = await axios.post('https://api.venice.ai/api/v1/chat/completions', {
            model: "llama-3.3-70b",
            messages: [{ role: "user", content: "Hello" }],
            max_tokens: 10
        }, {
            headers: { Authorization: `Bearer ${apiKey}` }
        });
        console.log('✅ Venice Success:', response.status);
    } catch (error: any) {
        console.log('❌ Venice Failed:', error.response?.status, error.response?.data || error.message);
    }
}

async function testOpenRouter() {
    console.log('\n--- Testing OpenRouter ---');
    const apiKey = process.env.OPENROUTER_API_KEY;
    if (!apiKey) {
        console.log('❌ OPENROUTER_API_KEY is missing in .env');
        return;
    }
    console.log(`Key found: ${apiKey.substring(0, 5)}...`);

    try {
        const response = await axios.post('https://openrouter.ai/api/v1/chat/completions', {
            model: "openai/gpt-3.5-turbo",
            messages: [{ role: "user", content: "Hello" }],
            max_tokens: 10
        }, {
            headers: {
                Authorization: `Bearer ${apiKey}`,
                'HTTP-Referer': 'https://github.com/MartialAndCo/peds',
            }
        });
        console.log('✅ OpenRouter Success:', response.status);
    } catch (error: any) {
        console.log('❌ OpenRouter Failed:', error.response?.status, error.response?.data || error.message);
    }
}

async function main() {
    await testVenice();
    await testOpenRouter();
}

main();
