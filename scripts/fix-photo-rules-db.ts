import { prisma } from '../lib/prisma'

async function fixPhotoRules() {
    console.log('Updating Agent Profiles with strict photo rules...\n')
    
    // Nouvelle règle stricte pour les photos à ajouter dans tous les templates
    const strictPhotoRule = `

🚫 RÈGLE ULTRA STRICTE - PHOTOS:
- INTERDICTION TOTALE d'envoyer [IMAGE:...] sans demande EXPLICITE
- "J'aime la photo" / "Je prends des photos" / "Nature pics" = HOBBY, pas une demande
- "Tu as des photos ?" = question, PAS une demande de recevoir
- SEULEMENT quand il dit EXPLICITEMENT: "envoie-moi une photo", "montre-toi", "je veux te voir"
- Si tu doutes → N'ENVOIE PAS DE PHOTO
- Réagis normalement aux hobbies, n'envoie pas de photo en réponse
`

    const strictPhotoRuleEN = `

🚫 ULTRA STRICT RULE - PHOTOS:
- TOTAL FORBIDDEN to send [IMAGE:...] without EXPLICIT request
- "I like photos" / "I take pictures" / "Nature pics" = HOBBY, not a request
- "Do you have photos?" = question, NOT a request to receive
- ONLY when he EXPLICITLY says: "send me a pic", "show me", "let me see you"
- If unsure → DO NOT SEND PHOTO
- React normally to hobbies, don't send photo as reply
`
    
    const profiles = await prisma.agentProfile.findMany()
    
    for (const profile of profiles) {
        console.log(`Updating profile for agent: ${profile.agentId}`)
        
        let updates: any = {}
        
        // Update safety rules if exists
        if (profile.safetyRules) {
            // Remove old photo rules if exists
            let newSafety = profile.safetyRules
                .replace(/🚫.*?PHOTOS.*?:[\s\S]*?(?=🚫|$)/gi, '')
                .replace(/\n{3,}/g, '\n\n')
            
            // Add strict rule at the end
            newSafety += profile.locale?.startsWith('fr') ? strictPhotoRule : strictPhotoRuleEN
            updates.safetyRules = newSafety
        }
        
        // Update style rules too
        if (profile.styleRules) {
            let newStyle = profile.styleRules
                .replace(/🚫.*?PHOTOS.*?:[\s\S]*?(?=🚫|$)/gi, '')
                .replace(/\n{3,}/g, '\n\n')
            
            newStyle += profile.locale?.startsWith('fr') ? strictPhotoRule : strictPhotoRuleEN
            updates.styleRules = newStyle
        }
        
        if (Object.keys(updates).length > 0) {
            await prisma.agentProfile.update({
                where: { id: profile.id },
                data: updates
            })
            console.log('  ✅ Updated')
        } else {
            console.log('  ⚠️  No rules to update')
        }
    }
    
    console.log('\n✅ All profiles updated with strict photo rules')
}

fixPhotoRules().catch(console.error)
