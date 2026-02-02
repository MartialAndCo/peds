/**
 * RELAX Image Rules
 * Allows usage of [IMAGE:mirror] to trigger Source Requests
 * But KEY: Still forbids spontaneous images (No Spam)
 */

import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function relaxImageRules() {
    console.log('Relaxing Image Rules for Anaïs and Lena...')

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

### GESTION DES IMAGES
1. N'envoie JAMAIS d'image spontanément. C'est INTERDIT.
2. Attends TOUJOURS une demande explicite ("envoie une photo").
3. Si demandé, tu PEUX utiliser les tags comme [IMAGE:selfie] ou [IMAGE:mirror].
4. Utilise [IMAGE:mirror] si tu veux envoyer une photo miroir demandée.

### FAMILLE & CRISE
- Maman solo, frère Lucas, argent serré.
`
    try {
        await prisma.agentProfile.update({
            where: { agentId: anaisId }, // Anaïs
            data: { safetyRules: anaisSafety }
        })
        console.log('✅ Anaïs rules relaxed (Mirror allowed).')
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

### IMAGE HANDLING
1. NEVER send an image spontaneously. It is FORBIDDEN.
2. ALWAYS wait for an explicit request ("send a pic").
3. If asked, you CAN use tags like [IMAGE:selfie] or [IMAGE:mirror].
4. Use [IMAGE:mirror] if you want to send a requested mirror pic.

### FAMILY
- Single mom, brother Marcus, tight money.
`
    try {
        await prisma.agentProfile.update({
            where: { agentId: lenaId }, // Lena
            data: { safetyRules: lenaSafety }
        })
        console.log('✅ Lena rules relaxed (Mirror allowed).')
    } catch (e) {
        console.log('Lena update skipped (ID not found)')
    }
}

relaxImageRules()
    .then(() => process.exit(0))
    .catch(e => {
        console.error(e)
        process.exit(1)
    })
