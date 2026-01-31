
// Script to test the Voice Regex Logic
const patterns = [
    "[VOICE] salut",
    "`[VOICE]` salut",
    "  [VOICE]   salut",
    "**[VOICE]** salut",
    "[voice] salut",
    "Salut [VOICE]" // Should match? The requirement was flexible start/detection.
];

console.log("--- Testing Voice Regex Logic ---");

patterns.forEach(text => {
    let responseText = text;
    let isVoice = false;

    // THE LOGIC FROM CHAT.TS
    const voiceTagMatch = responseText.match(/(\[VOICE\]|\[voice\])/i);
    if (voiceTagMatch) {
        isVoice = true;
        // Remove the tag and cleaner trim
        responseText = responseText.replace(voiceTagMatch[0], '').replace(/`/g, '').trim();
    }

    console.log(`Input: "${text}"`);
    console.log(`Detected: ${isVoice}`);
    console.log(`Cleaned: "${responseText}"`);
    console.log("---");
});
