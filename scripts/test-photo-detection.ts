// Test script to verify photo request detection logic
// This tests the mediaService.analyzeRequest function

import { mediaService } from '../lib/media'

async function testPhotoDetection() {
    console.log('=== Testing Photo Request Detection ===\n')
    
    const testCases = [
        {
            text: "I like hiking reading camping take nature pics and eating",
            shouldBeMediaRequest: false,
            description: "User talking about hobbies (taking nature pics)"
        },
        {
            text: "Send me a photo of you",
            shouldBeMediaRequest: true,
            description: "Explicit photo request"
        },
        {
            text: "Show me your face",
            shouldBeMediaRequest: true,
            description: "Request to see face"
        },
        {
            text: "I love photography, I take pictures every day",
            shouldBeMediaRequest: false,
            description: "User talking about their photography hobby"
        },
        {
            text: "Can you send me a selfie?",
            shouldBeMediaRequest: true,
            description: "Explicit selfie request"
        },
        {
            text: "Look at this photo I took",
            shouldBeMediaRequest: false,
            description: "User sharing their own photo"
        },
        {
            text: "I want to see you",
            shouldBeMediaRequest: true,
            description: "Implicit request to see person"
        }
    ]
    
    let passed = 0
    let failed = 0
    
    for (const testCase of testCases) {
        console.log(`Testing: "${testCase.text}"`)
        console.log(`Expected: isMediaRequest = ${testCase.shouldBeMediaRequest} (${testCase.description})`)
        
        try {
            // Mock history
            const history: {role: string, content: string}[] = []
            
            const result = await mediaService.analyzeRequest(
                testCase.text,
                '+33612345678', // mock phone
                'test-agent-id',
                history
            )
            
            if (result) {
                const actual = result.isMediaRequest
                const expected = testCase.shouldBeMediaRequest
                
                if (actual === expected) {
                    console.log(`✅ PASS: isMediaRequest = ${actual}`)
                    passed++
                } else {
                    console.log(`❌ FAIL: Got isMediaRequest = ${actual}, expected ${expected}`)
                    console.log(`   Full result:`, JSON.stringify(result, null, 2))
                    failed++
                }
            } else {
                console.log(`⚠️  No result from analyzeRequest`)
                failed++
            }
        } catch (error) {
            console.log(`❌ ERROR:`, error)
            failed++
        }
        
        console.log('')
    }
    
    console.log('=== Results ===')
    console.log(`Passed: ${passed}/${testCases.length}`)
    console.log(`Failed: ${failed}/${testCases.length}`)
    
    if (failed > 0) {
        console.log('\n⚠️  Some tests failed. The AI prompt needs adjustment.')
        process.exit(1)
    } else {
        console.log('\n✅ All tests passed!')
        process.exit(0)
    }
}

testPhotoDetection()
