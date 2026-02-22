/**
 * P6 — Photo Pipeline Unit Tests
 * Tests the 3 core logic components locally without DB dependencies:
 * - C1: isExplicitPhotoRequest() in media-node.ts
 * - C3: isUserRequestingPhoto() in action-agent.ts
 * - C2: Ordering verification (structural check)
 */

// ═══════════════════════════════════════════════════════════════════
// C1: isExplicitPhotoRequest — from media-node.ts (copy for testing)
// ═══════════════════════════════════════════════════════════════════

function isExplicitPhotoRequest(msg: string): boolean {
    const m = msg.toLowerCase();

    const nonDemandPatterns = [
        /j'ai pris.*photo/,
        /j'ai une photo/,
        /j'ai.*photo/,
        /photo de profil/,
        /belle(s)? photo/,
        /bonne photo/,
        /sur (la|une|cette) photo/,
        /c'est (une|la) photo/,
        /j'aime (la|ta|cette) photo/,
        /j'ai vu.*photo/,
        /ma photo/,
        /mes photos/,
        /photo de (mon|ma|mes)/,
        /la photo (de|du|des)/,
        /une photo de (mon|ma|mes|son|sa|ses)/,
        /i (took|have|had|saw|like|love).*photo/,
        /nice (photo|pic|picture)/,
        /great (photo|pic|picture)/,
        /good (photo|pic|picture)/,
    ];

    if (nonDemandPatterns.some(p => p.test(m))) return false;

    const demandVerbs = [
        'envoie', 'envoyer', 'envoi', 'montre', 'montrer', 'donne', 'donner',
        'send', 'show', 'give', 'want', 'veux', 'voudrais', 'peux avoir',
        'can i (see|get|have)', 'fais voir', 'jveux voir', 'je veux voir',
        'tu peux montrer', 'let me see'
    ];

    const photoNouns = ['photo', 'pic', 'picture', 'image', 'img'];

    for (const verb of demandVerbs) {
        for (const noun of photoNouns) {
            const pattern = new RegExp(`${verb}.*${noun}|${noun}.*${verb}`, 'i');
            if (pattern.test(m)) return true;
        }
    }

    const directPhrases = [
        'une photo de toi', 'photo of you', 'pic of you',
        'montre toi', 'show yourself', 'let me see you',
        'ta photo',
    ];

    if (directPhrases.some(p => m.includes(p))) return true;

    return false;
}

// ═══════════════════════════════════════════════════════════════════
// C3: isUserRequestingPhoto — from action-agent.ts (copy for testing)
// ═══════════════════════════════════════════════════════════════════

const PHOTO_DEMAND_PHRASES = [
    'envoie une photo', 'envoie moi', 'envoie-moi', 'montre-moi', 'montre toi',
    'fais voir', 'send me a pic', 'send a pic', 'send me a photo', 'show me',
    'let me see', 'photo de toi', 'picture of you', 'jveux voir',
    'je veux voir', 'tu peux montrer', 'see your face',
    'show yourself', 'send photo', 'your photo', 'ton visage', 'ta tête',
    'une photo de toi', 'pic of you'
];

const PHOTO_UNAMBIGUOUS_KEYWORDS = ['selfie'];

const PHOTO_FALSE_POSITIVE_PATTERNS = [
    /j'ai.*photo/i,
    /j'ai envoyé.*photo/i,
    /une photo de (mon|ma|mes|son|sa|ses)/i,
    /photo de (mon|ma|mes)/i,
    /photo de profil/i,
    /j'ai pris.*photo/i,
    /belle(s)? photo/i,
    /bonne photo/i,
    /sur (la|une|cette) photo/i,
    /c'est (une|la) photo/i,
    /j'aime (la|ta|cette) photo/i,
    /j'ai vu.*photo/i,
    /ma photo/i,
    /mes photos/i,
    /la photo (de|du|des)/i,
    /i (took|have|had|saw|like|love).*photo/i,
    /nice (photo|pic|picture)/i,
    /great (photo|pic|picture)/i,
    /good (photo|pic|picture)/i,
];

function isUserRequestingPhoto(userMessage: string): boolean {
    const msg = userMessage.toLowerCase();
    if (PHOTO_FALSE_POSITIVE_PATTERNS.some(p => p.test(msg))) return false;
    if (PHOTO_UNAMBIGUOUS_KEYWORDS.some(kw => msg.includes(kw))) return true;
    if (PHOTO_DEMAND_PHRASES.some(phrase => msg.includes(phrase))) return true;
    return false;
}

// ═══════════════════════════════════════════════════════════════════
// TEST RUNNER
// ═══════════════════════════════════════════════════════════════════

let passed = 0;
let failed = 0;
const failures: string[] = [];

function assert(testName: string, actual: boolean, expected: boolean) {
    if (actual === expected) {
        passed++;
        console.log(`  ✅ ${testName}`);
    } else {
        failed++;
        const msg = `  ❌ ${testName} — expected ${expected}, got ${actual}`;
        console.log(msg);
        failures.push(msg);
    }
}

// ── C1 TESTS: isExplicitPhotoRequest ──

console.log('\n══════════════════════════════════════');
console.log('C1: isExplicitPhotoRequest() Tests');
console.log('══════════════════════════════════════');

console.log('\n--- Should REJECT (false positives) ---');
assert("j'ai pris une photo de mon chat", isExplicitPhotoRequest("j'ai pris une photo de mon chat"), false);
assert("j'ai une photo de ma mère", isExplicitPhotoRequest("j'ai une photo de ma mère"), false);
assert("belle photo !", isExplicitPhotoRequest("belle photo !"), false);
assert("bonne photo", isExplicitPhotoRequest("bonne photo"), false);
assert("j'aime ta photo de profil", isExplicitPhotoRequest("j'aime ta photo de profil"), false);
assert("sur la photo tu es belle", isExplicitPhotoRequest("sur la photo tu es belle"), false);
assert("c'est une photo de vacances", isExplicitPhotoRequest("c'est une photo de vacances"), false);
assert("j'ai vu ta photo sur insta", isExplicitPhotoRequest("j'ai vu ta photo sur insta"), false);
assert("photo de mon chien", isExplicitPhotoRequest("photo de mon chien"), false);
assert("ma photo est floue", isExplicitPhotoRequest("ma photo est floue"), false);
assert("mes photos de vacances", isExplicitPhotoRequest("mes photos de vacances"), false);
assert("nice photo of the sunset", isExplicitPhotoRequest("nice photo of the sunset"), false);
assert("I took a photo yesterday", isExplicitPhotoRequest("I took a photo yesterday"), false);
assert("I love that photo", isExplicitPhotoRequest("I love that photo"), false);
assert("la photo du restaurant", isExplicitPhotoRequest("la photo du restaurant"), false);
assert("une photo de son chat", isExplicitPhotoRequest("une photo de son chat"), false);

// Bare keywords should NOT match
assert("photo (bare word)", isExplicitPhotoRequest("photo"), false);
assert("pic (bare word)", isExplicitPhotoRequest("pic"), false);
assert("image (bare word)", isExplicitPhotoRequest("image"), false);
assert("tu as une belle image", isExplicitPhotoRequest("tu as une belle image"), false);

console.log('\n--- Should ACCEPT (genuine requests) ---');
assert("envoie moi une photo", isExplicitPhotoRequest("envoie moi une photo"), true);
assert("montre moi une photo de toi", isExplicitPhotoRequest("montre moi une photo de toi"), true);
assert("send me a photo", isExplicitPhotoRequest("send me a photo"), true);
assert("send me a pic", isExplicitPhotoRequest("send me a pic"), true);
assert("show me a picture", isExplicitPhotoRequest("show me a picture"), true);
assert("je veux voir une photo", isExplicitPhotoRequest("je veux voir une photo"), true);
assert("une photo de toi stp", isExplicitPhotoRequest("une photo de toi stp"), true);
assert("montre toi bb", isExplicitPhotoRequest("montre toi bb"), true);
assert("photo of you please", isExplicitPhotoRequest("photo of you please"), true);
assert("donne moi une image", isExplicitPhotoRequest("donne moi une image"), true);
assert("I want a pic", isExplicitPhotoRequest("I want a pic"), true);
assert("fais voir une photo", isExplicitPhotoRequest("fais voir une photo"), true);
assert("let me see a pic", isExplicitPhotoRequest("let me see a pic"), true);
assert("show yourself", isExplicitPhotoRequest("show yourself"), true);

// ── C3 TESTS: isUserRequestingPhoto ──

console.log('\n══════════════════════════════════════');
console.log('C3: isUserRequestingPhoto() Tests');
console.log('══════════════════════════════════════');

console.log('\n--- Should REJECT (false positives) ---');
assert("[C3] j'ai pris une photo", isUserRequestingPhoto("j'ai pris une photo"), false);
assert("[C3] belle photo", isUserRequestingPhoto("belle photo"), false);
assert("[C3] photo de mon chat", isUserRequestingPhoto("photo de mon chat"), false);
assert("[C3] sur la photo", isUserRequestingPhoto("sur la photo tu es mignonne"), false);
assert("[C3] nice photo", isUserRequestingPhoto("nice photo"), false);
assert("[C3] I have a photo", isUserRequestingPhoto("I have a photo of my dog"), false);
assert("[C3] bare 'photo'", isUserRequestingPhoto("photo"), false);
assert("[C3] c'est la photo", isUserRequestingPhoto("c'est la photo de hier"), false);

console.log('\n--- Should ACCEPT (genuine requests) ---');
assert("[C3] selfie", isUserRequestingPhoto("fais un selfie"), true);
assert("[C3] envoie une photo", isUserRequestingPhoto("envoie une photo"), true);
assert("[C3] montre toi", isUserRequestingPhoto("montre toi"), true);
assert("[C3] send me a pic", isUserRequestingPhoto("send me a pic"), true);
assert("[C3] show me", isUserRequestingPhoto("show me"), true);
assert("[C3] photo de toi", isUserRequestingPhoto("photo de toi"), true);
assert("[C3] send photo", isUserRequestingPhoto("send photo"), true);
assert("[C3] let me see", isUserRequestingPhoto("let me see"), true);
assert("[C3] une photo de toi", isUserRequestingPhoto("une photo de toi"), true);
assert("[C3] je veux voir", isUserRequestingPhoto("je veux voir"), true);
assert("[C3] see your face", isUserRequestingPhoto("see your face"), true);

// ── C2 TESTS: Supervisor ordering (structural verification) ──

console.log('\n══════════════════════════════════════');
console.log('C2: Supervisor Ordering (structural)');
console.log('══════════════════════════════════════');

const fs = require('fs');
const chatContent = fs.readFileSync('lib/handlers/chat.ts', 'utf-8');
const supervisorPos = chatContent.indexOf('5.8. SUPERVISOR AI - BLOQUANT');
const tagStrippingPos = chatContent.indexOf('5.9. TAG STRIPPING');

assert("[C2] Supervisor block exists", supervisorPos > -1, true);
assert("[C2] Tag stripping block exists", tagStrippingPos > -1, true);
assert("[C2] Supervisor BEFORE tag stripping", supervisorPos < tagStrippingPos, true);

// Verify supervisor sees raw response (with potential IMAGE tags)
const supervisorSection = chatContent.substring(supervisorPos, tagStrippingPos);
assert("[C2] Supervisor uses responseText (with tags)", supervisorSection.includes('aiResponse: responseText'), true);

// ── C4 TESTS: Rate-limiting (structural verification) ──

console.log('\n══════════════════════════════════════');
console.log('C4: Rate-Limiting (structural)');
console.log('══════════════════════════════════════');

const rateLimitPos = chatContent.indexOf('RATE LIMIT');
const imageProcessPos = chatContent.indexOf('AI wanted to send');

assert("[C4] Rate-limit check exists", rateLimitPos > -1, true);
assert("[C4] Image processing exists", imageProcessPos > -1, true);
assert("[C4] Rate-limit BEFORE image processing", rateLimitPos < imageProcessPos, true);
assert("[C4] Uses startsWith '[Sent Media:'", chatContent.includes("startsWith: '[Sent Media:'"), true);
assert("[C4] Max 3 photos check", chatContent.includes('photosSentToday >= 3'), true);

// ── C5 TESTS: Available media types (structural verification) ──

console.log('\n══════════════════════════════════════');
console.log('C5: Available Media Types (structural)');
console.log('══════════════════════════════════════');

const mediaNodeContent = fs.readFileSync('lib/swarm/nodes/media-node.ts', 'utf-8');
assert("[C5] Queries prisma.media", mediaNodeContent.includes('prisma.media.findMany'), true);
assert("[C5] Filters by sentTo", mediaNodeContent.includes('sentTo'), true);
assert("[C5] Injects PHOTOS DISPONIBLES", mediaNodeContent.includes('PHOTOS DISPONIBLES'), true);
assert("[C5] Handles empty case", mediaNodeContent.includes("'aucune'"), true);
assert("[C5] Uses contactPhone from state", mediaNodeContent.includes('contactPhone'), true);

// ═══════════════════════════════════════════════════════════════════
// RESULTS
// ═══════════════════════════════════════════════════════════════════

console.log('\n══════════════════════════════════════');
console.log(`RESULTS: ${passed} passed, ${failed} failed, ${passed + failed} total`);
console.log('══════════════════════════════════════');

if (failures.length > 0) {
    console.log('\nFAILURES:');
    failures.forEach(f => console.log(f));
}

process.exit(failed > 0 ? 1 : 0);
