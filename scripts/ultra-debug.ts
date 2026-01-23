/**
 * Ultra-detailed debug to see EXACTLY what's in the final prompt
 */

import { PrismaClient } from '@prisma/client';
import { director } from '../lib/director';
import { settingsService } from '../lib/settings-cache';

const prisma = new PrismaClient();

async function ultraDebug() {
    console.log('=== ULTRA DEBUG ===\n');

    const testContact = await prisma.contact.create({
        data: {
            phone_whatsapp: `+1555${Date.now().toString().slice(-7)}`,
            name: 'UltraDebug',
            source: 'Test',
            status: 'new',
            trustScore: 50,
            agentPhase: 'CONNECTION',
            createdAt: new Date()
        }
    });

    const settings = await settingsService.getSettings();
    const prompt = await prisma.prompt.findFirst({ where: { isActive: true } });

    const agentSettings = await prisma.agentSetting.findMany({ where: { agentId: 1 } });
    const mergedSettings = { ...settings };
    agentSettings.forEach(s => { mergedSettings[s.key] = s.value; });

    const { phase, details, reason } = await director.determinePhase(testContact.phone_whatsapp);

    const systemPrompt = await director.buildSystemPrompt(
        mergedSettings,
        testContact,
        phase,
        details,
        prompt!.system_prompt,
        1,
        reason
    );

    console.log('=== FULL SYSTEM PROMPT (first 5000 chars) ===');
    console.log(systemPrompt.substring(0, 5000));
    console.log('\n...\n');

    console.log('=== SEARCHING FOR KEY PHRASES ===');
    const searches = [
        'Current Age:',
        'Birthday:',
        'BIRTHDAY',
        '{{CURRENT_AGE}}',
        'Age: 15',
        'Age: {{CURRENT_AGE}}',
        '**2. CONTEXT**',
        '**YOUR PERSONAL INFO**'
    ];

    for (const search of searches) {
        const found = systemPrompt.includes(search);
        const index = systemPrompt.indexOf(search);
        console.log(`"${search}": ${found ? `✅ Found at position ${index}` : '❌ Not found'}`);

        if (found && index !== -1) {
            const snippet = systemPrompt.substring(index, Math.min(systemPrompt.length, index + 200));
            console.log(`  Snippet: ${snippet.substring(0, 150)}...`);
        }
    }

    await prisma.contact.delete({ where: { id: testContact.id } });
}

ultraDebug()
    .catch(e => console.error('Error:', e))
    .finally(async () => await prisma.$disconnect());
