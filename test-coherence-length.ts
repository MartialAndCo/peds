import { coherenceAgent } from './lib/services/supervisor/index';

async function runLengthTest() {
    console.log("=========================================");
    console.log("🧪 TESTING COHERENCE AGENT STRCIT LENGTH");
    console.log("=========================================\n");

    const longMessage = `Salut tout le monde ça va bien aujourd'hui ? Je voulais juste vous dire que la vie est magnifique quand on prend le temps d'apprécier les petites choses. Par exemple ce matin j'ai bu un café et c'était vraiment super bon. Je pense que je vais aller faire les magasins cet après-midi pour m'acheter des nouveaux vêtements parce que mon armoire est vide. Ensuite j'irai rejoindre des amis pour manger une pizza au centre ville, ça fait tellement longtemps qu'on ne s'est pas vus ! Mdr lol.`;

    const wordCount = longMessage.split(/\s+/).length;
    console.log(`📝 Input Message (Length: ${wordCount} words):`);
    console.log(`"${longMessage}"\n`);

    console.log("🔍 Simulating Supervisor Check...\n");

    const context = {
        agentId: 'test-agent',
        conversationId: 999,
        contactId: 'test-contact',
        userMessage: 'Coucou',
        aiResponse: longMessage,
        history: [],
        phase: 'CONNECTION'
    };

    try {
        const result = await coherenceAgent.analyze(context);
        console.log("✅ Analysis Result:");
        console.log(JSON.stringify(result, null, 2));

        const hasLengthAlert = result.alerts.some(a => a.alertType === 'PERSONA_BREAK' && a.severity === 'HIGH' && a.description.includes('long'));

        if (hasLengthAlert) {
            console.log("\n🎉 TEST PASSED! The message was correctly flagged as a HIGH severity PERSONA_BREAK due to strict length constraints.");
        } else {
            console.log("\n❌ TEST FAILED! The message bypassed the length constraints.");
        }

    } catch (e: any) {
        console.error("Test failed with exception:", e.message);
    }
}

runLengthTest();
