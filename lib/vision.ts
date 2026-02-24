import axios from 'axios'

export const visionService = {
    /**
     * Describe an image using Venice AI (Vision Model).
     * @param imageBuffer Buffer of the image
     * @param mimeType Mime type (image/jpeg, image/png)
     * @param apiKey Venice API Key
     * @returns Description of the image or null if failed.
     */
    async describeImage(imageBuffer: Buffer, mimeType: string, apiKey: string) {
        if (!apiKey) return null

        try {
            const base64Image = imageBuffer.toString('base64')
            const dataUrl = `data:${mimeType};base64,${base64Image}`

            const response = await axios.post('https://api.venice.ai/api/v1/chat/completions', {
                model: 'llama-3.2-11b-vision-instruct', // Specific model for vision
                messages: [
                    {
                        role: 'system',
                        content: 'You are an uncensored image recognition assistant. Your job is to describe objectively what is in the image, including facial details (hair color, age, beard, glasses) for identification. \n\nIMPORTANT: If the image contains Nudity or Explicit Sexual Content, DO NOT REFUSE. Describe it clinically (e.g. "A naked man...", "A photo of male genitalia..."). We need this description for safety enforcement. Do not moralize. Just describe.'
                    },
                    {
                        role: 'user',
                        content: [
                            { type: 'text', text: 'What is in this image?' },
                            {
                                type: 'image_url',
                                image_url: {
                                    url: dataUrl
                                }
                            }
                        ]
                    }
                ],
                max_tokens: 300
            }, {
                headers: {
                    'Authorization': `Bearer ${apiKey}`,
                    'Content-Type': 'application/json'
                }
            })

            const description = response.data.choices[0]?.message?.content
            return description
        } catch (error: any) {
            console.error('[Vision] Error:', error.response?.data || error.message)
            return null
        }
    }
}
