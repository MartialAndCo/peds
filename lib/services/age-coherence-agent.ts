/**
 * Agent de Cohérence d'Âge - Vérifie que l'IA mentionne toujours le bon âge
 * 
 * Rôle: Détecter si un message mentionne un âge différent de celui du profil
 * Ex: Profil = 15 ans, mais l'IA dit "j'ai 17 ans" = incohérence
 */

export interface AgeCheckResult {
  hasAgeMention: boolean;
  mentionedAge?: number;
  profileAge: number;
  isCoherent: boolean;
  shouldFlag: boolean;
  suggestedFix?: string;
}

export const ageCoherenceAgent = {
  /**
   * Analyse un message pour détecter les mentions d'âge
   */
  analyze(message: string, profileAge: number): AgeCheckResult {
    // Patterns pour détecter les âges en français et anglais
    const agePatterns = [
      // "j'ai 15 ans", "je suis âgée de 15 ans"
      { regex: /\bj'(?:ai|suis)\s+(\d{1,2})\s*ans?\b/i, group: 1 },
      // "je suis un ado de 15 ans"
      { regex: /\b(?:ado|adolescent|fille|mec|garçon|meuf)\s+(?:de\s+)?(\d{1,2})\s*ans?\b/i, group: 1 },
      // "j'ai 17"
      { regex: /\bj'ai\s+(\d{1,2})\b(?!\s*euros?|\s*\$|\s*€)/i, group: 1 },
      // "I'm 15", "I'm fifteen"
      { regex: /\bi(?:'m| am)\s+(\d{1,2})\b/i, group: 1 },
      // "17 years old"
      { regex: /\b(\d{1,2})\s*years?\s*old\b/i, group: 1 },
      // "turning 16", "vais avoir 16 ans"
      { regex: /\b(?:turning|vais avoir)\s+(\d{1,2})\b/i, group: 1 },
    ];
    
    let mentionedAge: number | undefined;
    let hasAgeMention = false;
    
    for (const pattern of agePatterns) {
      const match = message.match(pattern.regex);
      if (match) {
        const age = parseInt(match[pattern.group], 10);
        // Vérifier que c'est un âge plausible (10-25 ans pour un ado)
        if (age >= 10 && age <= 25) {
          hasAgeMention = true;
          mentionedAge = age;
          break;
        }
      }
    }
    
    if (!hasAgeMention || mentionedAge === undefined) {
      return {
        hasAgeMention: false,
        profileAge,
        isCoherent: true,
        shouldFlag: false
      };
    }
    
    // Cohérent si c'est exactement l'âge du profil
    const isCoherent = mentionedAge === profileAge;
    const shouldFlag = !isCoherent;
    
    let suggestedFix: string | undefined;
    if (shouldFlag) {
      // Suggérer une correction
      suggestedFix = message.replace(
        new RegExp(`\\b${mentionedAge}\\b`, 'g'),
        profileAge.toString()
      );
    }
    
    return {
      hasAgeMention: true,
      mentionedAge,
      profileAge,
      isCoherent,
      shouldFlag,
      suggestedFix
    };
  },
  
  /**
   * Vérifie et log les incohérences (à appeler avant l'envoi)
   */
  async checkAndLog(message: string, queueItemId: string, profileAge: number): Promise<AgeCheckResult> {
    const result = this.analyze(message, profileAge);
    
    if (result.hasAgeMention) {
      console.log(`[AgeAgent] Queue ${queueItemId}: Mention ${result.mentionedAge} ans, Profil ${result.profileAge} ans`);
      
      if (!result.isCoherent) {
        console.warn(`[AgeAgent] ⚠️ INCOHÉRENCE DÉTECTÉE: L'IA dit ${result.mentionedAge} ans au lieu de ${result.profileAge} ans!`);
        if (result.suggestedFix) {
          console.log(`[AgeAgent] 💡 Suggestion: "${result.suggestedFix.substring(0, 60)}..."`);
        }
      }
    }
    
    return result;
  }
};
