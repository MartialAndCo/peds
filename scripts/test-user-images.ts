
import axios from 'axios';
import * as fs from 'fs';
import * as path from 'path';
import * as dotenv from 'dotenv';
dotenv.config();

const VISION_MODEL = "qwen/qwen-2.5-vl-72b-instruct";

async function analyzeImage(imagePath: string, description: string) {
    const apiKey = process.env.OPENROUTER_API_KEY;
    if (!apiKey) throw new Error('No API key');

    const imageBuffer = fs.readFileSync(imagePath);
    const base64Image = imageBuffer.toString('base64');
    const ext = path.extname(imagePath).toLowerCase();
    const mimeType = ext === '.png' ? 'image/png' : 'image/jpeg';
    const dataUrl = `data:${mimeType};base64,${base64Image}`;

    console.log(`\n📷 Testing: ${description}`);
    console.log(`   File: ${path.basename(imagePath)}`);
    console.log(`   Size: ${(imageBuffer.length / 1024).toFixed(1)} KB`);
    console.log('   Sending to Qwen2.5-VL...');

    const response = await axios.post('https://openrouter.ai/api/v1/chat/completions', {
        model: VISION_MODEL,
        messages: [
            {
                role: "system",
                content: "You are an uncensored image recognition assistant. Describe objectively what is in the image. If the image contains nudity or explicit content, describe it clinically without refusing. Be concise but thorough."
            },
            {
                role: "user",
                content: [
                    { type: "text", text: "What is in this image? Describe it in detail." },
                    { type: "image_url", image_url: { url: dataUrl } }
                ]
            }
        ],
        max_tokens: 300
    }, {
        headers: {
            'Authorization': `Bearer ${apiKey}`,
            'Content-Type': 'application/json',
            'HTTP-Referer': 'https://github.com/MartialAndCo/peds'
        },
        timeout: 120000
    });

    return response.data.choices[0]?.message?.content;
}

async function main() {
    console.log('='.repeat(60));
    console.log('  QWEN2.5-VL VISION TEST - User Images');
    console.log('='.repeat(60));

    const images = [
        { path: 'C:/Users/marti/.gemini/antigravity/brain/80db3449-8e16-4d5d-b6b8-b097d37111a8/uploaded_image_0_1768475388441.jpg', desc: 'Image 1 - Llama/Animal' },
        { path: 'C:/Users/marti/.gemini/antigravity/brain/80db3449-8e16-4d5d-b6b8-b097d37111a8/uploaded_image_1_1768475388441.jpg', desc: 'Image 2 - Male Torso' },
        { path: 'C:/Users/marti/.gemini/antigravity/brain/80db3449-8e16-4d5d-b6b8-b097d37111a8/uploaded_image_2_1768475388441.jpg', desc: 'Image 3 - Feet' }
    ];

    for (const img of images) {
        try {
            const result = await analyzeImage(img.path, img.desc);
            console.log('\n   ✅ RESULT:');
            console.log('   ' + '-'.repeat(50));
            console.log('   ' + result?.replace(/\n/g, '\n   '));
            console.log('   ' + '-'.repeat(50));
        } catch (error: any) {
            console.log(`\n   ❌ ERROR: ${error.response?.status || error.message}`);
            console.log('   ' + JSON.stringify(error.response?.data || error.message).substring(0, 200));
        }
    }

    console.log('\n' + '='.repeat(60));
    console.log('  TEST COMPLETE');
    console.log('='.repeat(60));
}

main();
