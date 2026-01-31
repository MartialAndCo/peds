import { settingsService } from '@/lib/settings-cache'

// ...

try {
    // Get API Key from Settings (like Chat does)
    const settings = await settingsService.getSettings()
    const apiKey = (settings as any).venice_api_key

    // Use a cheaper/faster model if possible (Haiku or Venice default)
    const humanizedText = await venice.chatCompletion(
        systemPrompt,   // System Prompt (Persona/Rules)
        [],             // History (Empty)
        fullUserMessage,// User Message (Content to process)
        {
            max_tokens: 200,
            temperature: 0.3,
            apiKey: apiKey // Pass the DB key explicitly
        }
    )
    systemPrompt,   // System Prompt (Persona/Rules)
        [],             // History (Empty)
        fullUserMessage,// User Message (Content to process)
        { max_tokens: 200, temperature: 0.3 } // Verified stable by user & tests
            )

    let cleanResult = humanizedText.replace(/"/g, '').trim()

    // MECHANICAL CLEANUP (Safety Net) 🛡️
    // Remove Emojis (Ranges for generic emojis, symbols, pictographs)
    // Note: This regex covers most common emoji ranges
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
