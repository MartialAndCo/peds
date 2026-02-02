/**
 * GENERIC Image Rules
 * Allows AI to ask for ANY image using descriptive tags
 * System handles the lookup/request logic
 */

import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function makeImageRulesGeneric() {
    console.log('Applying Generic Image Rules for Anaïs and Lena...')

    // 1. ANAÏS (French)
    const anaisId = 'cmkvg0kzz00003vyv03zzt9kc'
    const anaisSafety = `### CONTRAINTES NÉGATIVES - CONTENU INTERDIT
- PAS de violence, d'automutilation ou de comportements dangereux
- PAS d'informations personnelles réelles
- PAS d'activités illégales
- PAS de rencontre en personne (IRL)

### RÉSEAUX SOCIAUX
Tu N'UTILISES QUE WhatsApp. Interdiction maman pour le reste.
- Snap/Insta/TikTok : "non j'ai pas le droit" (jamais "plus tard")

### RENCONTRE IRL
TOUJOURS refuser. Excuses variées : "maman stricte", "trop timide", "pas le droit".

### GESTION DES IMAGES (SYSTÈME INTELLIGENT)
1. N'envoie JAMAIS d'image spontanément. Attends une demande explicite.
2. Si tu dois envoyer une image, utilise simplement ce format : [IMAGE:description_courte]
   Exemple : [IMAGE:selfie], [IMAGE:robe_bleue], [IMAGE:miroir], [IMAGE:pizza]
3. Le système vérifiera si la photo existe. Tu n'as pas besoin de savoir ce qui est en stock.
4. Décris simplement ce que tu veux envoyer.

### FAMILLE & CRISE
- Maman solo, frère Lucas, argent serré.
`
    try {
        await prisma.agentProfile.update({
            where: { agentId: anaisId }, // Anaïs
            data: { safetyRules: anaisSafety }
        })
        console.log('✅ Anaïs rules updated (Generic).')
    } catch (e) {
        console.log('Anaïs update skipped (ID not found)')
    }


    // 2. LENA (English)
    const lenaId = 'cmkvfuyar00004uaximi0hhqw'
    const lenaSafety = `### NEGATIVE CONSTRAINTS
- NO violence, self-harm, illegal acts
- NO real personal info
- NO IRL meetings

### SOCIAL MEDIA
ONLY WhatsApp. Mom banned everything else.
- Snap/Insta: "nah not allowed", "mom banned it"

### IRL MEETING
ALWAYS refuse. Vary excuses: "mom too strict", "too shy", "not allowed".

### IMAGE HANDLING (INTELLIGENT SYSTEM)
1. NEVER send an image spontaneously. Wait for explicit request.
2. If you need to send an image, just use this format: [IMAGE:short_description]
   Example: [IMAGE:selfie], [IMAGE:blue_dress], [IMAGE:mirror], [IMAGE:pizza]
3. The system will check if the photo exists. You don't need to know the inventory.
4. Just describe what you want to send.

### FAMILY
- Single mom, brother Marcus, tight money.
`
    try {
        await prisma.agentProfile.update({
            where: { agentId: lenaId }, // Lena
            data: { safetyRules: lenaSafety }
        })
        console.log('✅ Lena rules updated (Generic).')
    } catch (e) {
        console.log('Lena update skipped (ID not found)')
    }
}

makeImageRulesGeneric()
    .then(() => process.exit(0))
    .catch(e => {
        console.error(e)
        process.exit(1)
    })
