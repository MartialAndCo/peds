/**
 * Test la détection des logs Amplify dans les logs Baileys
 */

import { parseLogLine } from '../lib/monitoring/error-patterns'

console.log('=== Test Amplify Log Detection ===\n')

// Exemples de logs Amplify qui arrivent dans Docker/Baileys
const testLogs = [
  {
    name: 'Amplify build failed',
    line: '2026-02-05T12:34:56.789Z [amplify] Build failed: npm ERR! code ELIFECYCLE',
    expectedService: 'amplify',
    expectedLevel: 'CRITICAL'  // build failed = CRITICAL
  },
  {
    name: 'Amplify provisioning error',
    line: '2026-02-05T12:34:56.789Z [amplify] Provisioning error: Failed to create resources',
    expectedService: 'amplify',
    expectedLevel: 'CRITICAL'  // contains 'amplify' = CRITICAL pattern
  },
  {
    name: 'Amplify deploy failed',
    line: '2026-02-05T12:34:56.789Z Amplify deploy failed on branch main',
    expectedService: 'amplify',
    expectedLevel: 'CRITICAL'
  },
  {
    name: 'Frontend build error',
    line: '2026-02-05T12:34:56.789Z Frontend build error: Module not found',
    expectedService: 'amplify',
    expectedLevel: 'ERROR'
  },
  {
    name: 'Normal WhatsApp log',
    line: '2026-02-05T12:34:56.789Z [default] Connection established',
    expectedService: 'whatsapp',
    expectedLevel: null
  },
  {
    name: 'Error with amplify keyword',
    line: '[ERROR] 2026-02-05T10:30:00.123Z amplify build failed: compilation error',
    expectedService: 'amplify',
    expectedLevel: 'CRITICAL'
  },
  {
    name: 'JSON log Pino - API 402 error',
    line: '{"level":50,"time":1770301616977,"pid":17,"hostname":"4a234783ad3a","agentId":"cmkvg0kzz00003vyv03zzt9kc","error":{"message":"API 402","stack":"Error: API 402\n    at r (/var/task/.next/server/chunks/[root-of-the-server]__55118f11._.js:71:388)"},"traceId":"1770301607751-28hn4i4a45h","timestamp":1770301616968,"source":"amplify","msg":"Processor fatal error"}',
    expectedService: 'amplify',
    expectedLevel: 'CRITICAL'
  },
  {
    name: 'JSON log Pino - WARN level (ignored)',
    line: '{"level":30,"time":1770301616977,"pid":17,"msg":"Info log"}',
    expectedService: 'nextjs',
    expectedLevel: null
  },
  {
    name: 'False positive - timestamp with 504',
    line: '2026-02-05T17:46:57.504Z [GET] /api/sessions/default/status - 200',
    expectedService: 'whatsapp',
    expectedLevel: null  // Ne doit pas être détecté comme erreur 504
  },
  {
    name: 'Real 504 error',
    line: '2026-02-05T17:46:57.123Z [ERROR] HTTP 504 - Gateway timeout',
    expectedService: 'whatsapp',
    expectedLevel: 'ERROR'
  }
]

let passCount = 0
let failCount = 0

for (const test of testLogs) {
  const result = parseLogLine(test.line, 'whatsapp')
  
  const isNullExpected = test.expectedLevel === null
  const isNullGot = result === null
  
  let passed: boolean
  if (isNullExpected) {
    passed = isNullGot
  } else {
    passed = result?.service === test.expectedService && result?.level === test.expectedLevel
  }
  
  if (passed) {
    console.log(`✅ ${test.name}`)
    if (result) {
      console.log(`   Service: ${result.service}, Level: ${result.level}`)
    } else {
      console.log(`   (no error detected - as expected)`)
    }
    passCount++
  } else {
    console.log(`❌ ${test.name}`)
    console.log(`   Expected: service=${test.expectedService}, level=${test.expectedLevel}`)
    console.log(`   Got: service=${result?.service}, level=${result?.level}`)
    failCount++
  }
  console.log()
}

console.log('========================================')
console.log(`Results: ${passCount} passed, ${failCount} failed`)
console.log('========================================')

if (failCount > 0) {
  process.exit(1)
}
