import { detectPaymentClaim } from './lib/services/payment-detector';
import { venice } from './lib/venice';

// Mock Venice to verify our keywords trigger the AI, 
// AND to simulate the AI respecting the new prompt rules.
venice.chatCompletion = async (system, history, userMsg) => {
    const lower = userMsg.toLowerCase();

    // Positive Cases
    if (lower.includes("check your account") && !lower.includes("soon")) return JSON.stringify({ claimed: true, method: "Bank", confidence: 0.9 });
    if (lower.includes("took care")) return JSON.stringify({ claimed: true, confidence: 0.85 });
    if (lower.includes("sent")) return JSON.stringify({ claimed: true, confidence: 0.9 });

    // Negative Cases (The AI *should* return false for these given the new prompt)
    if (lower.includes("take care")) return JSON.stringify({ claimed: false, confidence: 0.95 });
    if (lower.includes("check this")) return JSON.stringify({ claimed: false, confidence: 0.95 });
    if (lower.includes("will pay")) return JSON.stringify({ claimed: false, confidence: 0.95 });

    return JSON.stringify({ claimed: false });
};

async function runTests() {
    const scenarios = [
        { text: "Check your account", expected: true },
        { text: "Just took care of it", expected: true },
        { text: "I sent the funds", expected: true },

        // Tricky False Positives (Should be rejected)
        { text: "Take care, bye!", expected: false },
        { text: "Can you check this?", expected: false },
        { text: "I will pay you soon", expected: false },
        { text: "Do you have an account?", expected: false }
    ];

    console.log("--- Payment Detection Robustness Test ---");
    let passed = 0;

    for (const s of scenarios) {
        process.stdout.write(`Testing: "${s.text}" ... `);
        try {
            const result = await detectPaymentClaim(s.text, {});
            const isMatch = result.claimed === s.expected;
            if (isMatch) {
                console.log("✅ OK");
                passed++;
            } else {
                console.log(`❌ FAIL (Expected ${s.expected}, got ${result.claimed})`);
            }
        } catch (e) {
            console.log("❌ ERROR");
        }
    }

    console.log(`\nScore: ${passed}/${scenarios.length}`);
}

runTests();
