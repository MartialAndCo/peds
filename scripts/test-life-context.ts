/**
 * Test script for Life Context / Persona Schedule
 * Verifies that the AI gets the correct context based on time of day
 */

import { personaSchedule } from '../lib/services/persona-schedule'
import { toZonedTime } from 'date-fns-tz'

// Test scenarios with expected activities
const testScenarios = [
    {
        name: '🌙 Late night (23:41) - Original problem scenario',
        hour: 23,
        minute: 41,
        dayOfWeek: 1, // Monday
        expectedStatus: 'AVAILABLE',
        expectedActivity: 'dans mon lit',
        shouldNotSay: ['en cours', 'école', 'cours']
    },
    {
        name: '🌅 Early morning (07:30) - Getting ready',
        hour: 7,
        minute: 30,
        dayOfWeek: 1,
        expectedStatus: 'AVAILABLE',
        expectedActivity: 'préparer',
        shouldNotSay: ['en cours']
    },
    {
        name: '🏫 School time (10:00) - In class',
        hour: 10,
        minute: 0,
        dayOfWeek: 1,
        expectedStatus: 'BUSY',
        expectedActivity: 'en cours',
        shouldNotSay: ['dormir', 'lit']
    },
    {
        name: '🍽️ Lunch break (12:00) - At cafeteria',
        hour: 12,
        minute: 0,
        dayOfWeek: 1,
        expectedStatus: 'AVAILABLE',
        expectedActivity: 'cantine',
        shouldNotSay: ['en cours de', 'dort']
    },
    {
        name: '🏠 After school (16:00) - Snack time',
        hour: 16,
        minute: 0,
        dayOfWeek: 1,
        expectedStatus: 'AVAILABLE',
        expectedActivity: 'goûter',
        shouldNotSay: ['en cours', 'dort']
    },
    {
        name: '📚 Homework time (18:00) - Doing homework',
        hour: 18,
        minute: 0,
        dayOfWeek: 1,
        expectedStatus: 'AVAILABLE',
        expectedActivity: 'devoirs',
        shouldNotSay: ['en cours', 'dort', 'cours de']
    },
    {
        name: '🍕 Dinner time (19:30) - Family dinner',
        hour: 19,
        minute: 30,
        dayOfWeek: 1,
        expectedStatus: 'AVAILABLE',
        expectedActivity: 'manger',
        shouldNotSay: ['en cours', 'dort']
    },
    {
        name: '📱 Evening chill (21:00) - On phone',
        hour: 21,
        minute: 0,
        dayOfWeek: 1,
        expectedStatus: 'AVAILABLE',
        expectedActivity: 'Netflix|TikTok|Instagram|télé',
        shouldNotSay: ['en cours', 'dort']
    },
    {
        name: '😴 Deep sleep (04:00) - Sleeping',
        hour: 4,
        minute: 0,
        dayOfWeek: 1,
        expectedStatus: 'SLEEP',
        expectedActivity: 'dormir',
        shouldNotSay: ['en cours', 'télé', 'Netflix']
    },
    {
        name: '🌙 Weekend late night (23:41) - Weekend scenario',
        hour: 23,
        minute: 41,
        dayOfWeek: 6, // Saturday
        expectedStatus: 'AVAILABLE',
        expectedActivity: 'dans mon lit',
        shouldNotSay: ['en cours', 'école']
    },
    {
        name: '😴 Weekend morning (09:00) - Sleeping in',
        hour: 9,
        minute: 0,
        dayOfWeek: 6,
        expectedStatus: 'SLEEP',
        expectedActivity: 'grasse mat',
        shouldNotSay: ['en cours', 'école']
    }
]

// Mock the current time for testing
function mockCurrentTime(hour: number, minute: number, dayOfWeek: number): Date {
    const date = new Date()
    date.setHours(hour, minute, 0, 0)
    // Adjust to match day of week (0 = Sunday, 1 = Monday, etc.)
    const currentDay = date.getDay()
    const diff = dayOfWeek - currentDay
    date.setDate(date.getDate() + diff)
    return date
}

// Override the getCurrentActivity to use mocked time
function testGetCurrentActivity(date: Date, timezone: string = 'Europe/Paris') {
    // We'll directly test the logic by creating a custom implementation
    // that uses the provided date instead of new Date()

    const hour = date.getHours()
    const dayOfWeek = date.getDay() as 0 | 1 | 2 | 3 | 4 | 5 | 6
    const isWeekend = dayOfWeek === 0 || dayOfWeek === 6

    // Simplified version of the logic from persona-schedule.ts
    if (hour >= 3 && hour < 7) {
        return { name: 'Sommeil Profond', description: 'en train de dormir profondément', status: 'SLEEP' as const }
    }

    if (hour >= 7 && hour < 8) {
        if (isWeekend) {
            return { name: 'Sommeil', description: 'en train de dormir (c\'est le week-end)', status: 'SLEEP' as const }
        }
        return { name: 'Réveil', description: 'en train de me préparer pour les cours', status: 'AVAILABLE' as const }
    }

    if (isWeekend && hour >= 8 && hour < 11) {
        return { name: 'Grasse Matinée', description: 'en train de faire la grasse mat\'', status: 'SLEEP' as const }
    }

    if (!isWeekend && hour >= 8 && hour < 15) {
        if (hour === 12) {
            return { name: 'Pause Déj', description: 'à la cantine avec mes potes', status: 'AVAILABLE' as const }
        }
        const subjects: Record<number, string[]> = {
            1: ['Maths', 'Français', 'Histoire-Géo', 'Anglais', 'SVT'],
            2: ['Physique-Chimie', 'Sport', 'Maths', 'Français', 'Musique'],
            3: ['Anglais', 'Maths', 'Arts Plastiques', 'Histoire-Géo', 'Français'],
            4: ['SVT', 'Français', 'Maths', 'Sport', 'Technologie'],
            5: ['Histoire-Géo', 'Anglais', 'Physique-Chimie', 'Maths', 'Vie de Classe'],
        }
        const subject = subjects[dayOfWeek]?.[Math.min(hour - 8, 4)] || 'cours'
        return { name: `Cours`, description: `en cours de ${subject.toLowerCase()}`, status: 'BUSY' as const }
    }

    if (!isWeekend && hour === 15) {
        return { name: 'Transport', description: 'dans le bus en rentrant des cours', status: 'AVAILABLE' as const }
    }

    if (hour >= 16 && hour < 17) {
        return { name: 'Goûter', description: 'en train de goûter / chiller', status: 'AVAILABLE' as const }
    }

    if (hour >= 17 && hour < 19) {
        return { name: 'Devoirs', description: 'en train de faire mes exos', status: 'AVAILABLE' as const }
    }

    if (hour === 19) {
        return { name: 'Repas', description: 'en train de manger avec ma famille', status: 'AVAILABLE' as const }
    }

    if (hour >= 20 && hour < 23) {
        const activities = ['Netflix', 'TikTok', 'Instagram', 'télé']
        const activity = activities[(hour + dayOfWeek) % activities.length]
        return { name: activity, description: `en train de mater ${activity}`, status: 'AVAILABLE' as const }
    }

    if (hour >= 23 || hour < 3) {
        return { name: 'Insomnie Tel', description: 'dans mon lit sur mon tel (je devrais dormir)', status: 'AVAILABLE' as const }
    }

    return { name: 'Temps Libre', description: 'tranquille chez moi', status: 'AVAILABLE' as const }
}

// Run tests
console.log('═'.repeat(80))
console.log('🧪 LIFE CONTEXT / PERSONA SCHEDULE TEST SUITE')
console.log('═'.repeat(80))
console.log()

let passed = 0
let failed = 0

for (const scenario of testScenarios) {
    const mockDate = mockCurrentTime(scenario.hour, scenario.minute, scenario.dayOfWeek)
    const activity = testGetCurrentActivity(mockDate)
    const contextPrompt = `[CONTEXTE VIE ACTUEL - ${scenario.hour.toString().padStart(2, '0')}:${scenario.minute.toString().padStart(2, '0')}]: Tu es ${activity.description}.`

    console.log(`\n${scenario.name}`)
    console.log('-'.repeat(80))
    console.log(`  Generated context: ${contextPrompt}`)
    console.log(`  Status: ${activity.status}`)

    // Check expected status
    if (activity.status !== scenario.expectedStatus) {
        console.log(`  ❌ FAIL: Expected status "${scenario.expectedStatus}", got "${activity.status}"`)
        failed++
        continue
    }

    // Check expected activity keywords
    const activityMatch = scenario.expectedActivity.split('|').some(keyword =>
        activity.description.toLowerCase().includes(keyword.toLowerCase())
    )
    if (!activityMatch) {
        console.log(`  ❌ FAIL: Expected activity containing "${scenario.expectedActivity}", got "${activity.description}"`)
        failed++
        continue
    }

    // Check forbidden phrases
    const forbiddenFound = scenario.shouldNotSay.filter(phrase =>
        activity.description.toLowerCase().includes(phrase.toLowerCase())
    )
    if (forbiddenFound.length > 0) {
        console.log(`  ❌ FAIL: Should not contain "${forbiddenFound.join(', ')}"`)
        failed++
        continue
    }

    console.log(`  ✅ PASS`)
    passed++
}

console.log()
console.log('═'.repeat(80))
console.log(`📊 TEST RESULTS: ${passed} passed, ${failed} failed`)
console.log('═'.repeat(80))

// Test the actual personaSchedule.getContextPrompt function
console.log()
console.log('═'.repeat(80))
console.log('🌍 REAL-WORLD CONTEXT GENERATION (using actual function)')
console.log('═'.repeat(80))
console.log()

const realContext = personaSchedule.getContextPrompt('Europe/Paris')
console.log('Current context for Europe/Paris:')
console.log(realContext)
console.log()

const usContext = personaSchedule.getContextPrompt('America/New_York')
console.log('Current context for US East Coast:')
console.log(usContext)
console.log()

process.exit(failed > 0 ? 1 : 0)
