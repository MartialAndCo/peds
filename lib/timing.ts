import { addMinutes, addHours, format, subMinutes } from 'date-fns'
import { toZonedTime } from 'date-fns-tz'

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

    static analyzeContext(lastUserMessageTime: Date | null, phase: string, isHighPriority: boolean = false, timezone: string = 'Europe/Paris'): { mode: 'FAST' | 'NORMAL' | 'SLOW' | 'SLEEP' | 'INSTANT_TEST', delaySeconds: number, shouldGhost: boolean } {
        const nowZoned = this.getZonedTime(timezone)
        const dayOfWeek = nowZoned.getDay() // 0 = Sunday, 6 = Saturday

        // 0. PRIORITY OVERRIDE
        if (isHighPriority) {
            // Payment or Validation -> FAST (10s - 30s)
            // Even if sleeping? Maybe not if deep sleep, but high priority implies "don't ghost for hours".
            // Let's say if sleeping, we reduce wakeup delay? 
            // User request: "Répond plus vite quand il y a texture argent".

            // If sleeping, we shouldn't reply instantly (suspicious), but maybe wake up sooner?
            // For now, let's treat it as FAST Flow if awake.
            const sleep = this.getSleepWindow(timezone)
            const isSleeping = nowZoned >= sleep.start && nowZoned <= sleep.end

            if (!isSleeping) {
                const delay = Math.floor(Math.random() * (30 - 10 + 1)) + 10 // 10s - 30s
                return { mode: 'FAST', delaySeconds: delay, shouldGhost: true }
            }
        }

        // 1. Check Sleep
        const sleep = this.getSleepWindow(timezone)
        const isSleeping = nowZoned >= sleep.start && nowZoned <= sleep.end

        if (isSleeping) {
            // Wakeup Logic
            const diffMs = sleep.end.getTime() - nowZoned.getTime()
            const delaySeconds = Math.max(0, Math.floor(diffMs / 1000)) + 60 * this.getDailyRandom(timezone, 5, 30, 'wakeup-delay')
            return { mode: 'SLEEP', delaySeconds, shouldGhost: false } // Do NOT Mark Read if sleeping
        }

        // 2. Check Flow (Conversation Speed)
        // If last message was < 5 mins ago, we are "in flow" -> Fast Replies
        const minsSinceLastMsg = lastUserMessageTime ? (new Date().getTime() - lastUserMessageTime.getTime()) / 1000 / 60 : 999
        if (minsSinceLastMsg < 5) {
            // In Flow -> Fast Mode: 5s - 15s (Ensure inline processing < 22s)
            const delay = Math.floor(Math.random() * (15 - 5 + 1)) + 5
            return { mode: 'FAST', delaySeconds: delay, shouldGhost: true }
        }

        // 3. Check School / Work (WEEKDAYS ONLY)
        const isWeekend = dayOfWeek === 0 || dayOfWeek === 6
        if (!isWeekend) {
            const school = this.getSchoolWindow(timezone)
            const isSchool = nowZoned >= school.start && nowZoned <= school.end

            if (isSchool) {
                // School Mode: 80% Ghosting, 20% Break
                const isBreak = Math.random() > 0.8
                if (isBreak) {
                    const delay = Math.floor(Math.random() * (120 - 30 + 1)) + 30 // 30s - 2m
                    return { mode: 'FAST', delaySeconds: delay, shouldGhost: true }
                } else {
                    // Wait until school ends + buffer
                    const diffMs = school.end.getTime() - nowZoned.getTime()
                    const delay = Math.max(0, Math.floor(diffMs / 1000)) + 60 * Math.floor(Math.random() * 30) // End + 0-30m
                    return { mode: 'SLOW', delaySeconds: delay, shouldGhost: true } // Mark read, reply later (Ghosting)
                }
            }
        }

        // 4. Default / Free Time (Weekend or After School)
        // Normal random variation: 2 min - 15 min
        // Weekends -> Maybe slightly faster available? 
        // User asked "Is it taken into account?". 
        // Implementation: Effectively yes, because we SKIP School logic which imposes massive delays.
        // So weekends = Free Time all day = 2-15m delays vs School (hours).
        const delay = Math.floor(Math.random() * (15 * 60 - 2 * 60 + 1)) + 2 * 60
        return { mode: 'NORMAL', delaySeconds: delay, shouldGhost: true }
    }
}
