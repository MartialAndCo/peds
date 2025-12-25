import { CartesiaClient } from '@cartesia/cartesia-js';

export const cartesia = {
    async generateAudio(text: string, config: { apiKey?: string, voiceId?: string, modelId?: string } = {}) {
        const apiKey = config.apiKey || process.env.CARTESIA_API_KEY;
        const voiceId = config.voiceId || process.env.CARTESIA_VOICE_ID || 'e8e5fffb-252c-436d-b842-8879b84445b6'; // Default voice
        const modelId = config.modelId || process.env.CARTESIA_MODEL_ID || 'sonic-english'; // Default model (sonic-3 is not default in lib yet, using sonic-english or sonic-multilingual usually, but user asked for sonic-3, assuming it's valid for the API)

        if (!apiKey) {
            throw new Error('CARTESIA_API_KEY not configured');
        }

        const client = new CartesiaClient({ apiKey });

        // Cartesia returns a WebSocket or Byte stream. 
        // For simple usage we want a buffer.
        // The library might simplify this. Let's start with the standard buffer approach using the API directly if the lib is complex or just check the lib docs.
        // Actually, the user provided a CURL to /tts/bytes. 
        // The Library exposes `tts.bytes`.

        try {
            // Using the 'bytes' endpoint as per user CURL example (but via library)
            const buffer = await client.tts.bytes({
                modelId: modelId,
                transcript: text,
                voice: {
                    mode: 'id',
                    id: voiceId,
                },
                outputFormat: {
                    container: 'mp3', // WhatsApp prefers MP3 or OGG
                    sampleRate: 44100,
                    encoding: 'mp3',
                },
            });

            // Convert ArrayBuffer to Base64 Data URL
            const base64 = Buffer.from(buffer).toString('base64');
            return `data:audio/mp3;base64,${base64}`;

        } catch (error: any) {
            console.error('Cartesia Generation Error:', error);
            throw new Error(`Cartesia Error: ${error.message}`);
        }
    }
}
