
import { venice } from '@/lib/venice'
import { logger } from '@/lib/logger'
import { settingsService } from '@/lib/settings-cache'

export const voiceHumanizer = {
    async humanize(text: string, locale: string = 'en-US'): Promise<string> {
        try {
            // Get API Key from Settings
            const settings = await settingsService.getSettings()
            const apiKey = (settings as any).venice_api_key

            const isFrench = locale.toLowerCase().startsWith('fr');

            const systemPrompt = isFrench
                ? `You are a Text-to-Speech Optimizer.
Your goal is to rewrite the input text to make it sound 100% natural, casual, and human when spoken aloud in French.
- DO NOT TRANSLATE. Keep the text in French.
- Use explicit hesitation fillers (euh..., hmm...) naturally.
- Use familiar contractions (je suis -> j'suis, il y a -> y'a).
- Remove robotic phrasing.
- Keep the exact meaning.
- Output ONLY the rewritten text, no quotes, no preamble.`
                : `You are a Text-to-Speech Optimizer.
Your goal is to rewrite the input text to make it sound 100% natural, casual, and human when spoken aloud in ${locale}.
- DO NOT TRANSLATE. Keep the text in ${locale}.
- Use explicit hesitation fillers (um..., uh...) naturally.
- Use familiar contractions (I am -> I'm, do not -> don't, gonna, wanna).
- Remove robotic phrasing.
- Keep the exact meaning.
- Output ONLY the rewritten text, no quotes, no preamble.`;

            const fullUserMessage = `Rewrite this text for natural speech: "${text}"`

            // Use a cheaper/faster model if possible (Haiku or Venice default)
            const humanizedText = await venice.chatCompletion(
                systemPrompt,   // System Prompt
                [],             // History (Empty)
                fullUserMessage,// User Message
                {
                    max_tokens: 200,
                    temperature: 0.3,
                    apiKey: apiKey // Pass the DB key explicitly
                }
            )

            let cleanResult = humanizedText.replace(/"/g, '').trim()

            // MECHANICAL CLEANUP (Safety Net) 🛡️
            // Remove Emojis (Ranges for generic emojis, symbols, pictographs)
            cleanResult = cleanResult.replace(/[\u{1F600}-\u{1F64F}\u{1F300}-\u{1F5FF}\u{1F680}-\u{1F6FF}\u{1F1E0}-\u{1F1FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}]/gu, '')

            // Remove Markdown formatting just in case
            cleanResult = cleanResult.replace(/[*_~`]/g, '')

            // Normalize spaces
            cleanResult = cleanResult.replace(/\s+/g, ' ').trim()

            logger.info('Voice Humanized', {
                module: 'voice-humanizer',
                original: text,
                result: cleanResult
            })

            return cleanResult

        } catch (e: any) {
            logger.error('Voice Humanizer Failed (Fallback to original)', e, { module: 'voice-humanizer' })
            // Return original but stripped of emojis as baseline safety
            return text.replace(/[\u{1F600}-\u{1F64F}\u{1F300}-\u{1F5FF}\u{1F680}-\u{1F6FF}\u{1F1E0}-\u{1F1FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}]/gu, '')
        }
    }
}
