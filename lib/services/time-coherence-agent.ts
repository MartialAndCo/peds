/**
 * Agent Temporel - Vérifie la cohérence des mentions d'heure dans les messages
 * 
 * Rôle: Détecter si un message mentionne une heure qui ne correspond pas à l'heure d'envoi réelle
 * Ex: "Il est 20h" généré à 20h00 mais envoyé à 20h30 = dissonance temporelle
 */

export interface TimeCheckResult {
  hasTimeMention: boolean;
  mentionedHour?: number;
  currentHour: number;
  isCoherent: boolean;
  differenceMinutes: number;
  shouldRewrite: boolean;
  suggestedFix?: string;
}

export const timeCoherenceAgent = {
  /**
   * Analyse un message pour détecter les mentions d'heure
   */
  analyze(message: string, targetSendTime: Date = new Date()): TimeCheckResult {
    const now = targetSendTime;
    const currentHour = now.getHours();
    const currentMinute = now.getMinutes();
    
    // Patterns pour détecter les heures en français et anglais
    const hourPatterns = [
      // Pattern 1: "il est 20h", "il est 8h", "il est 20h30" (sans am/pm ni période)
      { regex: /il\s+est\s+(\d{1,2})\s*h(?:\s*(\d{2}))?(?!\s*(?:du\s+)?(?:soir|matin|après-midi|am|pm))/i, groupHour: 1, groupMin: 2, groupPeriod: null },
      // Pattern 2: "déjà 20h" (sans période)
      { regex: /déjà\s+(\d{1,2})\s*h(?!\s*(?:du\s+)?(?:soir|matin|après-midi))/i, groupHour: 1, groupMin: null, groupPeriod: null },
      // Pattern 3: "8h du soir", "8h du matin" (AVEC période)
      { regex: /(\d{1,2})\s*h\s+(?:du\s+)?(soir|matin|après-midi)/i, groupHour: 1, groupMin: null, groupPeriod: 2 },
      // Pattern 4: "20 heures", "8 heures"
      { regex: /(\d{1,2})\s+heures?\b(?!\s*(?:du\s+)?(?:soir|matin|après-midi))/i, groupHour: 1, groupMin: null, groupPeriod: null },
      // Pattern 5: "8pm", "8am", "20:00", "8:30" (AVEC am/pm)
      { regex: /(\d{1,2}):?(\d{2})?\s*(am|pm)?\b/i, groupHour: 1, groupMin: 2, groupPeriod: 3 },
      // Pattern 6: "ce soir à 20h", "cet après-midi à 15h"
      { regex: /(?:soir|après-midi|matin)\s+à\s+(\d{1,2})\s*h/i, groupHour: 1, groupMin: null, groupPeriod: null },
    ];
    
    let mentionedHour: number | undefined;
    let mentionedMinute: number = 0;
    let hasTimeMention = false;
    
    for (const pattern of hourPatterns) {
      const match = message.match(pattern.regex);
      if (match) {
        hasTimeMention = true;
        let hour = parseInt(match[pattern.groupHour], 10);
        const minute = pattern.groupMin && match[pattern.groupMin] ? parseInt(match[pattern.groupMin], 10) : 0;
        const period = pattern.groupPeriod && match[pattern.groupPeriod] ? match[pattern.groupPeriod].toLowerCase() : null;
        
        // Ajuster pour AM/PM
        if (period === 'pm' && hour < 12) hour += 12;
        if (period === 'am' && hour === 12) hour = 0;
        
        // Ajuster pour "du soir" (si heure < 12, ajouter 12)
        if (period === 'soir' && hour < 12) hour += 12;
        
        mentionedHour = hour;
        mentionedMinute = minute;
        break;
      }
    }
    
    if (!hasTimeMention || mentionedHour === undefined) {
      return {
        hasTimeMention: false,
        currentHour,
        isCoherent: true,
        differenceMinutes: 0,
        shouldRewrite: false
      };
    }
    
    // Calculer la différence en minutes
    const mentionedTimeInMinutes = mentionedHour * 60 + mentionedMinute;
    const currentTimeInMinutes = currentHour * 60 + currentMinute;
    const differenceMinutes = Math.abs(currentTimeInMinutes - mentionedTimeInMinutes);
    
    // Cohérent si différence < 10 minutes (tolérance)
    const isCoherent = differenceMinutes < 10;
    const shouldRewrite = !isCoherent && differenceMinutes > 30; // Réécrire si > 30 min d'écart
    
    let suggestedFix: string | undefined;
    if (shouldRewrite) {
      // Suggérer une correction (enlever la mention d'heure précise)
      suggestedFix = this.generateFix(message, mentionedHour, mentionedMinute, now);
    }
    
    return {
      hasTimeMention: true,
      mentionedHour,
      currentHour,
      isCoherent,
      differenceMinutes,
      shouldRewrite,
      suggestedFix
    };
  },
  
  /**
   * Génère une version corrigée du message sans l'heure incohérente
   */
  generateFix(message: string, oldHour: number, oldMinute: number, now: Date): string {
    // Supprimer les patterns d'heure précise
    let fixed = message
      .replace(/il\s+est\s+\d{1,2}\s*h(?:\s*\d{2})?/gi, '')
      .replace(/déjà\s+\d{1,2}\s*h/gi, 'déjà')
      .replace(/\d{1,2}\s*h\s+(?:du\s+)?(?:soir|matin|après-midi)/gi, '')
      .replace(/\d{1,2}\s+heures?/gi, '')
      .replace(/\s+/g, ' ')
      .trim();
    
    // Si le message devient vide ou trop court, ajouter une phrase générique
    if (fixed.length < 10) {
      const hour = now.getHours();
      if (hour >= 22 || hour < 6) {
        fixed = "Il est tard là 😅";
      } else if (hour >= 12) {
        fixed = "Cet après-midi là";
      } else {
        fixed = "Ce matin là";
      }
    }
    
    return fixed;
  },
  
  /**
   * Vérifie et log les incohérences (à appeler avant l'envoi)
   */
  async checkAndLog(message: string, queueItemId: string, scheduledAt: Date): Promise<TimeCheckResult> {
    const result = this.analyze(message, scheduledAt);
    
    if (result.hasTimeMention) {
      console.log(`[TimeAgent] Queue ${queueItemId}: Mention ${result.mentionedHour}h, Envoi ${result.currentHour}h, Diff ${result.differenceMinutes}min`);
      
      if (!result.isCoherent) {
        console.warn(`[TimeAgent] ⚠️ INCOHÉRENCE DÉTECTÉE: ${result.differenceMinutes} minutes d'écart!`);
        if (result.suggestedFix) {
          console.log(`[TimeAgent] 💡 Suggestion: "${result.suggestedFix}"`);
        }
      }
    }
    
    return result;
  }
};
