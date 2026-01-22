import { detectPaymentClaim } from './lib/services/payment-detector';
import { config } from 'dotenv';
config();

async function runTests() {
    const testCases = [
        "I just sent you 50$ on PayPal",
        "envoyé 100€ sur ton compte",
        "payment done via cashapp",
        "Hello, how are you?",
        "I will pay you tomorrow",
        "Here is 200",
        "Je t'ai fait un virement de 500 balles"
    ];

    console.log("--- Starting Payment Detection Tests ---");

    for (const msg of testCases) {
        console.log(`\nAnalyzing: "${msg}"`);
        try {
            // Mock settings if needed, or rely on defaults with env vars
            const result = await detectPaymentClaim(msg, {
                venice_api_key: process.env.VENICE_API_KEY,
                venice_model: 'venice-uncensored'
            });
            console.log("Result:", JSON.stringify(result, null, 2));
        } catch (error) {
            console.error("Error processing message:", error);
        }
    }
    console.log("\n--- Tests Completed ---");
}

runTests();
