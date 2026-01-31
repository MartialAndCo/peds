
import axios from 'axios';
import * as dotenv from 'dotenv';
dotenv.config();

async function testQwenVision() {
    console.log('=== Testing Qwen2.5-VL-72B Vision ===\n');

    const apiKey = process.env.OPENROUTER_API_KEY;
    if (!apiKey) {
        console.error('❌ OPENROUTER_API_KEY not found');
        return;
    }
    console.log(`✅ API Key: ${apiKey.substring(0, 15)}...`);

    // Test image: a simple colored square (red)
    const testImageBase64 = "iVBORw0KGgoAAAANSUhEUgAAABAAAAAQCAYAAAAf8/9hAAAAHklEQVQ4jWNgGAWjYBSMAAbK/f//nxHdAIahAAABLwAH/+nW4AAAAABJRU5ErkJggg==";
    const dataUrl = `data:image/png;base64,${testImageBase64}`;

    const VISION_MODEL = "qwen/qwen-2.5-vl-72b-instruct";

    console.log(`\n🔍 Testing: ${VISION_MODEL}`);
    console.log('📡 Sending request...\n');

    try {
        const response = await axios.post('https://openrouter.ai/api/v1/chat/completions', {
            model: VISION_MODEL,
            messages: [
                {
                    role: "system",
                    content: "You are an image recognition assistant. Describe what you see objectively."
                },
                {
                    role: "user",
                    content: [
                        { type: "text", text: "What color is this image? Describe it briefly." },
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
            timeout: 60000
        });

        const content = response.data.choices[0]?.message?.content;
        console.log('✅ SUCCESS!\n');
        console.log('📝 Model Response:');
        console.log('─'.repeat(40));
        console.log(content);
        console.log('─'.repeat(40));
        console.log('\n👉 Check your OpenRouter dashboard for usage.');

    } catch (error: any) {
        console.log('❌ FAILED\n');
        console.log('Status:', error.response?.status);
        console.log('Error:', JSON.stringify(error.response?.data || error.message, null, 2));
    }
}

testQwenVision();
