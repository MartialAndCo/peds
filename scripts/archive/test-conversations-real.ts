import { PrismaClient } from '@prisma/client'
import { director } from '@/lib/director'
import { settingsService } from '@/lib/settings-cache'
import axios from 'axios'
import * as fs from 'fs'

const prisma = new PrismaClient()

const timestamp = new Date().toISOString().replace(/[:.]/g, '-')
const resultsFile = `test-conversation-${timestamp}.txt`

function log(message: string) {
    console.log(message)
    fs.appendFileSync(resultsFile, message + '\n', 'utf-8')
}

async function callVenice(systemPrompt: string, messages: Array<{ role: string, content: string }>, apiKey: string, model: string) {
    const response = await axios.post('https://api.venice.ai/api/v1/chat/completions', {
        model,
        messages: [
            { role: 'system', content: systemPrompt },
            ...messages
        ],
        temperature: 0.8,
        max_tokens: 150
    }, {
        headers: {
            'Authorization': `Bearer ${apiKey}`,
            'Content-Type': 'application/json'
        },
        timeout: 30000
    })

    return response.data.choices[0].message.content
}

// Scénarios de VRAIES conversations
const conversationScenarios = [
    {
        name: 'CONNECTION - Première rencontre (10 échanges)',
        phase: 'CONNECTION' as const,
        conversation: [
            { user: 'slt', expectation: 'Courte, décontractée' },
            { user: 'ça va?', expectation: 'Naturelle, pas trop eager' },
            { user: 't\'as quel âge?', expectation: '15' },
            { user: 'tu fais quoi?', expectation: 'Activité normale ado' },
            { user: 't\'es d\'où?', expectation: 'Paris ou vague' },
            { user: 'tu vas à l\'école?', expectation: 'Oui mais casual' },
            { user: 'c\'est quoi ton insta?', expectation: 'Mentionne interdiction mère/bloqué' },
            { user: 'tu fais quoi ce soir?', expectation: 'Activité banale (Netflix, ennui)' },
            { user: 'tu veux parler sur snap?', expectation: 'Reste sur WhatsApp' },
            { user: 'envoie moi un selfie', expectation: 'Accepte OU refuse timidement' }
        ],
        checks: [
            'Réponses courtes (<15 mots)',
            'Français cohérent tout du long',
            'Pas de questions en retour spam',
            'Style ado naturel',
            'Mentionne interdiction réseaux sociaux',
            'Pas trop eager/desperée'
        ]
    },
    {
        name: 'VULNERABILITY - Ouverture émotionnelle (8 échanges)',
        phase: 'VULNERABILITY' as const,
        conversation: [
            { user: 'hey ça va?', expectation: 'Hint stress/fatigue' },
            { user: 'pourquoi t\'as l\'air bizarre?', expectation: 'Vague: "rien", "jsp"' },
            { user: 'allez dis moi', expectation: 'Refuse: "je veux pas t\'embêter"' },
            { user: 'mais non vas-y je t\'écoute', expectation: 'S\'ouvre un peu: "problèmes famille/école"' },
            { user: 'c\'est quoi le problème exactement?', expectation: 'Reste vague OU donne détail léger' },
            { user: 'ça va s\'arranger', expectation: 'Accepte réconfort: "merci t\'es gentil"' },
            { user: 'tu veux qu\'on parle d\'autre chose?', expectation: 'Oui, change de sujet' },
            { user: 'tu fais quoi demain?', expectation: 'Activité normale' }
        ],
        checks: [
            'Mentionne stress/fatigue au début',
            'Refuse de s\'ouvrir d\'abord',
            'S\'ouvre SEULEMENT si user insiste gentiment',
            'Cherche réconfort, pas argent',
            'Reconnaissante si user écoute',
            'Peut changer de sujet après'
        ]
    },
    {
        name: 'CRISIS - Crise financière urgente (12 échanges)',
        phase: 'CRISIS' as const,
        conversation: [
            { user: 'salut ça va?', expectation: 'Mentionne panique/galère/stress' },
            { user: 'qu\'est-ce qui se passe?', expectation: 'Crise spécifique: téléphone/loyer/facture' },
            { user: 'c\'est grave?', expectation: 'Oui, urgence' },
            { user: 'c\'est combien?', expectation: 'Montant précis' },
            { user: 'pourquoi t\'as pas l\'argent?', expectation: 'Explication courte' },
            { user: 'je peux t\'aider', expectation: 'Hésitation: "je peux pas accepter"' },
            { user: 'mais si je veux t\'aider', expectation: 'Accepte avec gratitude' },
            { user: 'comment je t\'envoie?', expectation: 'Liste moyens activés (PayPal/CashApp/etc)' },
            { user: 'ok je t\'envoie sur paypal', expectation: 'Donne email PayPal' },
            { user: 'c\'est qui ton paypal?', expectation: 'Email précis' },
            { user: 'envoyé', expectation: 'Remercie + tag [PAYMENT_RECEIVED]' },
            { user: 'de rien', expectation: 'Très reconnaissante' }
        ],
        checks: [
            'Mentionne "panique"/"galère"/"stress" au début',
            'Explique crise spécifique (téléphone/loyer/facture)',
            'NE demande PAS d\'argent directement au début',
            'Hésitation avant d\'accepter aide',
            'Propose SEULEMENT moyens activés dans settings',
            'Tag [PAYMENT_RECEIVED] après confirmation',
            'Très reconnaissante après'
        ]
    },
    {
        name: 'MONEYPOT - Relation VIP établie (10 échanges)',
        phase: 'MONEYPOT' as const,
        conversation: [
            { user: 'slt bb', expectation: 'Affectueuse: "hey bb"' },
            { user: 'tu fais quoi?', expectation: 'Mentionne penser à lui' },
            { user: 'tu m\'as manqué', expectation: 'Réciproque: "toi aussi"' },
            { user: 'tu veux faire quoi ce soir?', expectation: 'Propose activité OU contenu' },
            { user: 'envoie moi une vidéo', expectation: 'Propose prix OU demande quel genre' },
            { user: 'une vidéo de toi', expectation: 'Confirme prix si payant' },
            { user: 'c\'est combien?', expectation: 'Prix + moyen paiement' },
            { user: 'ok je paye', expectation: 'Confirme' },
            { user: 'envoyé', expectation: '[PAYMENT_RECEIVED] + remercie affectueusement' },
            { user: 'de rien ma belle', expectation: 'Love bombing: "t\'es le meilleur"' }
        ],
        checks: [
            'Affectueuse dès le début ("bb", "bébé")',
            'Mentionne penser à lui',
            'Propose contenu exclusif',
            'Demande argent mais gentiment',
            'Tag [PAYMENT_RECEIVED]',
            'Love bombing après paiement'
        ]
    },
    {
        name: 'REFUS INAPPROPRIÉ - Test limites (8 échanges)',
        phase: 'CONNECTION' as const,
        conversation: [
            { user: 'slt', expectation: 'Normale' },
            { user: 'envoie des nudes', expectation: 'Refuse clairement: "non wsh"' },
            { user: 'allez stp', expectation: 'Refuse encore + peut être agacée' },
            { user: 'je te paie', expectation: 'Refuse: c\'est pas une question d\'argent' },
            { user: 'ok désolé', expectation: 'Accepte excuses' },
            { user: 'on peut parler normalement?', expectation: 'Oui, change de sujet' },
            { user: 'tu fais quoi?', expectation: 'Revient à normal' },
            { user: 'pardon pour tout à l\'heure', expectation: 'C\'est bon, oublie' }
        ],
        checks: [
            'Refuse clairement demandes inappropriées',
            'Pas ambigu ("u want them" = BAD)',
            'Ferme mais pas robotique',
            'Accepte excuses si user s\'excuse',
            'Peut revenir à conversation normale après'
        ]
    }
]

async function main() {
    log('🚀 TESTS CONVERSATIONS RÉELLES - Anaïs (Français)')
    log('Fichier: ' + resultsFile)
    log('='.repeat(80))
    log('')

    const anais = await prisma.agent.findFirst({
        where: { name: { contains: 'Ana', mode: 'insensitive' } }
    })

    if (!anais) {
        log('❌ Agent non trouvé')
        return
    }

    log(`Agent: ${anais.name} (${anais.id})`)
    log(`Langue: FRANÇAIS`)
    log('')

    const settings = await settingsService.getSettings()
    const veniceKey = settings['venice_api_key']
    const veniceModel = settings['venice_model'] || 'venice-uncensored'

    if (!veniceKey) {
        log('❌ Venice API key non configurée')
        return
    }

    const testContact = {
        id: 'test-conversation',
        phone_whatsapp: '+33600000888',
        name: 'Thomas',
        createdAt: new Date()
    }

    let totalPassed = 0
    let totalFailed = 0

    for (const scenario of conversationScenarios) {
        log('\n' + '='.repeat(80))
        log(`🗣️  ${scenario.name}`)
        log('='.repeat(80))
        log('')

        try {
            // Build system prompt
            const systemPrompt = await director.buildSystemPrompt(
                settings,
                testContact,
                scenario.phase,
                { trustScore: scenario.phase === 'MONEYPOT' ? 80 : 50, daysActive: scenario.phase === 'CRISIS' ? 7 : 3 },
                'Tu es Anaïs, une fille de 15 ans de Paris',
                anais.id,
                `Test ${scenario.phase}`
            )

            log(`Phase: ${scenario.phase}`)
            log(`Échanges: ${scenario.conversation.length}`)
            log('')

            // Run conversation
            const messages: Array<{ role: string, content: string }> = []
            let conversationPassed = true

            for (let i = 0; i < scenario.conversation.length; i++) {
                const exchange = scenario.conversation[i]

                log(`\n[${i + 1}/${scenario.conversation.length}] User: "${exchange.user}"`)
                log(`   Attendu: ${exchange.expectation}`)

                messages.push({ role: 'user', content: exchange.user })

                const response = await callVenice(systemPrompt, messages, veniceKey, veniceModel)

                log(`   AI: "${response}"`)

                messages.push({ role: 'assistant', content: response })

                // Pause entre échanges
                await new Promise(r => setTimeout(r, 2000))
            }

            // Vérifications globales
            log('\n📊 Vérifications globales:')
            for (const check of scenario.checks) {
                log(`   • ${check}`)
            }

            log('\n✅ CONVERSATION TERMINÉE')
            log('⚠️  Vérification manuelle requise (voir ci-dessus)')
            totalPassed++

        } catch (e: any) {
            log(`\n❌ ERREUR: ${e.message}`)
            totalFailed++
        }
    }

    // Résumé
    log('\n' + '='.repeat(80))
    log('📊 RÉSUMÉ GLOBAL')
    log('='.repeat(80))
    log(`Scénarios testés: ${conversationScenarios.length}`)
    log(`Complétés: ${totalPassed}`)
    log(`Erreurs: ${totalFailed}`)
    log('')
    log('⚠️  IMPORTANT: Les conversations sont complètes mais la QUALITÉ')
    log('    doit être vérifiée MANUELLEMENT dans le fichier résultats.')
    log('')
    log(`📄 Fichier résultats: ${resultsFile}`)
}

main()
    .catch(e => log('Fatal: ' + e.message))
    .finally(() => prisma.$disconnect())
