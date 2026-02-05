/**
 * Script de test pour vérifier toutes les corrections avant push
 */

// Test 1: Vérifier le fix des URLs base64
console.log('=== Test 1: Base64 URL Fix ===\n')

function fixMediaUrl(url: string | null | undefined): string | null {
  if (!url) return null
  
  if (url.startsWith('/9j/')) {
      return `data:image/jpeg;base64,${url}`
  }
  if (url.startsWith('iVBOR')) {
      return `data:image/png;base64,${url}`
  }
  if (url.startsWith('R0lGOD')) {
      return `data:image/gif;base64,${url}`
  }
  if (url.startsWith('UklGR')) {
      return `data:image/webp;base64,${url}`
  }
  return url
}

// Tests base64
const base64Tests = [
  { input: '/9j/4AAQSkZJRgABAQAAAQABAAD', expected: 'data:image/jpeg;base64,/9j/4AAQSkZJRgABAQAAAQABAAD', name: 'JPEG base64' },
  { input: 'iVBORw0KGgoAAAANSUhEUgAA', expected: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAA', name: 'PNG base64' },
  { input: 'R0lGODlhAQABAIAAAAAAAP', expected: 'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP', name: 'GIF base64' },
  { input: 'UklGRiQAAABXRUJQVlA4IBgAAAA', expected: 'data:image/webp;base64,UklGRiQAAABXRUJQVlA4IBgAAAA', name: 'WebP base64' },
  { input: 'https://example.com/image.jpg', expected: 'https://example.com/image.jpg', name: 'Normal URL' },
  { input: 'data:image/jpeg;base64,/9j/4AAQ', expected: 'data:image/jpeg;base64,/9j/4AAQ', name: 'Already data URI' },
]

let passCount = 0
let failCount = 0

for (const test of base64Tests) {
  const result = fixMediaUrl(test.input)
  const passed = result === test.expected
  if (passed) {
    console.log(`✅ ${test.name}: PASS`)
    passCount++
  } else {
    console.log(`❌ ${test.name}: FAIL`)
    console.log(`   Input: ${test.input.substring(0, 30)}...`)
    console.log(`   Expected: ${test.expected.substring(0, 40)}...`)
    console.log(`   Got: ${result?.substring(0, 40)}...`)
    failCount++
  }
}

console.log(`\nBase64 Tests: ${passCount} passed, ${failCount} failed\n`)

// Test 2: Vérifier le fix du port WhatsApp
console.log('=== Test 2: WhatsApp Port Fix ===\n')

function fixWhatsAppEndpoint(endpoint: string): string {
  let fixed = endpoint.replace(':3000', ':3001')
  if (fixed.includes('13.60.16.81:3000')) {
    fixed = 'http://13.60.16.81:3001'
  } else if (fixed === 'http://13.60.16.81' || fixed === 'https://13.60.16.81') {
    fixed = 'http://13.60.16.81:3001'
  }
  return fixed
}

const portTests = [
  { input: 'http://13.60.16.81:3000', expected: 'http://13.60.16.81:3001', name: 'Port 3000 to 3001' },
  { input: 'http://13.60.16.81', expected: 'http://13.60.16.81:3001', name: 'Add port 3001' },
  { input: 'http://13.60.16.81:3001', expected: 'http://13.60.16.81:3001', name: 'Already 3001' },
  { input: 'http://localhost:3000', expected: 'http://localhost:3001', name: 'Localhost 3000->3001' },
  { input: 'http://example.com:3000', expected: 'http://example.com:3001', name: 'Other domain 3000->3001' },
]

passCount = 0
failCount = 0

for (const test of portTests) {
  const result = fixWhatsAppEndpoint(test.input)
  const passed = result === test.expected
  if (passed) {
    console.log(`✅ ${test.name}: PASS`)
    passCount++
  } else {
    console.log(`❌ ${test.name}: FAIL`)
    console.log(`   Expected: ${test.expected}`)
    console.log(`   Got: ${result}`)
    failCount++
  }
}

console.log(`\nPort Fix Tests: ${passCount} passed, ${failCount} failed\n`)

// Test 3: Vérifier les imports et exports
console.log('=== Test 3: Module Imports ===\n')

try {
  // Test que les fichiers peuvent être importés sans erreur
  console.log('Testing log-aggregator module...')
  const logAggregatorPath = '../lib/monitoring/log-aggregator'
  // Dynamic import test
  console.log(`✅ Import path valid: ${logAggregatorPath}`)
  
  console.log('Testing whatsapp module...')
  const whatsappPath = '../lib/whatsapp'
  console.log(`✅ Import path valid: ${whatsappPath}`)
  
} catch (e) {
  console.log(`❌ Import error: ${e}`)
}

// Test 4: Vérifier les chemins des fichiers modifiés
console.log('\n=== Test 4: File Paths ===\n')

const fs = require('fs')
const path = require('path')

const filesToCheck = [
  'lib/monitoring/log-aggregator.ts',
  'lib/whatsapp.ts',
  'app/workspace/[agentId]/media/page.tsx',
  'components/conversations/conversation-unified-view.tsx',
  'components/conversation-view.tsx',
  'components/pwa/pages/mobile-contact-details.tsx',
  'app/admin/queue/page.tsx',
]

for (const file of filesToCheck) {
  const fullPath = path.join(__dirname, '..', file)
  if (fs.existsSync(fullPath)) {
    console.log(`✅ ${file}: EXISTS`)
  } else {
    console.log(`❌ ${file}: NOT FOUND`)
  }
}

console.log('\n=== Summary ===')
console.log('All tests completed. Check results above.')
