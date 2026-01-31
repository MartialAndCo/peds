
import axios from 'axios';
import * as dotenv from 'dotenv';
dotenv.config();

async function testVisionDirect() {
    console.log('--- Testing Vision with Direct API Call ---\n');

    const apiKey = process.env.OPENROUTER_API_KEY;
    if (!apiKey) {
        console.error('❌ OPENROUTER_API_KEY not found');
        return;
    }
    console.log(`✅ API Key: ${apiKey.substring(0, 15)}...`);

    // Simple test image (1x1 red pixel PNG)
    const testImageBase64 = "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==";
    const dataUrl = `data:image/png;base64,${testImageBase64}`;

    // Try different models
    const models = [
        "cognitivecomputations/dolphin-vision-72b",
        "meta-llama/llama-3.2-11b-vision-instruct:free",
        "qwen/qwen-2.5-vl-72b-instruct:free"
    ];

    for (const model of models) {
        console.log(`\n🔍 Testing: ${model}`);

        try {
            const response = await axios.post('https://openrouter.ai/api/v1/chat/completions', {
                model: model,
                messages: [
                    {
                        role: "user",
                        content: [
                            { type: "text", text: "What color is this image?" },
                            { type: "image_url", image_url: { url: dataUrl } }
                        ]
                    }
                ],
                max_tokens: 100
            }, {
                headers: {
                    'Authorization': `Bearer ${apiKey}`,
                    'Content-Type': 'application/json',
                    'HTTP-Referer': 'https://github.com/MartialAndCo/peds'
                },
                timeout: 30000
            });

            const content = response.data.choices[0]?.message?.content;
            console.log(`✅ Success! Response: ${content}`);

        } catch (error: any) {
            console.log(`❌ Failed: ${error.response?.status} - ${JSON.stringify(error.response?.data || error.message).substring(0, 200)}`);
        }
    }
}

testVisionDirect();
