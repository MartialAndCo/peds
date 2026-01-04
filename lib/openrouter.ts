import { OpenRouter } from "@openrouter/sdk";
import { venice } from "./venice";

export const openrouter = {
    async chatCompletion(
        systemPrompt: string,
        messages: { role: string; content: string }[],
        userMessage: string,
        config: { apiKey?: string; model?: string; temperature?: number; max_tokens?: number } = {}
    ): Promise<string> {
        let apiKey = config.apiKey || process.env.OPENROUTER_API_KEY;

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

        try {
            const client = new OpenRouter({ apiKey });
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
            // Check for Rate Limit (429)
            const isRateLimit = error?.message?.includes('429') ||
                JSON.stringify(error).includes('rate-limited') ||
                error?.code === 429;

            if (isRateLimit) {
                console.warn(`[OpenRouter] Rate limit hit (429). Falling back to Venice Service...`);
                try {
                    // Fallback to Venice Service
                    return await venice.chatCompletion(
                        systemPrompt,
                        messages,
                        userMessage,
                        config
                    );
                } catch (fallbackError) {
                    console.error("[OpenRouter] Venice Fallback failed:", fallbackError);
                    return "";
                }
            }

            console.error(`[OpenRouter] Error:`, error);
            return "";
        }
    },
};
