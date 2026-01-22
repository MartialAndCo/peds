import { detectPaymentClaim } from './lib/services/payment-detector';
import { venice } from './lib/venice';

// Mock Venice to simulate robust AI returns
venice.chatCompletion = async (system, history, userMsg) => {
    const lower = userMsg.toLowerCase();

    // Nuanced Cases
    if (lower.includes("check your account")) {
        return JSON.stringify({ claimed: true, amount: null, method: "Bank Transfer", confidence: 0.85 });
    }
    if (lower.includes("it's in your venmo")) {
        return JSON.stringify({ claimed: true, amount: null, method: "Venmo", confidence: 0.9 });
    }
    if (lower.includes("just took care of it")) {
        return JSON.stringify({ claimed: true, amount: null, method: null, confidence: 0.8 });
    }

    return JSON.stringify({ claimed: false, confidence: 0 });
};

async function runTests() {
    const testCases = [
        "Check your account",
        "It's in your Venmo",
        "Just took care of it"
    ];

    console.log("--- Testing Nuanced Variations (Simulation) ---");

    for (const msg of testCases) {
        console.log(`\nInput: "${msg}"`);
        try {
            const result = await detectPaymentClaim(msg, {});
            console.log("-> Detected:", result.claimed ? "YES" : "NO");
            if (result.claimed) {
                console.log(`   Method: ${result.method || 'Unknown'}, Confidence: ${result.confidence}`);
            }
        } catch (error) {
            console.error("Error:", error);
        }
    }
}

runTests();
