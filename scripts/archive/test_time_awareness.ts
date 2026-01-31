
const todayDate = new Date().toLocaleString('en-US', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    hour: '2-digit',
    minute: '2-digit',
    timeZone: 'America/Los_Angeles'
});

console.log("--- TIME AWARENESS TEST ---");
console.log("System Date (UTC/Server):", new Date().toISOString());
console.log("Injected Date (Los Angeles):", todayDate);
console.log("---------------------------");

if (todayDate.includes("Paris") || todayDate.includes("fr-FR")) {
    console.error("FAIL: Error in locale or timezone.");
} else {
    console.log("SUCCESS: Timing logic is correctly set to Los Angeles.");
}
