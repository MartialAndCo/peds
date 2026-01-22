import { detectPaymentClaim } from './lib/services/payment-detector';
import { config } from 'dotenv';
config();

async function testContextAwareDetection() {
    console.log("=== Testing Context-Aware Payment Detection ===\n");

    // Scenario 1: User discusses PayPal, then says "c'est fait"
    const scenario1History = [
        { role: 'user' as const, content: 'Je peux payer comment ?' },
        { role: 'ai' as const, content: 'Tu peux me payer via PayPal à mon adresse email' },
        { role: 'user' as const, content: 'Ok combien je te dois ?' },
        { role: 'ai' as const, content: 'C\'est 150 euros' },
    ];

    console.log("Scenario 1: User discussed PayPal and 150€, then says 'c'est fait'");
    console.log("History:", scenario1History.map(m => `${m.role}: ${m.content}`).join('\n       '));
    console.log("\nUser message: 'c'est fait'\n");

    const result1 = await detectPaymentClaim("c'est fait", {
        venice_api_key: process.env.VENICE_API_KEY,
        venice_model: 'venice-uncensored'
    }, scenario1History);

    console.log("Result:", JSON.stringify(result1, null, 2));
    console.log("\n---\n");

    // Scenario 2: User discusses bank transfer, then says "envoyé"
    const scenario2History = [
        { role: 'user' as const, content: 'Je te fais un virement bancaire ok ?' },
        { role: 'ai' as const, content: 'Oui parfait, c\'est 200 balles' },
        { role: 'user' as const, content: 'Ok je fais ça maintenant' },
    ];

    console.log("Scenario 2: User discussed bank transfer and 200, then says 'envoyé'");
    console.log("History:", scenario2History.map(m => `${m.role}: ${m.content}`).join('\n       '));
    console.log("\nUser message: 'envoyé'\n");

    const result2 = await detectPaymentClaim("envoyé", {
        venice_api_key: process.env.VENICE_API_KEY,
        venice_model: 'venice-uncensored'
    }, scenario2History);

    console.log("Result:", JSON.stringify(result2, null, 2));
    console.log("\n---\n");

    // Scenario 3: No context, user says "done" (should still detect but with lower confidence)
    console.log("Scenario 3: No context, user says 'done'");
    console.log("History: (empty)");
    console.log("\nUser message: 'done'\n");

    const result3 = await detectPaymentClaim("done", {
        venice_api_key: process.env.VENICE_API_KEY,
        venice_model: 'venice-uncensored'
    }, []);

    console.log("Result:", JSON.stringify(result3, null, 2));
    console.log("\n=== Tests Completed ===");
}

testContextAwareDetection();
