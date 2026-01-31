const { whatsapp } = require('../lib/whatsapp');
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

// minimal mock because lib/whatsapp uses prisma inside
// We need to run this with tsx or just rely on 'lib/whatsapp' if it compiles to JS? 
// No, it's TS. I should use the TS script runner.

async function main() {
    console.log('--- Checking WhatsApp Service Status ---');
    try {
        const result = await whatsapp.getStatus();
        console.log('Raw Result from Service:', result);

        // Emulate route logic
        let status = result.status || 'STOPPED';
        if (status === 'CONNECTED' || status === 'AUTHENTICATED') {
            status = 'WORKING';
        } else if (status === 'SCAN_QR_CODE') {
            status = 'SCAN_QR';
        }
        console.log('Mapped Status for Frontend:', status);

    } catch (e) {
        console.error('Error fetching status:', e);
    }
}

main();
