const { CartesiaClient } = require('@cartesia/cartesia-js');
const { PrismaClient } = require('@prisma/client');
const fs = require('fs');
const path = require('path');

const prisma = new PrismaClient();

const EMOTIONS = [
    'neutral',
    'calm',
    'whisper', // Testing if this works as an emotion or style
    'happy',
    'sad'
];

async function testEmotions() {
    try {
        console.log('Fetching settings...');
        const settingsList = await prisma.setting.findMany();
        const settings = settingsList.reduce((acc, curr) => {
            acc[curr.key] = curr.value;
            return acc;
        }, {});

        const apiKey = settings.cartesia_api_key || process.env.CARTESIA_API_KEY;
        if (!apiKey) {
            console.error('No Cartesia API Key found in DB or Env.');
            return;
        }

        const voiceId = settings.cartesia_voice_id || 'e8e5fffb-252c-436d-b842-8879b84445b6'; // Default ID if distinct from user input

        console.log(`Using API Key: ${apiKey.substring(0, 5)}...`);
        console.log(`Using Voice ID: ${voiceId}`);

        const client = new CartesiaClient({ apiKey });

        for (const emotion of EMOTIONS) {
            console.log(`\nTesting emotion: ${emotion}`);
            try {
                // Construct the payload mirroring the user's curl request structure
                // Note: The SDK might handle this slightly differently, but we'll try to match the structure.
                // Based on user provided CURL:
                // "generation_config": { "volume": 1, "speed": 1, "emotion": "neutral" }

                // Try passing generation_config directly as the user's curl suggests
                const options = {
                    modelId: settings.cartesia_model_id || 'sonic-english',
                    transcript: `This is a test of the ${emotion} emotion.`,
                    voice: {
                        mode: 'id',
                        id: voiceId,
                    },
                    outputFormat: {
                        container: 'mp3',
                        sampleRate: 44100,
                        bitRate: 128000
                    },
                    language: 'en',
                };

                // Add generation_config to the options
                // The SDK might pass unknown keys to the body
                options['generation_config'] = {
                    emotion: [emotion],
                    speed: 1.0,
                    volume: 1.0
                };

                // Log what we are sending
                // console.log('Options:', JSON.stringify(options, null, 2));

                const result = await client.tts.bytes(options);

                console.log('Result type:', typeof result);
                console.log('Result constructor:', result ? result.constructor.name : 'null');

                if (result) {
                    const proto = Object.getPrototypeOf(result);
                    console.log('Prototype methods:', Object.getOwnPropertyNames(proto));
                    console.log('Own properties:', Object.keys(result));
                }

                // Attempt usage based on common patterns
                let buffer;

                try {
                    if (typeof result.arrayBuffer === 'function') {
                        console.log('Attempting arrayBuffer()...');
                        const ab = await result.arrayBuffer();
                        buffer = Buffer.from(ab);
                    } else if (typeof result.buffer === 'function') {
                        console.log('Attempting buffer()...');
                        buffer = await result.buffer();
                    } else if (typeof result.read === 'function') {
                        console.log('Attempting stream read...');
                        // It's a readable stream?
                        const chunks = [];
                        for await (const chunk of result) {
                            chunks.push(chunk);
                        }
                        buffer = Buffer.concat(chunks);
                    } else {
                        // Just dump it to console to see what it is if it's small, or use JSON.stringify
                        // console.log('Result dump:', result);
                    }
                } catch (e) {
                    console.error('Error consuming result:', e.message);
                }

                if (!buffer) {
                    console.error('Could not obtain buffer from result.');
                    continue;
                }

                const filename = `cartesia_${emotion}.mp3`;
                const filepath = path.join(__dirname, '..', filename);

                fs.writeFileSync(filepath, buffer);
                console.log(`Saved: ${filename} (${buffer.length} bytes)`);

            } catch (err) {
                console.error(`Failed to generate ${emotion}:`, err.message);
                if (err.response) {
                    try {
                        const text = await err.response.text();
                        console.error('Response data:', text);
                    } catch (e) {
                        console.error('Could not read response text');
                    }
                }
            }
        }

    } catch (error) {
        console.error('General Error:', error);
    } finally {
        await prisma.$disconnect();
    }
}

testEmotions();
