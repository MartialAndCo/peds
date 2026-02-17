
function repairJson(jsonStr: string): string {
    // 1. Remove markdown code blocks if present (redundant if we use match, but good for safety)
    let cleaned = jsonStr.replace(/```json/g, '').replace(/```/g, '');

    // 2. Fix keys without quotes (e.g., key: "value")
    // This regex looks for word characters followed by a colon, providing they are not already quoted
    cleaned = cleaned.replace(/([{,]\s*)([a-zA-Z0-9_]+)\s*:/g, '$1"$2":');

    // 3. Fix single quotes to double quotes for keys and values
    // This is tricky because content might contain single quotes. 
    // Basic approach: replace 'key': with "key":
    cleaned = cleaned.replace(/'([^']+)'\s*:/g, '"$1":');
    // Replace 'value' with "value", but only if it looks like a string value
    // cleaned = cleaned.replace(/:\s*'([^']*)'/g, ': "$1"'); 

    // 4. Remove trailing commas
    cleaned = cleaned.replace(/,\s*}/g, '}').replace(/,\s*]/g, ']');

    return cleaned;
}

const testCases = [
    { name: "Valid JSON", input: '{"key": "value"}' },
    { name: "Missing quotes on key", input: '{key: "value", isMediaRequest: true}' },
    { name: "Single quotes on key", input: "{'key': 'value'}" },
    { name: "Trailing comma", input: '{"key": "value",}' },
    { name: "Mixed issues", input: '{key: "value", "other": true,}' },
    { name: "With newlines", input: '{\n  key: "value"\n}' }
];

console.log("=== Testing JSON Repair Logic ===\n");

for (const test of testCases) {
    console.log(`Test: ${test.name}`);
    console.log(`Input: ${test.input}`);
    try {
        JSON.parse(test.input);
        console.log("✅ Native JSON.parse succeeded");
    } catch (e) {
        console.log("❌ Native JSON.parse failed. Attempting repair...");
        const repaired = repairJson(test.input);
        console.log(`Repaired: ${repaired}`);
        try {
            const obj = JSON.parse(repaired);
            console.log("✅ Repaired JSON parsed successfully:", obj);
        } catch (e2) {
            console.log("❌ Repaired JSON failed:", e2);
        }
    }
    console.log("---\n");
}
