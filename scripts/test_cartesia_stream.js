const { CartesiaClient } = require('@cartesia/cartesia-js');
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function testStream() {
    try {
        const settingsList = await prisma.setting.findMany();
        const settings = settingsList.reduce((acc, curr) => {
            acc[curr.key] = curr.value;
            return acc;
        }, {});

        const apiKey = settings.cartesia_api_key || process.env.CARTESIA_API_KEY;
        const client = new CartesiaClient({ apiKey });

        console.log('Generating audio...');
        const result = await client.tts.bytes({
            modelId: settings.cartesia_model_id || 'sonic-english',
            transcript: "Stream test.",
            voice: { mode: 'id', id: settings.cartesia_voice_id || 'e8e5fffb-252c-436d-b842-8879b84445b6' },
            outputFormat: { container: 'mp3', sampleRate: 44100, bitRate: 128000 },
        });

        console.log('Result Keys:', Object.keys(result));

        if (result.readableStream) {
            console.log('Found readableStream. Consuming...');
            const reader = result.readableStream.getReader();
            const chunks = [];
            let totalLength = 0;

            while (true) {
                const { done, value } = await reader.read();
                if (done) break;
                // value should be Uint8Array
                console.log('Chunk received:', value.constructor.name, value.length);
                chunks.push(Buffer.from(value));
                totalLength += value.length;
            }

            const fullBuffer = Buffer.concat(chunks);
            console.log('Full Buffer created:', fullBuffer.length, 'bytes');
            console.log('Base64 start:', fullBuffer.toString('base64').substring(0, 50));
        }

    } catch (error) {
        console.error('Stream Error:', error);
    } finally {
        await prisma.$disconnect();
    }
}

testStream();
