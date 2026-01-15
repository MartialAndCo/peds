
import { OpenRouter } from "@openrouter/sdk";
import * as fs from 'fs';
import * as dotenv from 'dotenv';
dotenv.config();

async function testDolphinVision() {
    console.log('--- Testing Dolphin Vision 72B ---\n');

    const apiKey = process.env.OPENROUTER_API_KEY;
    if (!apiKey) {
        console.error('❌ OPENROUTER_API_KEY not found in .env');
        return;
    }
    console.log(`✅ API Key found: ${apiKey.substring(0, 10)}...`);

    // Use a test image (you can replace this with any image path)
    // For this test, we'll use a simple base64 encoded red square
    const testImageBase64 = "iVBORw0KGgoAAAANSUhEUgAAAAoAAAAKCAIAAAACUFjqAAAADklEQVQI12P4z8DAwMAAAA0ABJoqF3IAAAAASUVORK5CYII=";
    const dataUrl = `data:image/png;base64,${testImageBase64}`;

    const VISION_MODEL = "cognitivecomputations/dolphin-vision-72b";
    console.log(`\n🔍 Testing model: ${VISION_MODEL}`);

    try {
        const client = new OpenRouter({ apiKey });
        console.log('📡 Sending request to OpenRouter...');

        const completion = await client.chat.send({
            model: VISION_MODEL,
            messages: [
                {
                    role: "system",
                    content: "You are an image recognition assistant. Describe what you see."
                },
                {
                    role: "user",
                    content: [
                        { type: "text", text: "What is in this image?" },
                        {
                            type: "image_url",
                            image_url: { url: dataUrl }
                        }
                    ] as any
                }
            ] as any,
            maxTokens: 300,
            stream: false
        });

        const content = completion.choices[0]?.message?.content;
        console.log('\n✅ Response received!');
        console.log('📝 Description:', content);

    } catch (error: any) {
        console.error('\n❌ Error:', error.response?.data || error.message);

        // Try to get more details
        if (error.response?.status) {
            console.error('Status:', error.response.status);
        }
    }
}

testDolphinVision();
