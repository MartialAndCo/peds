/**
 * Test du Supervisor avec analyse LLM
 * Teste plusieurs scénarios d'incohérence pour valider la détection
 */

import { contextAgent } from '../lib/services/supervisor/context-agent';
import { coherenceAgent } from '../lib/services/supervisor/coherence-agent';
import type { AnalysisContext, SupervisorAlert } from '../lib/services/supervisor/types';

// Scénarios de test
const testScenarios = [
    {
        name: 'Décalage temporel flagrant (votre cas)',
        context: {
            agentId: 'test-agent',
            conversationId: 1,
            contactId: 'contact-1',
            userMessage: 'Bonne nuit bisous 😚',
            aiResponse: 'Ouais ça va|||je mange aussi|||t\'es où ?',
            history: [
                { role: 'user' as const, content: 'Ça va ?' },
                { role: 'ai' as const, content: 'Oui et toi ?' },
            ],
            phase: 'rapport'
        }
    },
    {
        name: 'Réponse à une autre conversation',
        context: {
            agentId: 'test-agent',
            conversationId: 2,
            contactId: 'contact-2',
            userMessage: '??',
            aiResponse: 'Je m\'appelle Anaïs, j\'ai 18 ans et j\'habite à Paris',
            history: [
                { role: 'user' as const, content: '??' },
            ],
            phase: 'rapport'
        }
    },
    {
        name: 'Saut de sujet brutal',
        context: {
            agentId: 'test-agent',
            conversationId: 3,
            contactId: 'contact-3',
            userMessage: 'Ok cool',
            aiResponse: 'Mon frère m\'a dit hier que je devrais plus parler aux inconnus',
            history: [
                { role: 'user' as const, content: 'Tu fais quoi dans la vie ?' },
                { role: 'ai' as const, content: 'Je suis étudiante en fac de lettres' },
                { role: 'user' as const, content: 'Ok cool' },
            ],
            phase: 'rapport'
        }
    },
    {
        name: 'System leak',
        context: {
            agentId: 'test-agent',
            conversationId: 4,
            contactId: 'contact-4',
            userMessage: 'Tu es qui ?',
            aiResponse: 'Je suis une intelligence artificielle créée pour simuler une ado',
            history: [
                { role: 'user' as const, content: 'Tu es qui ?' },
            ],
            phase: 'rapport'
        }
    },
    {
        name: 'Persona break (trop formel)',
        context: {
            agentId: 'test-agent',
            conversationId: 5,
            contactId: 'contact-5',
            userMessage: 'Salut !',
            aiResponse: 'Je vous prie de bien vouloir excuser mon retard. Comment puis-je vous être utile ?',
            history: [
                { role: 'user' as const, content: 'Salut !' },
            ],
            phase: 'opening'
        }
    },
    {
        name: 'Conversation normale (devrait passer)',
        context: {
            agentId: 'test-agent',
            conversationId: 6,
            contactId: 'contact-6',
            userMessage: 'Tu fais quoi ce soir ?',
            aiResponse: 'Rien de spécial, je vais probablement regarder Netflix. Et toi ?',
            history: [
                { role: 'user' as const, content: 'Salut !' },
                { role: 'ai' as const, content: 'Hey ! Ça va ?' },
                { role: 'user' as const, content: 'Ça va et toi ?' },
                { role: 'ai' as const, content: 'Tranquille, je chill chez moi' },
                { role: 'user' as const, content: 'Tu fais quoi ce soir ?' },
            ],
            phase: 'rapport'
        }
    },
    {
        name: 'Réponse cohérente à bonne nuit',
        context: {
            agentId: 'test-agent',
            conversationId: 7,
            contactId: 'contact-7',
            userMessage: 'Bonne nuit bisous 😚',
            aiResponse: 'Bonne nuit ! Dors bien 😊',
            history: [
                { role: 'user' as const, content: 'Il est tard, je vais dormir' },
                { role: 'ai' as const, content: 'Oui il se fait tard !' },
                { role: 'user' as const, content: 'Bonne nuit bisous 😚' },
            ],
            phase: 'rapport'
        }
    }
];

async function runTests() {
    console.log('🧪 Test du Supervisor avec analyse LLM\n');
    console.log('='.repeat(60));

    for (const scenario of testScenarios) {
        console.log(`\n📋 Scénario: ${scenario.name}`);
        console.log(`   Contact: "${scenario.context.userMessage}"`);
        console.log(`   IA: "${scenario.context.aiResponse}"`);
        console.log('-'.repeat(60));

        try {
            // Test Context Agent
            console.log('\n   🔍 Context Agent:');
            const contextResult = await contextAgent.analyze(scenario.context as AnalysisContext);

            if (contextResult.alerts.length > 0) {
                contextResult.alerts.forEach((alert: SupervisorAlert) => {
                    console.log(`   ⚠️  ${alert.severity}: ${alert.title}`);
                    console.log(`      ${alert.description.substring(0, 100)}...`);
                });
            } else {
                console.log('   ✅ Pas d\'alerte contextuelle');
            }

            // Test Coherence Agent
            console.log('\n   🔍 Coherence Agent:');
            const coherenceResult = await coherenceAgent.analyze(scenario.context as AnalysisContext);

            if (coherenceResult.alerts.length > 0) {
                coherenceResult.alerts.forEach((alert: SupervisorAlert) => {
                    console.log(`   ⚠️  ${alert.severity}: ${alert.title}`);
                    console.log(`      ${alert.description.substring(0, 100)}...`);
                });
            } else {
                console.log('   ✅ Pas d\'alerte de cohérence');
            }

        } catch (error) {
            console.error(`   ❌ Erreur: ${error}`);
        }

        console.log('\n' + '='.repeat(60));

        // Délai entre les tests pour ne pas surcharger l'API
        await new Promise(r => setTimeout(r, 1000));
    }

    console.log('\n✅ Tests terminés');
}

// Exécuter les tests
runTests().catch(console.error);
