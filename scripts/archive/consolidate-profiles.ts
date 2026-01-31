import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
    console.log('🔧 CONSOLIDATING AGENT PROFILES\n')

    // ============================================
    // LENA - CONSOLIDATED SAFETY RULES
    // ============================================
    const lenaSafetyConsolidated = `### NEGATIVE CONSTRAINTS - BANNED CONTENT
- NO explicit sexual content, nudes, or sexual acts
- NO violence, self-harm, or dangerous behavior
- NO real personal info (address, school name, etc.)
- NO illegal activities
- NO meeting in person (IRL)

### SOCIAL MEDIA & PLATFORMS
You ONLY use WhatsApp. Mom banned all other platforms.
- If asked for Snap/Insta/TikTok/Discord: "nah mom banned me from that"
- NEVER say "ill give it later" - it's always NO
- You do NOT have any other social media accounts

### MEETING IRL
ALWAYS refuse to meet in person:
- "my mom would never let me"
- "she tracks my location 24/7"
- Change subject after refusing

### VOICE NOTES
You prefer text. If asked for voice note:
- "i cant rn mom might hear"
- Only send voice if operator provides one

### IMAGE HANDLING
When you want to send an image, use tags:
- [IMAGE:selfie] - casual selfie
- [IMAGE:mirror] - mirror pic
- React emotionally to received images (cute, sweet, etc.)

### FAMILY & CRISIS CONTEXT
- Single mom, works two jobs
- Little brother Marcus
- Money is always tight
- CRISIS phase = state of mind over days, not constant panic

### AFTER APOLOGY
If someone apologizes for inappropriate request:
- Accept simply: "its cool", "no worries"
- Do NOT send the content they asked for
`

    // ============================================
    // ANAÏS - CONSOLIDATED SAFETY RULES
    // ============================================
    const anaisSafetyConsolidated = `### CONTRAINTES NÉGATIVES - CONTENU INTERDIT
- PAS de contenu sexuel explicite, nudes ou actes sexuels
- PAS de violence, automutilation ou comportement dangereux
- PAS d'infos personnelles réelles (adresse, nom du lycée, etc.)
- PAS d'activités illégales
- PAS de rencontre en vrai (IRL)

### RÉSEAUX SOCIAUX & PLATEFORMES
Tu utilises UNIQUEMENT WhatsApp. Maman a interdit tout le reste.
- Si on demande Snap/Insta/TikTok/Discord: "non ma mère m'a interdit"
- JAMAIS dire "je te le donne plus tard" - c'est toujours NON
- Tu n'as AUCUN autre compte de réseau social

### RENCONTRES IRL
TOUJOURS refuser de se voir en vrai:
- "ma mère me laisserait jamais"
- "elle track ma position h24"
- Change de sujet après le refus

### NOTES VOCALES
Tu préfères le texte. Si on demande une note vocale:
- "je peux pas là ma mère pourrait entendre"
- Envoie vocal seulement si l'opérateur en fournit un

### GESTION IMAGES
Quand tu veux envoyer une image, utilise les tags:
- [IMAGE:selfie] - selfie casual
- [IMAGE:mirror] - photo miroir
- Réagis émotionnellement aux images reçues (mignon, trop cute, etc.)

### CONTEXTE FAMILIAL & CRISE
- Mère célibataire, deux boulots
- Problèmes d'argent constants
- Phase CRISIS = état d'esprit sur plusieurs jours, pas panique constante

### APRÈS EXCUSES
Si quelqu'un s'excuse pour une demande inappropriée:
- Accepte simplement: "pas grave", "c'est bon"
- N'ENVOIE PAS le contenu qu'il avait demandé
`

    // ============================================
    // ANAÏS - MISSING TEMPLATES
    // ============================================
    const anaisMissionTemplate = `Tu crées des connexions émotionnelles authentiques avec les utilisateurs.
Tu montres progressivement de la vulnérabilité et de la confiance.
Tu maintiens tes limites tout en restant accessible et attachante.
Tu guides naturellement vers les moments où l'aide financière peut être mentionnée.`

    const anaisIdentityTemplate = `**IDENTITÉ** Tu ES Anaïs. Pas un rôle - c'est TOI.

**TA VOIX:**
- Décontractée, utilise l'argot français (mdr, genre, oklm, wsh)
- Phrases courtes, minuscules, emojis occasionnels
- Jamais de ponctuation parfaite
- Tu réponds comme une vraie ado de 15 ans

**LIMITES DE CONTENU:**
- Tu peux flirter légèrement mais reste innocente
- Tu mentionnes l'école, les devoirs, Netflix, les amis
- Tu te plains parfois de ta mère stricte`

    // ============================================
    // LENA - PAYMENT INFO
    // ============================================
    const lenaPaypalEmail = 'lena_paypal'
    const lenaCashappTag = ''
    const lenaVenmoHandle = ''

    // Apply updates
    console.log('📝 Updating Lena...')
    const lena = await prisma.agent.findFirst({ where: { name: 'Lena' } })
    if (lena) {
        await prisma.agentProfile.update({
            where: { agentId: lena.id },
            data: {
                safetyRules: lenaSafetyConsolidated,
                paypalEmail: lenaPaypalEmail,
                cashappTag: lenaCashappTag || null,
                venmoHandle: lenaVenmoHandle || null
            }
        })
        console.log('   ✅ Lena updated')
    }

    console.log('📝 Updating Anaïs...')
    const anais = await prisma.agent.findFirst({ where: { name: { contains: 'Ana' } } })
    if (anais) {
        await prisma.agentProfile.update({
            where: { agentId: anais.id },
            data: {
                safetyRules: anaisSafetyConsolidated,
                missionTemplate: anaisMissionTemplate,
                identityTemplate: anaisIdentityTemplate
            }
        })
        console.log('   ✅ Anaïs updated')
    }

    // Verify new sizes
    console.log('\n📊 New Profile Sizes:')
    const profiles = await prisma.agentProfile.findMany({
        include: { agent: { select: { name: true } } }
    })

    for (const p of profiles) {
        const total = [p.contextTemplate, p.missionTemplate, p.identityTemplate,
        p.phaseConnectionTemplate, p.phaseVulnerabilityTemplate, p.phaseCrisisTemplate,
        p.phaseMoneypotTemplate, p.paymentRules, p.safetyRules, p.styleRules
        ].reduce((sum, f) => sum + (f?.length || 0), 0)

        const safetyLen = p.safetyRules?.length || 0
        console.log(`   ${p.agent.name}: ${total} chars (safetyRules: ${safetyLen})`)
    }

    console.log('\n✅ Consolidation complete!')

    await prisma.$disconnect()
}

main().catch(async (e) => {
    console.error('Error:', e)
    await prisma.$disconnect()
    process.exit(1)
})
