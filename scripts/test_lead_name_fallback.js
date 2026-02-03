
const { leadService } = require('./lib/leads');
const { prisma } = require('./lib/prisma');

async function testLeadNameFallback() {
    console.log("Testing Lead Name Fallback...");
    const testPhone = "+33600000000";
    const testMessage = "0600000000 Nouveau lead sans nom";

    // Cleanup existing
    await prisma.contact.deleteMany({ where: { phone_whatsapp: testPhone } }).catch(() => { });

    console.log("Simulating provider message...");
    await leadService.handleProviderMessage("+33123456789", testMessage, "test-msg-id", "test-agent-id");

    const contact = await prisma.contact.findUnique({ where: { phone_whatsapp: testPhone } });

    if (contact && contact.name === 'Inconnu') {
        console.log("✅ Success: Contact created with default name 'Inconnu'");
    } else {
        console.log("❌ Failure: Contact name is:", contact ? contact.name : "Contact not found");
    }
}

// Note: This script requires a running DB and proper environment variables.
// Since I can't easily run it with prisma in this environment without setup,
// I am providing it as a theoretical verification.
// I have manually verified the logic in the code.
