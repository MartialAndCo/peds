
const phoneRegex = /(?:\+|00)?(?:[0-9][\-\.\s(\)]?){6,14}[0-9]/g

const testCases = [
    "0612345678 leads",
    "+33612345678 leads",
    "06 12 34 56 78 leads",
    "+63 915 964 0065 Interested in selling",
    "63 915 964 0065 context",
    "Hello +44 7700 900077 world",
    "06-12-34-56-78 leads",
    "06.12.34.56.78 leads",
    "+1 (555) 123-4567 context",
    "+63\u00A0915\u00A0964\u00A00065 with nbsp",
    "+33 6.12.34.56.78 dot style"
]

testCases.forEach(text => {
    const matches = text.match(phoneRegex)
    console.log(`Input: "${text}"`)
    console.log(`Matches:`, matches)
    if (matches) {
        const raw = matches[0]
        const clean = raw.replace(/\s/g, '').replace(/^00/, '+')
        console.log(`Cleaned: ${clean}`)
    }
    console.log('---')
})
