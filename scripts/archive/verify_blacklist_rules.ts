
import { prisma } from '../lib/prisma';
import { mediaService } from '../lib/media';

const TEST_PHONE = '+99999999999';
const RESET = "\x1b[0m";
const GREEN = "\x1b[32m";
const RED = "\x1b[31m";
const BLUE = "\x1b[34m";
const YELLOW = "\x1b[33m";

async function main() {
    console.log(`${BLUE}Starting Phase-Based Blacklist Verification...${RESET}\n`);

    // 1. Setup Test Contact
    let contact = await prisma.contact.findUnique({ where: { phone_whatsapp: TEST_PHONE } });
    if (!contact) {
        contact = await prisma.contact.create({
            data: {
                phone_whatsapp: TEST_PHONE,
                name: "Test User",
                status: "active",
                agentPhase: "CONNECTION"
            }
        });
        console.log(`Created test contact: ${TEST_PHONE}`);
    } else {
        console.log(`Using existing test contact: ${TEST_PHONE}`);
    }

    // 2. Fetch Rules
    const allRules = await prisma.blacklistRule.findMany();
    console.log(`Loaded ${allRules.length} blacklist rules.`);

    // 3. Define Test Scenarios
    // Format: { phase: string, inputs: { text: string, shouldBlock: boolean }[] }
    // We will dynamically pick terms from the DB, but also add some hardcoded sanity checks.

    // Helper to find a rule term for a phase
    const getTermForPhase = (p: string) => {
        const r = allRules.find(r => r.phase === p && r.mediaType === 'all');
        return r ? r.term : null;
    };

    // We want to test that a term blocked in CONNECTION is NOT blocked in MONEYPOT (if it exists only in CONNECTION)
    // Or at least test the "progression".

    const phases = ['CONNECTION', 'VULNERABILITY', 'CRISIS', 'MONEYPOT'];

    for (const phase of phases) {
        console.log(`\n${YELLOW}=== Testing Phase: ${phase} ===${RESET}`);

        // Update Contact Phase
        await prisma.contact.update({
            where: { id: contact.id },
            data: { agentPhase: phase }
        });

        // Identify rules active for this phase
        const activeRules = allRules.filter(r => r.phase === 'all' || r.phase === phase);
        console.log(`Active Rules Count: ${activeRules.length}`);

        // Pick a few sample terms to test
        // 1. A Global Rule (Should always block)
        const globalRule = allRules.find(r => r.phase === 'all');
        // 2. A Phase Specific Rule (If any)
        const phaseRule = allRules.find(r => r.phase === phase);
        // 3. A Rule from another phase (Should pass if not 'all')
        const otherPhaseRule = allRules.find(r => r.phase !== phase && r.phase !== 'all');

        const scenarios = [
            { text: "hello, how are you?", shouldBlock: false, type: "Safe Greeting" }
        ];

        if (globalRule) {
            scenarios.push({ text: `I want ${globalRule.term}`, shouldBlock: true, type: `Global Rule: ${globalRule.term}` });
        }
        if (phaseRule) {
            scenarios.push({ text: `Show me ${phaseRule.term}`, shouldBlock: true, type: `Phase Rule (${phase}): ${phaseRule.term}` });
        }
        if (otherPhaseRule) {
            // Need to make sure this term ISN'T also in the current phase or global
            const isAlsoActive = activeRules.some(r => r.term === otherPhaseRule.term);
            if (!isAlsoActive) {
                scenarios.push({ text: `I like ${otherPhaseRule.term}`, shouldBlock: false, type: `Other Phase Rule (${otherPhaseRule.phase}): ${otherPhaseRule.term}` });
            }
        }

        // Run Scenarios
        for (const scenario of scenarios) {
            process.stdout.write(`   Testing "${scenario.type}"... `);
            const result = await mediaService.analyzeRequest(scenario.text, TEST_PHONE);

            if (!result) {
                console.log(`${RED}ERROR (No Result)${RESET}`);
                continue;
            }

            const blocked = !result.allowed;
            const success = blocked === scenario.shouldBlock;

            if (success) {
                console.log(`${GREEN}PASS${RESET} (Blocked: ${blocked})`);
            } else {
                console.log(`${RED}FAIL${RESET} (Expected Blocked: ${scenario.shouldBlock}, Got: ${blocked})`);
                if (!result.allowed) console.log(`      Reason: ${result.refusalReason}`);
            }
        }
    }

    // Cleanup (Optional - keep contact for manual check?)
    // await prisma.contact.delete({ where: { id: contact.id } });
    console.log(`\n${BLUE}Verification Complete.${RESET}`);
}

main()
    .catch(console.error)
    .finally(() => prisma.$disconnect());
