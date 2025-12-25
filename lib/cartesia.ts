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
                    bitRate: 128000,
                },
            });

            // Handle if response is a Buffer (Node) or ArrayBuffer
            // The library might return a Buffer directly or a stream depending on version/env.
            // If it is a buffer, this works.
            const base64 = Buffer.from(buffer as any).toString('base64');
            return `data:audio/mp3;base64,${base64}`;

        } catch (error: any) {
            console.error('Cartesia Generation Error:', error);
            throw new Error(`Cartesia Error: ${error.message}`);
        }
    },

    async transcribeAudio(audioBuffer: Buffer, config: { apiKey?: string, model?: string } = {}) {
        const apiKey = config.apiKey || process.env.CARTESIA_API_KEY;
        if (!apiKey) throw new Error('CARTESIA_API_KEY not configured');

        try {
            // OpenAI Compatible Endpoint
            const url = 'https://api.cartesia.ai/audio/transcriptions';

            const formData = new FormData();
            // Append file. Blob is required by fetch/axios compliant FormData usually. 
            // In Node, we might need a Blob or just the buffer with filename.
            // Native FormData in Node 18+ accepts Blob.
            const blob = new Blob([audioBuffer], { type: 'audio/ogg' }); // WhatsApp usually sends OGG/Opus
            formData.append('file', blob, 'audio.ogg');
            formData.append('model', 'ink-whisper'); // Cartesia model
            formData.append('language', 'fr'); // Default to French as per context

            const response = await fetch(url, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${apiKey}`,
                    // 'Content-Type': 'multipart/form-data' // Fetch sets this boundary automatically
                },
                body: formData
            });

            if (!response.ok) {
                const errorText = await response.text();
                throw new Error(`Cartesia Transcription Error: ${response.status} ${errorText}`);
            }

            const data = await response.json();
            return data.text;

        } catch (error: any) {
            console.error('Cartesia Transcription Error:', error);
            throw error;
        }
    }
}
