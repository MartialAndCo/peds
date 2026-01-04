import { OpenRouter } from "@openrouter/sdk";

export const openrouter = {
    async chatCompletion(
        systemPrompt: string,
        messages: { role: string; content: string }[],
        userMessage: string,
        config: { apiKey?: string; model?: string; temperature?: number; max_tokens?: number } = {}
    ): Promise<string> {
        let apiKey = config.apiKey || process.env.OPENROUTER_API_KEY;
        const fallbackKey = process.env.VENICE_API_KEY;

        if (!apiKey) {
            console.warn("OPENROUTER_API_KEY not configured");
            return "IA non configurée (Clé API manquante)";
        }

        const model = config.model || process.env.OPENROUTER_MODEL || "cognitivecomputations/dolphin-mistral-24b-venice-edition:free";

        const apiMessages = [
            { role: "system", content: systemPrompt },
            ...messages.map((m) => ({
                role: m.role === "ai" ? "assistant" : "user",
                content: m.content,
            })),
            { role: "user", content: userMessage },
        ];

        // Helper function to send request
        const attemptRequest = async (currentKey: string, isRetry = false): Promise<string | null> => {
            try {
                const client = new OpenRouter({ apiKey: currentKey });
                const completion = await client.chat.send({
                    model: model,
                    messages: apiMessages as any,
                    temperature: config.temperature ?? 0.7,
                    stream: false,
                });

                const content = completion.choices[0]?.message?.content;
                if (typeof content === 'string') return content;
                if (Array.isArray(content)) {
                    return content
                        .map((part: any) => (part.type === 'text' ? part.text : ''))
                        .join('');
                }
                return "";
            } catch (error: any) {
                // Check for Rate Limit (429) or specific error message from the user's report
                const isRateLimit = error?.message?.includes('429') ||
                    JSON.stringify(error).includes('rate-limited') ||
                    error?.code === 429;

                if (isRateLimit && !isRetry && fallbackKey && fallbackKey !== currentKey) {
                    console.warn(`[OpenRouter] Rate limited on primary key. Switching to Venice Fallback Key...`);
                    return null; // Signal to retry
                }

                console.error(`[OpenRouter] Error (Retry: ${isRetry}):`, error);
                throw error; // Throw to be caught by caller or outer logic
            }
        };

        try {
            // Attempt 1: Primary Key
            let response = await attemptRequest(apiKey);

            // Attempt 2: Fallback Key (if first attempt returned null)
            if (response === null && fallbackKey) {
                try {
                    response = await attemptRequest(fallbackKey, true);
                } catch (fallbackError) {
                    console.error("[OpenRouter] Fallback failed:", fallbackError);
                    return ""; // Return empty on final failure
                }
            }

            return response || "";

        } catch (e) {
            return "";
        }
    },
};
};
