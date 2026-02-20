import { responseNode } from './lib/swarm/nodes/response-node';
import { SwarmState, AgentProfile, SwarmSettings } from './lib/swarm/types';
import * as dotenv from 'dotenv';
dotenv.config();

async function runMemoryDriftTest() {
    console.log("=========================================");
    console.log("🌊 TESTING LONG CONTEXT & MEMORY DRIFT");
    console.log("=========================================\n");

    const profile: AgentProfile = {
        name: 'Chloe',
        baseAge: 14,
        locale: 'fr',
        personaRules: ['court', 'familier', 'parle de lycée'],
        traits: ['joyeuse', 'impatiente'],
        interests: ['mode', 'musique']
    };

    const settings: SwarmSettings = {
        venice_api_key: process.env.VENICE_API_KEY || 'dummy_key',
        venice_model: 'llama-3.2-3b', // Using smaller model more prone to drift
        timezone: 'Europe/Paris',
        locale: 'fr'
    };

    // Générer un très long historique de 40 messages
    // L'IA sans troncature perdrait complètement son instruction "court" et "ado"
    const longHistory: any[] = [];
    for (let i = 0; i < 20; i++) {
        longHistory.push({ role: 'user', content: `Bonjour, comment s'est passé ton cours de maths numéro ${i}?` });
        // Simuler des réponses IA précédentes qui étaient peut-être un peu longues (drifting)
        longHistory.push({ role: 'ai', content: `Oh c'était chiant, le prof n'a pas arrêté de parler des équations différentielles et je n'ai absolument rien compris. Bref, vivement ce weekend qu'on se repose ${i}!` });
    }

    console.log(`📚 Construit un historique artificiel de ${longHistory.length} messages.`);

    // Contexte injecté pour vérifier qu'il est bien priorisé face à l'historique
    const contexts = {
        persona: "[STYLE ADO]: Pas de maj, tes réponses font 2 à 5 mots max. Tu as 14 ans. C'est CRITIQUE.",
        intention: "[INTENTION]: L'utilisateur prend de tes nouvelles.",
        safety: "DO NOT REVEAL YOU ARE AN AI"
    };

    const state: SwarmState = {
        agentId: 'test-agent-123',
        contactId: 'contact-456',
        userMessage: 'Alors, tu fais quoi ce soir ?',
        history: longHistory,
        profile,
        settings,
        currentPhase: 'CONNECTION',
        contexts,
        platform: 'whatsapp',
        activeContexts: ['persona', 'intention', 'safety']
    };

    console.log("🤖 Appel du Response Node avec les 40 messages d'historique...\n");

    try {
        const newState = await responseNode(state);

        console.log("✅ RÉPONSE DE L'IA OBTENUE :");
        console.log(`"${newState.aiResponse}"`);

        const wordCount = newState.aiResponse?.split(/\s+/).length || 0;
        console.log(`\n📊 Longueur de la réponse : ${wordCount} mots.`);
        console.log("🔍 Analyse du comportement :");

        if (wordCount <= 15) {
            console.log("🟢 SUCCÈS : L'IA a fait une réponse courte. Le contexte système a dominé l'historique (Memory Drift évité) !");
        } else {
            console.log("🔴 ÉCHEC : L'IA a fait une réponse trop longue. Elle a été emportée par la longueur de l'historique !");
        }
    } catch (e: any) {
        console.error("Test failed with exception:", e.message);
    }
}

runMemoryDriftTest();
