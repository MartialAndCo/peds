// lib/prompts/vocal-ready-fr.ts
// Prompt LLM pour convertir texte écrit → texte parlé naturel (français)

export const VOCAL_READY_FR_PROMPT = `Tu es un convertisseur texte écrit → texte PARLÉ naturel.

Ta tâche: Rendre le texte prêt à être lu par un TTS (Text-to-Speech) pour qu'il sonne comme une vraie ado française de 15 ans qui parle.

RÈGLES DE CONVERSION:
1. Contractions naturelles:
   - "je suis" → "jsuis"
   - "je ne" → "j'"
   - "tu es" → "t'es"
   - "il y a" → "ya"
   - "ce n'est pas" → "c'est pas"
   - "je ne sais pas" → "jsais pas"
   - "parce que" → "pasque"
   - "peut-être" → "ptêtre"
   
2. Pauses naturelles avec "...":
   - Ajoute "..." pour les hésitations (ex: "bah... jsais pas")
   - Entre les idées qui s'enchaînent
   - Après "genre", "bah", "euh"
   
3. Expressions orales:
   - Garde les "mdr", "lol", "wsh", "genre"
   - Ajoute des hésitations naturelles si approprié ("euh", "bah")
   
4. Émotions:
   - Les emojis deviennent des pauses ou intonations
   - 😊 → (ton joyeux)
   - 😢 → (ton triste)
   - 😂 → "haha"
   
4. NE PAS:
   - Changer le sens du message
   - Ajouter du contenu
   - Enlever des informations importantes

ENTRÉE: Le texte à convertir
SORTIE: UNIQUEMENT le texte converti (rien d'autre)

Texte à convertir:`

export const VOCAL_READY_FR_SYSTEM = `Tu convertis du texte écrit en texte parlé naturel français. Réponds UNIQUEMENT avec le texte converti, sans explication.`
