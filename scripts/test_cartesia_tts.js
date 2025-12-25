const { CartesiaClient } = require('@cartesia/cartesia-js');
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function testTTS() {
    try {
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

        console.log('API Key found (length):', apiKey.length);

        const client = new CartesiaClient({ apiKey });

        console.log('Generating audio...');
        const result = await client.tts.bytes({
            modelId: settings.cartesia_model_id || 'sonic-english',
            transcript: "Hello, this is a test.",
            voice: {
                mode: 'id',
                id: settings.cartesia_voice_id || 'e8e5fffb-252c-436d-b842-8879b84445b6',
            },
            outputFormat: {
                container: 'mp3',
                sampleRate: 44100,
                bitRate: 128000
            },
        });

        console.log('Result Type:', typeof result);
        console.log('Result Constructor:', result ? result.constructor.name : 'null');
        console.log('Is Buffer?', Buffer.isBuffer(result));
        console.log('Is ArrayBuffer?', result instanceof ArrayBuffer);
        console.log('Is View?', ArrayBuffer.isView(result));

        if (typeof result === 'object') {
            console.log('Keys:', Object.keys(result));
            if (result.buffer) {
                console.log('Has .buffer property. Type:', typeof result.buffer, 'Constructor:', result.buffer.constructor.name);
            }
        }

        // Try to convert to buffer
        try {
            Buffer.from(result);
            console.log('Buffer.from(result) success');
        } catch (e) {
            console.log('Buffer.from(result) failed:', e.message);
        }

    } catch (error) {
        console.error('Structure Error:', error);
    } finally {
        await prisma.$disconnect();
    }
}

testTTS();
