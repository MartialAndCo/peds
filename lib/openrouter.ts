import { OpenRouter } from "@openrouter/sdk";

export const openrouter = {
    async chatCompletion(
        systemPrompt: string,
        messages: { role: string; content: string }[],
        userMessage: string,
        config: { apiKey?: string; model?: string; temperature?: number; max_tokens?: number } = {}
    ) {
        const apiKey = config.apiKey || process.env.OPENROUTER_API_KEY;
        if (!apiKey) {
            console.warn("OPENROUTER_API_KEY not configured");
            return "IA non configurée (Clé API manquante)";
        }

        const model = config.model || process.env.OPENROUTER_MODEL || "cognitivecomputations/dolphin-mistral-24b-venice-edition:free";

        const client = new OpenRouter({
            apiKey: apiKey,
        });

        const apiMessages = [
            { role: "system", content: systemPrompt },
            ...messages.map((m) => ({
                role: m.role === "ai" ? "assistant" : "user",
                content: m.content,
            })),
            { role: "user", content: userMessage },
        ];

        try {
            const completion = await client.chat.send({
                model: model,
                messages: apiMessages as any,
                temperature: config.temperature ?? 0.7,
                stream: false,
            });

            return completion.choices[0]?.message?.content || "";
        } catch (error: any) {
            console.error("[OpenRouter] Error:", error);
            return "";
        }
    },
};
