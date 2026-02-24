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

const VACATION_RANGES = {
    fr: [
        // 2024-2025 Zone C
        { start: '2024-10-19', end: '2024-11-04' },
        { start: '2024-12-21', end: '2025-01-06' },
        { start: '2025-02-15', end: '2025-03-03' },
        { start: '2025-04-12', end: '2025-04-28' },
        { start: '2025-07-05', end: '2025-09-01' },
        // 2025-2026 Zone C
        { start: '2025-10-18', end: '2025-11-03' },
        { start: '2025-12-20', end: '2026-01-05' },
        { start: '2026-02-21', end: '2026-03-09' },
        { start: '2026-04-25', end: '2026-05-11' },
        { start: '2026-07-04', end: '2026-09-01' },
        // 2026-2027 Zone C
        { start: '2026-10-17', end: '2026-11-02' },
        { start: '2026-12-19', end: '2027-01-04' },
        { start: '2027-02-20', end: '2027-03-08' },
        { start: '2027-04-24', end: '2027-05-10' },
        { start: '2027-07-07', end: '2027-09-02' }
    ],
    en: [
        // Generic US Holidays
        { start: '2024-11-23', end: '2024-12-01' },
        { start: '2024-12-21', end: '2025-01-06' },
        { start: '2025-03-15', end: '2025-03-24' },
        { start: '2025-06-01', end: '2025-08-15' },
        // 2025-2026
        { start: '2025-11-22', end: '2025-11-30' },
        { start: '2025-12-20', end: '2026-01-05' },
        { start: '2026-03-14', end: '2026-03-23' },
        { start: '2026-06-01', end: '2026-08-15' },
        // 2026-2027
        { start: '2026-11-21', end: '2026-11-29' },
        { start: '2026-12-19', end: '2027-01-04' },
        { start: '2027-03-13', end: '2027-03-22' },
        { start: '2027-06-01', end: '2027-08-15' },
    ]
}

// ============================================================================
// LOCALIZATION DATA
// ============================================================================

const LOCALE_DATA: Record<string, any> = {
    fr: {
        subjects: {
            1: ['Maths', 'Français', 'Histoire-Géo', 'Anglais', 'SVT'],
            2: ['Physique-Chimie', 'Sport', 'Maths', 'Français', 'Musique'],
            3: ['Anglais', 'Maths', 'Arts Plastiques', 'Histoire-Géo', 'Français'],
            4: ['SVT', 'Français', 'Maths', 'Sport', 'Technologie'],
            5: ['Histoire-Géo', 'Anglais', 'Physique-Chimie', 'Maths', 'Vie de Classe'],
        },
        free: [
            { name: 'Netflix', description: 'en train de mater une série sur Netflix' },
            { name: 'Musique', description: 'en train d\'écouter de la musique' },
            { name: 'Télé', description: 'devant la télé avec ma famille' },
            { name: 'Lit', description: 'dans mon lit sur mon tel' },
            { name: 'Lecture', description: 'en train de lire tranquille' },
            { name: 'Chambre', description: 'dans ma chambre tranquille' },
        ],
        homework: [
            { name: 'Devoirs Maths', description: 'en train de faire mes exos de maths' },
            { name: 'Devoirs Français', description: 'en train de faire une rédac' },
            { name: 'Révisions', description: 'en train de réviser pour un contrôle' },
        ],
        dayNames: ['Dimanche', 'Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi'],
        activities: {
            deepSleep: { name: 'Sommeil Profond', description: 'en train de dormir profondément' },
            sleepWeekend: { name: 'Sommeil', description: 'en train de dormir (c\'est le week-end)' },
            wakingUp: { name: 'Réveil', description: 'en train de me préparer pour les cours' },
            sleepLate: { name: 'Grasse Matinée', description: 'en train de faire la grasse mat\'' },
            lunch: { name: 'Pause Déj', description: 'à la cantine avec mes potes' },
            classPrefix: 'Cours de',
            classDescPrefix: 'en cours de',
            transport: { name: 'Retour Maison', description: 'de retour a la maison apres les cours' },
            snack: { name: 'Goûter', description: 'en train de goûter / chiller' },
            dinner: { name: 'Repas', description: 'en train de manger avec ma famille' },
            insomnia: { name: 'Insomnie Tel', description: 'dans mon lit sur mon tel (je devrais dormir)' },
            sleep: { name: 'Sommeil', description: 'en train de dormir' },
            fallback: { name: 'Temps Libre', description: 'tranquille chez moi' }
        },
        prompt: {
            header: (day: string, time: string, dayNum?: number, month?: string, year?: number) =>
                `[CONTEXTE VIE ACTUEL - ${day} ${time}${dayNum ? ` | ${dayNum} ${month} ${year}` : ''}]:`,
            dateInfo: (day: string, dayNum: number, month: string, year: number) =>
                `📅 DATE ACTUELLE : Nous sommes ${day.toLowerCase()} ${dayNum} ${month} ${year}.`,
            action: (desc: string) => `⚠️ ACTION EN COURS : Tu es ${desc}.`,
            urgent: "URGENT : Tu DOIS répondre en prenant compte de ce contexte. Si tu dors/dors à moitié, sois brève et endormie. Si tu es en cours, sois discrète. N'invente PAS une autre activité.",
            busyConstraint: "Tu es en cours donc tu réponds discrètement (téléphone caché sous la table). INTERDICTION STRICTE D'ENVOYER UNE PHOTO [IMAGE:...] maintenant car tu es en classe.",
            sleepConstraint: "Tu viens de te réveiller ou tu t'endormais. Tu peux être un peu dans le vape."
        }
    },
    en: {
        subjects: {
            1: ['Math', 'English', 'History', 'Spanish', 'Biology'],
            2: ['Chemistry', 'PE', 'Math', 'English', 'Music'],
            3: ['Spanish', 'Math', 'Art', 'History', 'English'],
            4: ['Biology', 'English', 'Math', 'PE', 'Tech'],
            5: ['History', 'Spanish', 'Chemistry', 'Math', 'Homeroom'],
        },
        free: [
            { name: 'Netflix', description: 'watching a series on Netflix' },
            { name: 'Music', description: 'listening to music' },
            { name: 'TV', description: 'watching TV with family' },
            { name: 'Bed', description: 'in bed on my phone' },
            { name: 'Reading', description: 'reading quietly' },
            { name: 'Room', description: 'in my room chilling' },
        ],
        homework: [
            { name: 'Math Homework', description: 'doing my math homework' },
            { name: 'English Homework', description: 'writing an essay' },
            { name: 'Studying', description: 'studying for a test' },
        ],
        dayNames: ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'],
        activities: {
            deepSleep: { name: 'Deep Sleep', description: 'sleeping deeply' },
            sleepWeekend: { name: 'Sleep', description: 'sleeping (it\'s the weekend)' },
            wakingUp: { name: 'Waking Up', description: 'getting ready for school' },
            sleepLate: { name: 'Sleeping In', description: 'sleeping in' },
            lunch: { name: 'Lunch', description: 'at the cafeteria with friends' },
            classPrefix: 'Class',
            classDescPrefix: 'in class',
            transport: { name: 'Back Home', description: 'back home after school' },
            snack: { name: 'Snack', description: 'having a snack / chilling' },
            dinner: { name: 'Dinner', description: 'eating dinner with family' },
            insomnia: { name: 'Phone Insomnia', description: 'in bed on my phone (should be sleeping)' },
            sleep: { name: 'Sleep', description: 'sleeping' },
            fallback: { name: 'Free Time', description: 'chilling at home' }
        },
        prompt: {
            header: (day: string, time: string, dayNum?: number, month?: string, year?: number) =>
                `[CURRENT LIFE CONTEXT - ${day} ${time}${dayNum ? ` | ${month} ${dayNum}, ${year}` : ''}]:`,
            dateInfo: (day: string, dayNum: number, month: string, year: number) =>
                `📅 CURRENT DATE: Today is ${day}, ${month} ${dayNum}, ${year}.`,
            action: (desc: string) => `⚠️ CURRENT ACTIVITY: You are ${desc}.`,
            urgent: "URGENT: You MUST answer taking this context into account. If you are sleeping/half-asleep, be brief and sleepy. If you are in class, be discreet. DO NOT invent another activity.",
            busyConstraint: "You are in class so you reply discreetly (phone hidden under the table). STRICTLY FORBIDDEN TO SEND A PHOTO [IMAGE:...] now because you are in class.",
            sleepConstraint: "You just woke up or were falling asleep. You can be a bit groggy."
        }
    }
}

export const personaSchedule = {
    /**
     * Get the current activity based on the given timezone and locale.
     */
    getCurrentActivity(timezone: string = 'Europe/Paris', overrideDate?: Date, locale: string = 'fr'): Activity {
        const lang = locale.toLowerCase().startsWith('en') ? 'en' : 'fr'
        const dict = LOCALE_DATA[lang]

        const now = overrideDate ? toZonedTime(overrideDate, timezone) : toZonedTime(new Date(), timezone)
        const hour = now.getHours()
        const dayOfWeek = now.getDay() as DayOfWeek
        const isWeekend = dayOfWeek === 0 || dayOfWeek === 6
        const isHoliday = this.isSchoolHoliday(now, lang)
        const hasNoSchool = isWeekend || isHoliday

        // SLEEP (3am - 7am)
        if (hour >= 3 && hour < 7) return { ...dict.activities.deepSleep, status: 'SLEEP' }

        // Morning (7am - 8am)
        if (hour >= 7 && hour < 8) {
            if (hasNoSchool) {
                if (isHoliday && !isWeekend) {
                    const desc = lang === 'fr' ? "en train de dormir (c'est les vacances !)" : "sleeping (it's vacation!)"
                    return { name: dict.activities.sleepWeekend.name, description: desc, status: 'SLEEP' }
                }
                return { ...dict.activities.sleepWeekend, status: 'SLEEP' }
            }
            return { ...dict.activities.wakingUp, status: 'AVAILABLE' }
        }

        // Weekend / Holiday late sleep (8am - 11am)
        if (hasNoSchool && hour >= 8 && hour < 11) {
            if (isHoliday && !isWeekend) {
                const desc = lang === 'fr' ? "en train de faire la grasse mat' (vacances !)" : "sleeping in (vacation!)"
                return { name: dict.activities.sleepLate.name, description: desc, status: 'SLEEP' }
            }
            return { ...dict.activities.sleepLate, status: 'SLEEP' }
        }

        // SCHOOL (8am - 3pm, Weekdays)
        if (!hasNoSchool && hour >= 8 && hour < 15) {
            if (hour === 12) return { ...dict.activities.lunch, status: 'AVAILABLE' }

            const subjects = dict.subjects[dayOfWeek] || dict.subjects[1]
            const subjectIndex = Math.min(hour - 8, subjects.length - 1)
            const subject = subjects[subjectIndex]

            return {
                name: `${dict.activities.classPrefix} ${subject}`,
                description: `${dict.activities.classDescPrefix} ${subject.toLowerCase()}`,
                status: 'BUSY'
            }
        }

        // AFTER SCHOOL
        if (!hasNoSchool && hour === 15) return { ...dict.activities.transport, status: 'AVAILABLE' }
        if (hour >= 16 && hour < 17) return { ...dict.activities.snack, status: 'AVAILABLE' }

        // HOMEWORK (5pm - 7pm)
        if (hour >= 17 && hour < 19) {
            if (isHoliday) {
                const activity = dict.free[hour % dict.free.length]
                const vacDesc = lang === 'fr' ? 'en vacances, tranquille !' : 'on vacation, chilling!'
                return { name: activity.name, description: `${activity.description} (${vacDesc})`, status: 'AVAILABLE' }
            }

            const doingHomework = this.getDeterministicChoice(now, 0.5)
            if (doingHomework) {
                const hw = dict.homework[hour % dict.homework.length]
                return { ...hw, status: 'AVAILABLE' }
            }
            const activity = dict.free[hour % dict.free.length]
            return { ...activity, status: 'AVAILABLE' }
        }

        // Dinner (7pm - 8pm)
        if (hour === 19) return { ...dict.activities.dinner, status: 'AVAILABLE' }

        // Evening (8pm - 11pm)
        if (hour >= 20 && hour < 23) {
            const activity = dict.free[(hour + dayOfWeek) % dict.free.length]
            return { ...activity, status: 'AVAILABLE' }
        }

        // Daytime off logic (holidays / weekends between 11am and 4pm)
        if (hasNoSchool && hour >= 11 && hour < 16) {
            const activity = dict.free[(hour + dayOfWeek) % dict.free.length]
            if (isHoliday && !isWeekend) {
                const vacDesc = lang === 'fr' ? 'en vacances, je profite !' : 'on vacation, enjoying my time!'
                return { name: activity.name, description: `${activity.description} (${vacDesc})`, status: 'AVAILABLE' }
            }
            return { ...activity, status: 'AVAILABLE' }
        }

        // Late Night (11pm - 3am)
        if (hour >= 23 || hour < 3) {
            const stillUp = this.getDeterministicChoice(now, 0.7)
            if (stillUp) return { ...dict.activities.insomnia, status: 'AVAILABLE' }
            return { ...dict.activities.sleep, status: 'SLEEP' }
        }

        return { ...dict.activities.fallback, status: 'AVAILABLE' }
    },

    isSchoolHoliday(date: Date, lang: string): boolean {
        const ranges = VACATION_RANGES[lang as keyof typeof VACATION_RANGES] || VACATION_RANGES.en
        const yyyy = date.getFullYear()
        const mm = String(date.getMonth() + 1).padStart(2, '0')
        const dd = String(date.getDate()).padStart(2, '0')
        const ymd = `${yyyy}-${mm}-${dd}`

        return ranges.some(r => ymd >= r.start && ymd <= r.end)
    },

    getDeterministicChoice(date: Date, threshold: number): boolean {
        const seed = date.getFullYear() * 10000 + (date.getMonth() + 1) * 100 + date.getDate() + date.getHours()
        const hash = Math.abs(Math.sin(seed) * 10000) % 1
        return hash < threshold
    },

    getContextPrompt(timezone: string = 'Europe/Paris', overrideDate?: Date, locale: string = 'fr'): string {
        const lang = locale.toLowerCase().startsWith('en') ? 'en' : 'fr'
        const dict = LOCALE_DATA[lang]

        const activity = this.getCurrentActivity(timezone, overrideDate, lang)
        const now = overrideDate ? toZonedTime(overrideDate, timezone) : toZonedTime(new Date(), timezone)
        const timeStr = format(now, 'HH:mm', { timeZone: timezone })
        const dayNames = dict.dayNames
        const dayName = dayNames[now.getDay()]

        // Date complète: jour mois année
        const fullDate = format(now, 'dd MMMM yyyy', { timeZone: timezone })
        const monthNames = lang === 'fr'
            ? ['janvier', 'février', 'mars', 'avril', 'mai', 'juin', 'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre']
            : ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December']
        const monthName = monthNames[now.getMonth()]
        const year = now.getFullYear()
        const dayOfMonth = now.getDate()

        let contextLine = `${dict.prompt.header(dayName, timeStr, dayOfMonth, monthName, year)}\n${dict.prompt.dateInfo(dayName, dayOfMonth, monthName, year)}\n${dict.prompt.action(activity.description)}\n${dict.prompt.urgent}`

        if (activity.status === 'BUSY') {
            contextLine += ` ${dict.prompt.busyConstraint}`
        } else if (activity.status === 'SLEEP') {
            contextLine += ` ${dict.prompt.sleepConstraint}`
        }

        return contextLine
    }
}
