import { addMinutes, addHours, format, subMinutes } from 'date-fns'
import { toZonedTime } from 'date-fns-tz'

const TIMEZONE = 'America/Los_Angeles'

export class TimingManager {
    // Randomized Daily Schedules (Deterministic based on date)

    static getLATime(): Date {
        // Return current time zoned to LA
        return toZonedTime(new Date(), TIMEZONE)
    }

    static getFormattedLATime(): string {
        return format(this.getLATime(), 'HH:mm')
    }

    // Pseudo-random deterministic helper based on date
    private static getDailyRandom(min: number, max: number, seedSuffix: string = ''): number {
        const today = format(this.getLATime(), 'yyyy-MM-dd')
        const seed = today + seedSuffix
        let hash = 0
        for (let i = 0; i < seed.length; i++) {
            hash = ((hash << 5) - hash) + seed.charCodeAt(i)
            hash |= 0
        }
        const normalized = (Math.abs(hash) % 1000) / 1000
        return Math.floor(normalized * (max - min + 1)) + min
    }

    static getSleepWindow() {
        // Base: 3am - 10am
        // Variance: +/- 45 mins
        const startHour = 3
        const endHour = 10

        const startMinsVariance = this.getDailyRandom(-45, 45, 'sleep-start')
        const endMinsVariance = this.getDailyRandom(-45, 45, 'sleep-end')

        const nowLA = this.getLATime()
        const startOfToday = new Date(nowLA)
        startOfToday.setHours(0, 0, 0, 0)

        const todaySleepStart = addMinutes(addHours(startOfToday, startHour), startMinsVariance)
        const todaySleepEnd = addMinutes(addHours(startOfToday, endHour), endMinsVariance)

        return { start: todaySleepStart, end: todaySleepEnd }
    }

    static getSchoolWindow() {
        // Base: 8am - 3pm
        // Variance: Start +/- 15m, End +/- 30m
        const startHour = 8
        const endHour = 15 // 3pm

        const startMinsVariance = this.getDailyRandom(-15, 15, 'school-start')
        const endMinsVariance = this.getDailyRandom(-30, 30, 'school-end')

        const nowLA = this.getLATime()
        const startOfToday = new Date(nowLA)
        startOfToday.setHours(0, 0, 0, 0)

        const todaySchoolStart = addMinutes(addHours(startOfToday, startHour), startMinsVariance)
        const todaySchoolEnd = addMinutes(addHours(startOfToday, endHour), endMinsVariance)

        return { start: todaySchoolStart, end: todaySchoolEnd }
    }

    static analyzeContext(lastUserMessageTime: Date | null, phase: string): { mode: 'FAST' | 'NORMAL' | 'SLOW' | 'SLEEP', delaySeconds: number, shouldGhost: boolean } {
        const nowLA = this.getLATime()

        // 1. Check Sleep
        const sleep = this.getSleepWindow()
        const isSleeping = nowLA >= sleep.start && nowLA <= sleep.end

        if (isSleeping) {
            // Wakeup Logic
            const diffMs = sleep.end.getTime() - nowLA.getTime()
            const delaySeconds = Math.max(0, Math.floor(diffMs / 1000)) + 60 * this.getDailyRandom(5, 30, 'wakeup-delay')
            return { mode: 'SLEEP', delaySeconds, shouldGhost: false } // Do NOT Mark Read if sleeping
        }

        // 2. Check Flow (Conversation Speed)
        // If last message was < 5 mins ago, we are "in flow" -> Fast Replies
        const minsSinceLastMsg = lastUserMessageTime ? (new Date().getTime() - lastUserMessageTime.getTime()) / 1000 / 60 : 999
        if (minsSinceLastMsg < 5) {
            // In Flow -> Fast Mode: 8s - 45s
            const delay = Math.floor(Math.random() * (45 - 8 + 1)) + 8
            return { mode: 'FAST', delaySeconds: delay, shouldGhost: true }
        }

        // 3. Check School / Work
        const school = this.getSchoolWindow()
        const isSchool = nowLA >= school.start && nowLA <= school.end

        if (isSchool) {
            // School Mode: 80% Ghosting, 20% Break
            const isBreak = Math.random() > 0.8
            if (isBreak) {
                const delay = Math.floor(Math.random() * (120 - 30 + 1)) + 30 // 30s - 2m
                return { mode: 'FAST', delaySeconds: delay, shouldGhost: true }
            } else {
                // Wait until school ends + buffer
                const diffMs = school.end.getTime() - nowLA.getTime()
                const delay = Math.max(0, Math.floor(diffMs / 1000)) + 60 * Math.floor(Math.random() * 30) // End + 0-30m
                return { mode: 'SLOW', delaySeconds: delay, shouldGhost: true } // Mark read, reply later (Ghosting)
            }
        }

        // 4. Default / Free Time
        // Normal random variation: 2 min - 15 min
        const delay = Math.floor(Math.random() * (15 * 60 - 2 * 60 + 1)) + 2 * 60
        return { mode: 'NORMAL', delaySeconds: delay, shouldGhost: true }
    }
}
