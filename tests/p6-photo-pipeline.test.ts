import {
    evaluatePhotoAuthorization,
    isExplicitPhotoRequest
} from '../lib/services/photo-request-policy'
import fs from 'node:fs'

let passed = 0
let failed = 0
const failures: string[] = []

function assert(testName: string, condition: boolean, details?: string) {
    if (condition) {
        passed++
        console.log(`  ✅ ${testName}`)
        return
    }

    failed++
    const line = `  ❌ ${testName}${details ? ` — ${details}` : ''}`
    failures.push(line)
    console.log(line)
}

function auth(input: {
    keyword: string
    phase?: string
    now: Date
    messages: Array<{ text: string; minutesAgo: number }>
    requestConsumed?: boolean
}) {
    return evaluatePhotoAuthorization({
        keyword: input.keyword,
        phase: input.phase || 'CONNECTION',
        now: input.now,
        windowMinutes: 15,
        requestConsumed: input.requestConsumed || false,
        recentUserMessages: input.messages.map((m) => ({
            text: m.text,
            timestamp: new Date(input.now.getTime() - m.minutesAgo * 60_000)
        }))
    })
}

console.log('\n══════════════════════════════════════')
console.log('C1: Explicit Request Detection')
console.log('══════════════════════════════════════')

assert("Reject false positive: j'ai pris une photo", isExplicitPhotoRequest("j'ai pris une photo de mon chat") === false)
assert("Reject false positive: nice photo", isExplicitPhotoRequest('nice photo of sunset') === false)
assert("Reject bare keyword: photo", isExplicitPhotoRequest('photo') === false)
assert("Accept explicit demand: envoie moi une photo", isExplicitPhotoRequest('envoie moi une photo') === true)
assert("Accept explicit demand: show me a pic", isExplicitPhotoRequest('show me a pic') === true)

console.log('\n══════════════════════════════════════')
console.log('C2: Window + Consumption Policy')
console.log('══════════════════════════════════════')

const now = new Date('2026-02-25T12:00:00.000Z')

const nMinus2Allowed = auth({
    keyword: 'selfie',
    phase: 'CONNECTION',
    now,
    messages: [
        { text: 'envoie moi une photo', minutesAgo: 3 }, // N-2
        { text: 'ok attends', minutesAgo: 2 },
        { text: 'tu fais quoi', minutesAgo: 1 }
    ]
})
assert('Authorize request in N-2 message', nMinus2Allowed.allowed === true, `reason=${nMinus2Allowed.reason}`)

const outsideLast3Denied = evaluatePhotoAuthorization({
    keyword: 'selfie',
    phase: 'CONNECTION',
    now,
    windowMinutes: 15,
    requestConsumed: false,
    recentUserMessages: [
        { text: 'envoie moi une photo', timestamp: new Date(now.getTime() - 2 * 60_000) }, // out of window by message count
        { text: 'ok', timestamp: new Date(now.getTime() - 90_000) },
        { text: 'lol', timestamp: new Date(now.getTime() - 60_000) },
        { text: 'tu fais quoi', timestamp: new Date(now.getTime() - 30_000) }
    ]
})
assert('Deny request outside last 3 user messages', outsideLast3Denied.allowed === false, `reason=${outsideLast3Denied.reason}`)
assert('Reason is no_recent_request when outside last 3', outsideLast3Denied.reason === 'no_recent_request', `reason=${outsideLast3Denied.reason}`)

const expiredDenied = auth({
    keyword: 'selfie',
    phase: 'CONNECTION',
    now,
    messages: [
        { text: 'envoie moi une photo', minutesAgo: 20 }, // expired > 15m
        { text: 'ok', minutesAgo: 2 },
        { text: 'tu fais quoi', minutesAgo: 1 }
    ]
})
assert('Deny expired request (>15 min)', expiredDenied.allowed === false, `reason=${expiredDenied.reason}`)
assert('Reason is expired_request', expiredDenied.reason === 'expired_request', `reason=${expiredDenied.reason}`)

const consumedDenied = auth({
    keyword: 'selfie',
    phase: 'CONNECTION',
    now,
    requestConsumed: true,
    messages: [
        { text: 'send me a pic', minutesAgo: 2 },
        { text: 'ok', minutesAgo: 1 }
    ]
})
assert('Deny second image after request consumed', consumedDenied.allowed === false, `reason=${consumedDenied.reason}`)
assert('Reason is request_already_consumed', consumedDenied.reason === 'request_already_consumed', `reason=${consumedDenied.reason}`)

console.log('\n══════════════════════════════════════')
console.log('C3: Scenario Exception')
console.log('══════════════════════════════════════')

const scenarioCrisisAllowed = auth({
    keyword: 'scenario_abc123',
    phase: 'CRISIS',
    now,
    messages: [{ text: 'ok', minutesAgo: 1 }]
})
assert('Allow scenario_* in CRISIS', scenarioCrisisAllowed.allowed === true, `reason=${scenarioCrisisAllowed.reason}`)
assert('Reason is allowed_scenario_crisis', scenarioCrisisAllowed.reason === 'allowed_scenario_crisis', `reason=${scenarioCrisisAllowed.reason}`)

const scenarioNonCrisisDenied = auth({
    keyword: 'scenario_abc123',
    phase: 'CONNECTION',
    now,
    messages: [{ text: 'envoie une photo', minutesAgo: 1 }]
})
assert('Deny scenario_* outside CRISIS', scenarioNonCrisisDenied.allowed === false, `reason=${scenarioNonCrisisDenied.reason}`)
assert('Reason is scenario_requires_crisis', scenarioNonCrisisDenied.reason === 'scenario_requires_crisis', `reason=${scenarioNonCrisisDenied.reason}`)

console.log('\n══════════════════════════════════════')
console.log('C4: Structural Guards')
console.log('══════════════════════════════════════')

const chatContent = fs.readFileSync('lib/handlers/chat.ts', 'utf-8')
const hardGatePos = chatContent.indexOf('5.10. HARD GATE MEDIA POLICY')
const imageLogicPos = chatContent.indexOf('Image Logic ([IMAGE:keyword])')
const policyCallPos = chatContent.indexOf('evaluatePhotoAuthorization')
assert('Hard gate block exists in chat.ts', hardGatePos > -1)
assert('Hard gate runs before image send block', hardGatePos > -1 && imageLogicPos > hardGatePos)
assert('chat.ts calls evaluatePhotoAuthorization', policyCallPos > -1)

const mediaNodeContent = fs.readFileSync('lib/swarm/nodes/media-node.ts', 'utf-8')
assert('media-node imports shared policy', mediaNodeContent.includes("from '@/lib/services/photo-request-policy'"))

const processorContent = fs.readFileSync('lib/services/whatsapp-processor.ts', 'utf-8')
const intentBlockStart = processorContent.indexOf('if (analysis.intentCategory)')
const intentBlockEnd = processorContent.indexOf("} else if (result.action === 'REQUEST_SOURCE')", intentBlockStart)
const intentBlock = intentBlockStart > -1 && intentBlockEnd > intentBlockStart
    ? processorContent.substring(intentBlockStart, intentBlockEnd)
    : ''

assert('Legacy processor block found', intentBlockStart > -1 && intentBlockEnd > intentBlockStart)
assert('No direct whatsapp.sendImage in intent SEND path', !intentBlock.includes('whatsapp.sendImage('))
assert('No direct whatsapp.sendVideo in intent SEND path', !intentBlock.includes('whatsapp.sendVideo('))
assert('Legacy direct SEND is explicitly disabled', processorContent.includes('Direct SEND path disabled'))

console.log('\n══════════════════════════════════════')
console.log(`RESULTS: ${passed} passed, ${failed} failed, ${passed + failed} total`)
console.log('══════════════════════════════════════')

if (failures.length > 0) {
    console.log('\nFAILURES:')
    failures.forEach((line) => console.log(line))
}

process.exit(failed > 0 ? 1 : 0)
