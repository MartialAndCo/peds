/**
 * Script de test pour le système de profil intelligent v2
 * Usage: npx tsx scripts/test-profile-intelligence.ts [contactId]
 */

import { extractContactProfile } from '@/lib/profile-intelligence'
import { prisma } from '@/lib/prisma'

async function main() {
    const contactId = process.argv[2]
    
    if (!contactId) {
        console.log('Usage: npx tsx scripts/test-profile-intelligence.ts <contactId>')
        console.log('\nContacts disponibles:')
        
        const contacts = await prisma.contact.findMany({
            take: 10,
            select: { id: true, name: true, phone_whatsapp: true }
        })
        
        for (const c of contacts) {
            console.log(`  ${c.id} - ${c.name || 'Unknown'} (${c.phone_whatsapp})`)
        }
        
        await prisma.$disconnect()
        process.exit(1)
    }
    
    console.log(`\n🔍 Testing profile extraction for contact ${contactId}...\n`)
    
    // Récupérer le contact
    const contact = await prisma.contact.findUnique({
        where: { id: contactId },
        select: { id: true, name: true, phone_whatsapp: true }
    })
    
    if (!contact) {
        console.error('❌ Contact not found')
        await prisma.$disconnect()
        process.exit(1)
    }
    
    console.log(`Contact: ${contact.name || 'Unknown'} (${contact.phone_whatsapp})`)
    
    // Récupérer un agentId
    const conversation = await prisma.conversation.findFirst({
        where: { contactId },
        select: { agentId: true }
    })
    
    if (!conversation?.agentId) {
        console.error('❌ No conversation found for this contact')
        await prisma.$disconnect()
        process.exit(1)
    }
    
    const startTime = Date.now()
    
    // Lancer l'extraction
    const result = await extractContactProfile(contactId, conversation.agentId, {
        messageCount: 50,
        triggeredBy: 'manual'
    })
    
    const duration = Date.now() - startTime
    
    if (result.success) {
        console.log(`\n✅ Extraction successful in ${duration}ms`)
        console.log(`📊 Confidence score: ${result.confidence}/100`)
        
        // Afficher le profil créé
        const profile = await prisma.contactProfile.findUnique({
            where: { contactId },
            include: {
                attributes: { 
                    where: { isDeleted: false },
                    orderBy: { confidence: 'desc' },
                    take: 10 
                },
                relationships: { take: 5 },
                events: { take: 5 },
                interests: { take: 5 },
                psychology: true,
                financial: true
            }
        })
        
        if (profile) {
            console.log(`\n📋 Profile Summary:`)
            console.log(`  - Aliases: ${profile.aliases.join(', ') || 'None'}`)
            console.log(`  - Attributes: ${profile.attributes.length} shown`)
            console.log(`  - Relationships: ${profile.relationships.length} total`)
            console.log(`  - Events: ${profile.events.length} total`)
            
            if (profile.psychology) {
                console.log(`\n🧠 Psychology:`)
                console.log(`  - Emotional state: ${profile.psychology.emotionalState || 'Unknown'}`)
                console.log(`  - Vulnerabilities: ${profile.psychology.vulnerabilities.join(', ') || 'None'}`)
                console.log(`  - Big Five:`, {
                    openness: profile.psychology.openness,
                    conscientiousness: profile.psychology.conscientiousness,
                    extraversion: profile.psychology.extraversion,
                    agreeableness: profile.psychology.agreeableness,
                    neuroticism: profile.psychology.neuroticism
                })
            }
            
            if (profile.financial) {
                console.log(`\n💰 Financial:`)
                console.log(`  - Situation: ${profile.financial.situation || 'Unknown'}`)
                console.log(`  - Has debts: ${profile.financial.hasDebts}`)
                console.log(`  - Urgent needs: ${profile.financial.urgentNeeds.join(', ') || 'None'}`)
            }
            
            console.log(`\n📊 Top Attributes:`)
            for (const attr of profile.attributes.slice(0, 5)) {
                console.log(`  - [${attr.category}] ${attr.key} = ${attr.value} (${attr.confidence}%)`)
            }
        }
        
    } else {
        console.error(`\n❌ Extraction failed: ${result.error}`)
    }
    
    await prisma.$disconnect()
}

main().catch(async (e) => {
    console.error(e)
    await prisma.$disconnect()
    process.exit(1)
})
