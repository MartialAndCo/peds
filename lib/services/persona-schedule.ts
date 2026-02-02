/**
 * Persona Schedule Service
 * 
 * Generates a realistic weekly schedule for the AI persona (15yo French girl).
 * Purpose: Narrative context ("What are you doing?") + Availability status.
 * 
 * IMPORTANT: This does NOT block replies arbitrarily.
 * - SCHOOL/SLEEP = Delayed replies
 * - Everything else = AVAILABLE (fast replies possible)
 */

import { toZonedTime, format } from 'date-fns-tz'

// ============================================================================
// TYPES
// ============================================================================

export type ActivityStatus = 'AVAILABLE' | 'BUSY' | 'SLEEP'

export interface Activity {
    name: string
    description: string
    status: ActivityStatus
}

export type DayOfWeek = 0 | 1 | 2 | 3 | 4 | 5 | 6 // 0 = Sunday

// ============================================================================
// SCHEDULE DATA (Deterministic based on day/hour)
// ============================================================================

// School subjects by day (Monday=1 to Friday=5)
const SCHOOL_SUBJECTS: Record<number, string[]> = {
    1: ['Maths', 'Français', 'Histoire-Géo', 'Anglais', 'SVT'],
    2: ['Physique-Chimie', 'Sport', 'Maths', 'Français', 'Musique'],
    3: ['Anglais', 'Maths', 'Arts Plastiques', 'Histoire-Géo', 'Français'],
    4: ['SVT', 'Français', 'Maths', 'Sport', 'Technologie'],
    5: ['Histoire-Géo', 'Anglais', 'Physique-Chimie', 'Maths', 'Vie de Classe'],
}

// Evening/Free time activities (weighted random via hour seed)
const FREE_ACTIVITIES = [
    { name: 'Netflix', description: 'en train de mater une série sur Netflix' },
    { name: 'TikTok', description: 'en train de scroller TikTok' },
    { name: 'Instagram', description: 'sur Insta' },
    { name: 'Musique', description: 'en train d\'écouter de la musique' },
    { name: 'Télé', description: 'devant la télé avec ma famille' },
    { name: 'Lit', description: 'dans mon lit sur mon tel' },
    { name: 'Appel', description: 'en appel avec une pote' },
]

const HOMEWORK_ACTIVITIES = [
    { name: 'Devoirs Maths', description: 'en train de faire mes exos de maths' },
    { name: 'Devoirs Français', description: 'en train de faire une rédac' },
    { name: 'Révisions', description: 'en train de réviser pour un contrôle' },
]

// ============================================================================
// PERSONA SCHEDULE SERVICE
// ============================================================================

export const personaSchedule = {
    /**
     * Get the current activity based on the given timezone.
     * Returns narrative context + availability status.
     */
    getCurrentActivity(timezone: string = 'Europe/Paris'): Activity {
        const now = toZonedTime(new Date(), timezone)
        const hour = now.getHours()
        const dayOfWeek = now.getDay() as DayOfWeek
        const isWeekend = dayOfWeek === 0 || dayOfWeek === 6

        // ========================================
        // SLEEP (3am - 10am approx)
        // ========================================
        if (hour >= 3 && hour < 7) {
            return {
                name: 'Sommeil Profond',
                description: 'en train de dormir profondément',
                status: 'SLEEP'
            }
        }

        if (hour >= 7 && hour < 8) {
            // Waking up / Getting ready
            if (isWeekend) {
                return {
                    name: 'Sommeil',
                    description: 'en train de dormir (c\'est le week-end)',
                    status: 'SLEEP'
                }
            }
            return {
                name: 'Réveil',
                description: 'en train de me préparer pour les cours',
                status: 'AVAILABLE'
            }
        }

        // Weekend late sleep (until ~11am)
        if (isWeekend && hour >= 8 && hour < 11) {
            return {
                name: 'Grasse Matinée',
                description: 'en train de faire la grasse mat\'',
                status: 'SLEEP'
            }
        }

        // ========================================
        // SCHOOL (8am - 3pm, Weekdays only)
        // ========================================
        if (!isWeekend && hour >= 8 && hour < 15) {
            // Lunch break (12-13)
            if (hour === 12) {
                return {
                    name: 'Pause Déj',
                    description: 'à la cantine avec mes potes',
                    status: 'AVAILABLE'
                }
            }

            // Get subject based on hour
            const subjects = SCHOOL_SUBJECTS[dayOfWeek] || SCHOOL_SUBJECTS[1]
            const subjectIndex = Math.min(hour - 8, subjects.length - 1)
            const subject = subjects[subjectIndex]

            return {
                name: `Cours de ${subject}`,
                description: `en cours de ${subject.toLowerCase()}`,
                status: 'BUSY'
            }
        }

        // ========================================
        // AFTER SCHOOL / EVENING
        // ========================================

        // Transport home (3pm - 4pm weekdays)
        if (!isWeekend && hour === 15) {
            return {
                name: 'Transport',
                description: 'dans le bus en rentrant des cours',
                status: 'AVAILABLE'
            }
        }

        // Goûter / Chill (4pm - 5pm)
        if (hour >= 16 && hour < 17) {
            return {
                name: 'Goûter',
                description: 'en train de goûter / chiller',
                status: 'AVAILABLE'
            }
        }

        // Homework time (5pm - 7pm weekdays, varies weekends)
        if (hour >= 17 && hour < 19) {
            // 50% chance of doing homework vs chilling
            const doingHomework = this.getDeterministicChoice(now, 0.5)
            if (doingHomework) {
                const hw = HOMEWORK_ACTIVITIES[hour % HOMEWORK_ACTIVITIES.length]
                return { ...hw, status: 'AVAILABLE' }
            }
            const activity = FREE_ACTIVITIES[hour % FREE_ACTIVITIES.length]
            return { ...activity, status: 'AVAILABLE' }
        }

        // Dinner (7pm - 8pm)
        if (hour === 19) {
            return {
                name: 'Repas',
                description: 'en train de manger avec ma famille',
                status: 'AVAILABLE'
            }
        }

        // Evening Free Time (8pm - 11pm) - Prime availability
        if (hour >= 20 && hour < 23) {
            const activity = FREE_ACTIVITIES[(hour + dayOfWeek) % FREE_ACTIVITIES.length]
            return { ...activity, status: 'AVAILABLE' }
        }

        // Late Night (11pm - 3am) - Should be sleeping but...
        if (hour >= 23 || hour < 3) {
            // 70% chance she's still up scrolling
            const stillUp = this.getDeterministicChoice(now, 0.7)
            if (stillUp) {
                return {
                    name: 'Insomnie Tel',
                    description: 'dans mon lit sur mon tel (je devrais dormir)',
                    status: 'AVAILABLE'
                }
            }
            return {
                name: 'Sommeil',
                description: 'en train de dormir',
                status: 'SLEEP'
            }
        }

        // Default fallback
        return {
            name: 'Temps Libre',
            description: 'tranquille chez moi',
            status: 'AVAILABLE'
        }
    },

    /**
     * Helper: Deterministic "random" choice based on current time.
     * Ensures consistency within the same hour.
     */
    getDeterministicChoice(date: Date, threshold: number): boolean {
        const seed = date.getFullYear() * 10000 + (date.getMonth() + 1) * 100 + date.getDate() + date.getHours()
        const hash = Math.abs(Math.sin(seed) * 10000) % 1
        return hash < threshold
    },

    /**
     * Get a formatted context string for injection into the System Prompt.
     */
    getContextPrompt(timezone: string = 'Europe/Paris'): string {
        const activity = this.getCurrentActivity(timezone)
        const now = toZonedTime(new Date(), timezone)
        const timeStr = format(now, 'HH:mm', { timeZone: timezone })
        const dayNames = ['Dimanche', 'Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi']
        const dayName = dayNames[now.getDay()]

        let contextLine = `[CONTEXTE VIE ACTUEL - ${dayName} ${timeStr}]: Tu es ${activity.description}.`

        if (activity.status === 'BUSY') {
            contextLine += ` Tu es en cours donc tu réponds discrètement (téléphone caché sous la table). Si on te demande pourquoi tu mets du temps, mentionne les cours.`
        } else if (activity.status === 'SLEEP') {
            contextLine += ` Tu viens de te réveiller ou tu t'endormais. Tu peux être un peu dans le vape.`
        }

        return contextLine
    }
}
