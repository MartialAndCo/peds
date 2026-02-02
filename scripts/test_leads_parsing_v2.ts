
import { leadService } from '../lib/leads';

const testCases = [
    { input: "+33612345678 18 ans", expectedPhone: "+33612345678", expectedContext: "18 ans" },
    { input: "+33612345678 25 ans Lyon", expectedPhone: "+33612345678", expectedContext: "25 ans Lyon" },
    // With implicit truncation if space is missing (fallback safety)
    { input: "+3361234567818", expectedPhone: "+33612345678", expectedContext: "No context provided." },
    // Just the number
    { input: "+33612345678", expectedPhone: "+33612345678", expectedContext: "No context provided." },
    // Non-French (just to see basic split) - strict split should take the first part
    { input: "+3212345678 context", expectedPhone: "+3212345678", expectedContext: "context" }
];

console.log("=== Testing Lead Parsing Logic ===");

testCases.forEach((test, index) => {
    console.log(`\nTest #${index + 1}: Input: "${test.input}"`);
    const result = leadService.parseLeadMessage(test.input);

    const phoneMatch = result.phone === test.expectedPhone;
    const contextMatch = (result.context || "No context provided.") === test.expectedContext;

    if (phoneMatch && contextMatch) {
        console.log(`✅ PASS`);
        console.log(`   Phone: ${result.phone}`);
        console.log(`   Context: ${result.context}`);
    } else {
        console.log(`❌ FAIL`);
        console.log(`   Expected Phone: ${test.expectedPhone}, Got: ${result.phone}`);
        console.log(`   Expected Context: ${test.expectedContext}, Got: ${result.context}`);
    }
});
