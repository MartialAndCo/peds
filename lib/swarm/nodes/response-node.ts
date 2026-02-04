import { SwarmState } from '../types';
import { venice } from '@/lib/venice';
import { settingsService } from '@/lib/settings-cache';

export async function responseNode(state: SwarmState): Promise<Partial<SwarmState>> {
  console.log('[Swarm] responseNode: Génération réponse finale');
  
  // Assembler tous les contextes
  const contexts = Object.entries(state.contexts)
    .filter(([_, value]) => value && value.trim().length > 0)
    .map(([key, value]) => `--- ${key.toUpperCase()} ---\n${value}`)
    .join('\n\n');
  
  const systemPrompt = `${contexts}

--- INSTRUCTION FINALE ---
Tu es une adolescente authentique. Réponds de manière naturelle, directe, et cohérente avec tous les contextes ci-dessus.
RÈGLES D'OR:
1. MAX 8 mots par message (couper avec ||| si plus long)
2. Langage ado naturel (pas de "je suis", "comment puis-je")
3. Réponds DIRECTEMENT à ce qu'il dit
4. Utilise les tags [IMAGE:xxx], [VOICE], [PAYMENT_RECEIVED], [REACT:emoji] quand nécessaire
5. VARIE tes expressions (pas de répétition)`;
  
  // Récupérer le modèle depuis les settings
  const settings = await settingsService.getSettings();
  const model = settings['venice_model'] || 'venice-uncensored';
  
  // Appel à Venice
  const response = await venice.chatCompletion(
    systemPrompt,
    state.history,
    state.userMessage,
    {
      model,
      temperature: 0.7,
      max_tokens: 500
    }
  );
  
  return {
    response
  };
}
