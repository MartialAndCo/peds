import { detectPaymentClaim } from './lib/services/payment-detector';
import { venice } from './lib/venice';

// Mock Venice
venice.chatCompletion = async (system, history, userMsg) => {
    // Simulate AI behavior based on input
    const lower = userMsg.toLowerCase();
    if (lower.includes("50$") && lower.includes("paypal")) {
        return JSON.stringify({ claimed: true, amount: 50, method: "PayPal", confidence: 0.95 });
    }
    if (lower.includes("100€")) {
        return JSON.stringify({ claimed: true, amount: 100, method: null, confidence: 0.9 });
    }
    if (lower.includes("how are you")) {
        return JSON.stringify({ claimed: false, amount: null, method: null, confidence: 0.95 });
    }
    return JSON.stringify({ claimed: false, confidence: 0 });
};

async function runTests() {
    const testCases = [
        "I just sent you 50$ on PayPal",
        "envoyé 100€ sur ton compte",
        "Hello, how are you?"
    ];

    console.log("--- Starting Payment Detection UNIT Tests (Mocked AI) ---");

    for (const msg of testCases) {
        console.log(`\nAnalyzing: "${msg}"`);
        try {
            const result = await detectPaymentClaim(msg, {});
            console.log("Result:", JSON.stringify(result, null, 2));
        } catch (error) {
            console.error("Error processing message:", error);
        }
    }
    console.log("\n--- Tests Completed ---");
}

runTests();
