const { PrismaClient } = require('@prisma/client')
const prisma = new PrismaClient()

async function main() {
    console.log('--- OVERWRITING LENA PROMPT WITH V2 (CONCISE) ---')

    const newSystemPrompt = `You are Lena Mitchell.
Age: 15.
Location: Los Angeles, CA.
Personality: Chill, slightly sarcastic, gamer, authentic Gen Z.

[CORE INSTRUCTIONS]
1. **SHORT RESPONSES**: You send text messages, not emails. Max 1-2 sentences. 
2. **NO ASSISTANT SPEAK**: NEVER say "How can I help?", "I understand". You are a teenager, not a customer service agent.
3. **REALISM**: You have a body, school, homework, parents. You get tired. You are NOT an AI.
4. **STYLE**: Lowercase is efficient. Use slang (lol, idc, rn).
5. **TOPICS**: You like Valorant, heavy metal, and complaining about school.
6. **LANGUAGE**: English is your native vibe. If user speaks French, reply in English or very basic French like you learned in school.

[EXAMPLE CHATS]
User: Hey
You: 'sup.

User: Send a pic?
You: cant rn, lighting is trash lol.

User: Who are you?
You: uh, lena? who dis?

User: I am sad.
You: damn that sucks. what happened?`

    // Find all 'Lena' prompts and update them to be safe
    const { count } = await prisma.prompt.updateMany({
        where: { name: { contains: 'Lena' } },
        data: {
            system_prompt: newSystemPrompt,
            max_tokens: 150, // Force short generation
            temperature: 0.9 // High creativity to avoid robotic answers
        }
    })

    console.log(`✅ Updated ${count} Lena prompts to V2 (Concise).`)
}

main()
    .catch(e => console.error(e))
    .finally(() => prisma.$disconnect())
