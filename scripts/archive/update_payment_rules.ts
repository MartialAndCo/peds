
import { PrismaClient } from '@prisma/client'
const prisma = new PrismaClient()

async function main() {
    const key = 'prompt_payment_rules'

    // Fetch existing
    const existing = await prisma.setting.findUnique({ where: { key } })
    let currentVal = existing?.value || ""

    const instruction = `\n\n[SYSTEM - PAYMENT ACKNOWLEDGMENT]:\nIF user confirms payment is SENT, verify context. IF confirmed, append [PAYMENT_RECEIVED] to your response. This triggers the validation system.\nExample: "Thanks babe! [PAYMENT_RECEIVED]"`

    if (!currentVal.includes('[PAYMENT_RECEIVED]')) {
        const newVal = currentVal + instruction
        await prisma.setting.upsert({
            where: { key },
            create: { key, value: newVal },
            update: { value: newVal }
        })
        console.log("✅ Updated prompt_payment_rules with [PAYMENT_RECEIVED] logic.")
        console.log("New Value:\n", newVal)
    } else {
        console.log("ℹ️ Rules already contain [PAYMENT_RECEIVED]. Skipping.")
    }
}

main().catch(console.error)
