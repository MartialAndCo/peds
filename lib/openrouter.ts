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

        console.log(`[OpenRouter] Config apiKey received: ${config.apiKey ? 'YES (from settings)' : 'NO'}`);
        console.log(`[OpenRouter] Env OPENROUTER_API_KEY: ${process.env.OPENROUTER_API_KEY ? 'YES' : 'NO'}`);
        console.log(`[OpenRouter] Final apiKey resolved: ${apiKey ? 'YES' : 'NO'}`);

        if (!apiKey) {
            console.warn("[OpenRouter] No API key, falling back to RunPod directly...");
            const { runpod } = require("./runpod");
            return await runpod.chatCompletion(
                systemPrompt,
                messages,
                userMessage,
                {
                    temperature: config.temperature,
                    max_tokens: config.max_tokens
                }
            );
        }

        const model = config.model || process.env.OPENROUTER_MODEL || "meta-llama/llama-3.3-70b-instruct:free";

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
            // Check for Rate Limit (429) or any other error
            const isRateLimit = error?.message?.includes('429') ||
                JSON.stringify(error).includes('rate-limited') ||
                error?.code === 429;

            if (isRateLimit) {
                console.warn(`[OpenRouter] Rate limit hit (429). Falling back to RunPod...`);
            } else {
                console.error(`[OpenRouter] Error:`, error);
                console.warn(`[OpenRouter] Falling back to RunPod...`);
            }

            // Fallback directly to RunPod (Venice has no credits)
            try {
                const { runpod } = require("./runpod");
                return await runpod.chatCompletion(
                    systemPrompt,
                    messages,
                    userMessage,
                    {
                        temperature: config.temperature,
                        max_tokens: config.max_tokens
                    }
                );
            } catch (fallbackError) {
                console.error("[OpenRouter] RunPod fallback failed:", fallbackError);
                return "";
            }
        }
    },
    /**
     * Describe an image using Qwen2.5-VL (NSFW-compatible).
     * Uses direct API call instead of SDK for better format compatibility.
     */
    async describeImage(
        imageBuffer: Buffer,
        mimeType: string,
        apiKey?: string,
        customPrompt?: string
    ): Promise<string | null> {
        const key = apiKey || process.env.OPENROUTER_API_KEY;
        if (!key) {
            console.error("[OpenRouter Vision] No API key available");
            return null;
        }

        try {
            const base64Image = imageBuffer.toString('base64');
            const dataUrl = `data:${mimeType};base64,${base64Image}`;

            // Use Qwen2.5-VL for uncensored image/video analysis
            const VISION_MODEL = "qwen/qwen-2.5-vl-72b-instruct";

            console.log(`[OpenRouter Vision] Analyzing image with ${VISION_MODEL}...`);

            // Use direct axios call instead of SDK (SDK has stricter validation)
            const axios = require('axios');
            const response = await axios.post('https://openrouter.ai/api/v1/chat/completions', {
                model: VISION_MODEL,
                messages: [
                    {
                        role: "user",
                        content: [
                            { type: "text", text: customPrompt || "What is in this image? Describe it briefly." },
                            { type: "image_url", image_url: { url: dataUrl } }
                        ]
                    }
                ],
                max_tokens: 300
            }, {
                headers: {
                    'Authorization': `Bearer ${key}`,
                    'Content-Type': 'application/json',
                    'HTTP-Referer': 'https://github.com/MartialAndCo/peds'
                },
                timeout: 60000
            });

            const content = response.data.choices[0]?.message?.content;
            if (typeof content === 'string') {
                console.log(`[OpenRouter Vision] Description: ${content.substring(0, 100)}...`);
                return content;
            }
            return null;

        } catch (error: any) {
            console.error("[OpenRouter Vision] Error:", error.response?.data || error.message);
            return null;
        }
    }
};
