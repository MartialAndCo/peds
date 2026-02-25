import { enforceLength } from '@/lib/services/response-length-guard'
import { venice } from '@/lib/venice'

let passed = 0
let failed = 0

function assert(testName: string, condition: boolean, details?: string) {
    if (condition) {
        passed++
        console.log(`  PASS ${testName}`)
        return
    }

    failed++
    console.log(`  FAIL ${testName}${details ? ` (${details})` : ''}`)
}

function splitBubbles(text: string): string[] {
    return text.split(/\|+/).map((part) => part.trim()).filter(Boolean)
}

function countWords(text: string): number {
    const withoutTags = text.replace(/\[(?:IMAGE:[^\]]+|VIDEO:[^\]]+|VOICE|REACT:[^\]]+|PAYMENT_RECEIVED|VERIFY_PAYMENT|VERIFIER_PAIEMENT|PAIEMENT_REÇU|PAIEMENT_RECU)\]/gi, ' ')
    const words = withoutTags.match(/[0-9A-Za-zÀ-ÖØ-öø-ÿ]+(?:['’\-][0-9A-Za-zÀ-ÖØ-öø-ÿ]+)*/g)
    return words?.length || 0
}

async function testShortMessageUnchanged() {
    console.log('\n[TEST] length guard keeps short message unchanged')
    const text = 'salut tu vas bien'
    const result = await enforceLength({
        text,
        locale: 'fr-FR',
        source: 'test.short'
    })

    assert('short message status ok', result.status === 'ok', `status=${result.status}`)
    assert('short message unchanged', result.text === text, `text="${result.text}"`)
}

async function testLongMessageCondensed() {
    console.log('\n[TEST] length guard condenses long message')
    const originalCompletion = venice.chatCompletion
    venice.chatCompletion = (async () => 'je passe plus tard|||on parle apres') as typeof venice.chatCompletion

    try {
        const result = await enforceLength({
            text: 'je voulais te dire que je suis encore en cours et je vais rentrer plus tard ce soir parce que jai beaucoup de devoirs',
            locale: 'fr-FR',
            source: 'test.condense'
        })

        const bubbles = splitBubbles(result.text)
        const maxWords = Math.max(...bubbles.map(countWords))

        assert('long message status ok', result.status === 'ok', `status=${result.status}`)
        assert('long message <= 2 bubbles', bubbles.length <= 2, `bubbles=${bubbles.length}`)
        assert('long message <= 12 words per bubble', maxWords <= 12, `maxWords=${maxWords}`)
    } finally {
        venice.chatCompletion = originalCompletion
    }
}

async function testFunctionalTagsPreserved() {
    console.log('\n[TEST] length guard preserves functional tags')
    const originalCompletion = venice.chatCompletion
    venice.chatCompletion = (async () => '[IMAGE:selfie] je passe apres|||[VOICE] demain je reviens') as typeof venice.chatCompletion

    try {
        const input = '[IMAGE:selfie] je voulais te dire que je suis dehors et je rentre plus tard ce soir parce que tout est ferme [VOICE]'
        const result = await enforceLength({
            text: input,
            locale: 'fr-FR',
            source: 'test.tags'
        })

        assert('tag preserve status ok', result.status === 'ok', `status=${result.status}`)
        assert('keeps IMAGE tag', result.text.includes('[IMAGE:selfie]'))
        assert('keeps VOICE tag', result.text.toUpperCase().includes('[VOICE]'))
    } finally {
        venice.chatCompletion = originalCompletion
    }
}

async function testBlockedOnCondenseFailure() {
    console.log('\n[TEST] length guard blocks on condense timeout/error')
    const originalCompletion = venice.chatCompletion
    venice.chatCompletion = (async () => {
        throw new Error('condense_timeout')
    }) as typeof venice.chatCompletion

    try {
        const result = await enforceLength({
            text: 'i wanted to explain everything in detail because there are too many things happening tonight and i cannot keep this short right now',
            locale: 'en-US',
            source: 'test.blocked'
        })

        assert('blocked status returned', result.status === 'blocked', `status=${result.status}`)
    } finally {
        venice.chatCompletion = originalCompletion
    }
}

async function testBlockedOnInvalidCondense() {
    console.log('\n[TEST] length guard blocks on invalid condensation')
    const originalCompletion = venice.chatCompletion
    venice.chatCompletion = (async () => 'this response is definitely still too long and keeps going without proper splitting') as typeof venice.chatCompletion

    try {
        const result = await enforceLength({
            text: 'this message has way too many words and needs to be split in short bubbles immediately because it is unreadable',
            locale: 'en-US',
            source: 'test.invalid-condense'
        })

        assert('invalid condensed output is blocked', result.status === 'blocked', `status=${result.status}`)
    } finally {
        venice.chatCompletion = originalCompletion
    }
}

async function main() {
    console.log('=== RESPONSE LENGTH GUARD TESTS ===')
    await testShortMessageUnchanged()
    await testLongMessageCondensed()
    await testFunctionalTagsPreserved()
    await testBlockedOnCondenseFailure()
    await testBlockedOnInvalidCondense()

    console.log(`\nRESULT: ${passed} passed, ${failed} failed`)
    process.exit(failed > 0 ? 1 : 0)
}

main().catch((error) => {
    console.error('Fatal test error:', error)
    process.exit(1)
})
