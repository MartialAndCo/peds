import { addMinutes, addHours, format, subMinutes } from 'date-fns'
import { toZonedTime } from 'date-fns-tz'
import { personaSchedule } from '@/lib/services/persona-schedule'

export class TimingManager {
    // Randomized Daily Schedules (Deterministic based on date)

    static getZonedTime(timezone: string = 'Europe/Paris'): Date {
        // Return current time zoned to specified timezone
        return toZonedTime(new Date(), timezone)
    }

    static getFormattedTime(timezone: string = 'Europe/Paris'): string {
        return format(this.getZonedTime(timezone), 'HH:mm')
    }

    // Pseudo-random deterministic helper based on date
    private static getDailyRandom(timezone: string, min: number, max: number, seedSuffix: string = ''): number {
        const today = format(this.getZonedTime(timezone), 'yyyy-MM-dd')
        const seed = today + seedSuffix
        let hash = 0
        for (let i = 0; i < seed.length; i++) {
            hash = ((hash << 5) - hash) + seed.charCodeAt(i)
            hash |= 0
        }
        const normalized = (Math.abs(hash) % 1000) / 1000
        return Math.floor(normalized * (max - min + 1)) + min
    }

    static getSleepWindow(timezone: string = 'Europe/Paris') {
        // Base: 3am - 10am
        // Variance: +/- 45 mins
        const startHour = 3
        const endHour = 10

        const startMinsVariance = this.getDailyRandom(timezone, -45, 45, 'sleep-start')
        const endMinsVariance = this.getDailyRandom(timezone, -45, 45, 'sleep-end')

        const nowZoned = this.getZonedTime(timezone)
        const startOfToday = new Date(nowZoned)
        startOfToday.setHours(0, 0, 0, 0)

        const todaySleepStart = addMinutes(addHours(startOfToday, startHour), startMinsVariance)
        const todaySleepEnd = addMinutes(addHours(startOfToday, endHour), endMinsVariance)

        return { start: todaySleepStart, end: todaySleepEnd }
    }

    static getSchoolWindow(timezone: string = 'Europe/Paris') {
        // Base: 8am - 3pm
        // Variance: Start +/- 15m, End +/- 30m
        const startHour = 8
        const endHour = 15 // 3pm

        const startMinsVariance = this.getDailyRandom(timezone, -15, 15, 'school-start')
        const endMinsVariance = this.getDailyRandom(timezone, -30, 30, 'school-end')

        const nowZoned = this.getZonedTime(timezone)
        const startOfToday = new Date(nowZoned)
        startOfToday.setHours(0, 0, 0, 0)

        const todaySchoolStart = addMinutes(addHours(startOfToday, startHour), startMinsVariance)
        const todaySchoolEnd = addMinutes(addHours(startOfToday, endHour), endMinsVariance)

        return { start: todaySchoolStart, end: todaySchoolEnd }
    }

    /**
     * Analyze context and determine response delay.
     * Uses PersonaSchedule for activity status.
     * 
     * SIMPLIFIED LOGIC (per user request):
     * - SLEEP: Ghost until wakeup
     * - SCHOOL (BUSY): 25-45 minute delay (she texts discreetly)
     * - AVAILABLE: Fast/Normal flow (ping-pong possible)
     */
    static analyzeContext(lastUserMessageTime: Date | null, phase: string, isHighPriority: boolean = false, timezone: string = 'Europe/Paris'): { mode: 'FAST' | 'NORMAL' | 'SLOW' | 'SLEEP' | 'INSTANT_TEST', delaySeconds: number, shouldGhost: boolean, activityContext?: string } {
        const nowZoned = this.getZonedTime(timezone)

        // Get current activity from PersonaSchedule
        const activity = personaSchedule.getCurrentActivity(timezone)
        const contextPrompt = personaSchedule.getContextPrompt(timezone)

        // 0. PRIORITY OVERRIDE (Payment/Urgent)
        if (isHighPriority && activity.status !== 'SLEEP') {
            const delay = Math.floor(Math.random() * (30 - 10 + 1)) + 10 // 10s - 30s
            return { mode: 'FAST', delaySeconds: delay, shouldGhost: true, activityContext: contextPrompt }
        }

        // 1. SLEEP: Ghost until wakeup
        if (activity.status === 'SLEEP') {
            const sleep = this.getSleepWindow(timezone)
            const diffMs = sleep.end.getTime() - nowZoned.getTime()
            const delaySeconds = Math.max(0, Math.floor(diffMs / 1000)) + 60 * this.getDailyRandom(timezone, 5, 30, 'wakeup-delay')
            return { mode: 'SLEEP', delaySeconds, shouldGhost: false, activityContext: contextPrompt }
        }

        // 2. SCHOOL (BUSY): 25-45 minute delay (discreet texting)
        if (activity.status === 'BUSY') {
            // 20% chance of quick "break" reply (Pause Déj or between classes)
            const isBreak = Math.random() > 0.8
            if (isBreak) {
                const delay = Math.floor(Math.random() * (120 - 30 + 1)) + 30 // 30s - 2m
                return { mode: 'FAST', delaySeconds: delay, shouldGhost: true, activityContext: contextPrompt }
            }
            // Normal school delay: 25-45 minutes
            const delayMins = Math.floor(Math.random() * (45 - 25 + 1)) + 25
            return { mode: 'SLOW', delaySeconds: delayMins * 60, shouldGhost: true, activityContext: contextPrompt }
        }

        // 3. AVAILABLE: Check Flow Mode (Ping-Pong)
        const minsSinceLastMsg = lastUserMessageTime ? (new Date().getTime() - lastUserMessageTime.getTime()) / 1000 / 60 : 999
        if (minsSinceLastMsg < 5) {
            // In Flow -> Fast Mode: 5s - 2m (extended range for realism)
            const delay = Math.floor(Math.random() * (120 - 5 + 1)) + 5
            return { mode: 'FAST', delaySeconds: delay, shouldGhost: true, activityContext: contextPrompt }
        }

        // 4. AVAILABLE but not in flow: Normal delay 2-15 min
        const delay = Math.floor(Math.random() * (15 * 60 - 2 * 60 + 1)) + 2 * 60
        return { mode: 'NORMAL', delaySeconds: delay, shouldGhost: true, activityContext: contextPrompt }
    }
}
