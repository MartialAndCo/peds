/**
 * Test complet du système de monitoring/logs
 * Vérifie tous les chemins de récupération de logs
 */

import axios from 'axios'

const BASE_URL = process.env.NEXTAUTH_URL || 'http://localhost:3000'
const BAILEYS_URL = process.env.WAHA_ENDPOINT || 'http://13.60.16.81:3001'
const API_KEY = process.env.AUTH_TOKEN || process.env.WAHA_API_KEY || 'e3f9a1c4d8b2f0a7c5e6d9b1a4f8c2d0e7b5a9c3f1d4b8e6a2f0c7'

interface TestResult {
  name: string
  success: boolean
  error?: string
  data?: any
}

const results: TestResult[] = []

async function testBaileysEndpoint() {
  console.log('\n=== Test 1: Baileys /api/logs endpoint ===\n')
  
  try {
    // Test sans clé API (endpoint exempté)
    const response = await axios.get(`${BAILEYS_URL}/api/logs?lines=10`, {
      timeout: 5000
    })
    
    if (response.data && response.data.success) {
      console.log('✅ Endpoint accessible')
      console.log(`   Lines returned: ${response.data.lines?.length || 0}`)
      if (response.data.lines?.length > 0) {
        console.log('   Sample log:', response.data.lines[0].substring(0, 80) + '...')
      } else {
        console.log('   ⚠️  WARNING: No logs in buffer (empty array)')
      }
      results.push({ name: 'Baileys /api/logs', success: true, data: response.data })
    } else {
      console.log('❌ Unexpected response:', response.data)
      results.push({ name: 'Baileys /api/logs', success: false, error: 'Unexpected response format' })
    }
  } catch (error: any) {
    console.log('❌ Failed:', error.message)
    console.log('   Code:', error.code)
    if (error.response) {
      console.log('   Status:', error.response.status)
      console.log('   Data:', error.response.data)
    }
    results.push({ 
      name: 'Baileys /api/logs', 
      success: false, 
      error: `${error.message} (${error.code})` 
    })
  }
}

async function testNextJsLogsApi() {
  console.log('\n=== Test 2: Next.js /api/admin/monitor/logs ===\n')
  
  try {
    // Cet endpoint nécessite une session - on teste juste que l'endpoint répond
    const response = await axios.get(`${BASE_URL}/api/admin/monitor/logs?sources=whatsapp&limit=5`, {
      timeout: 5000,
      validateStatus: () => true // Accepte toutes les réponses pour voir l'erreur
    })
    
    if (response.status === 401) {
      console.log('✅ Endpoint répond (401 Unauthorized = besoin de login, c\'est normal)')
      results.push({ name: 'Next.js /api/admin/monitor/logs', success: true, data: { status: 401 } })
    } else if (response.status === 200 && response.data.success) {
      console.log('✅ Endpoint accessible et fonctionne')
      console.log(`   Logs returned: ${response.data.logs?.length || 0}`)
      results.push({ name: 'Next.js /api/admin/monitor/logs', success: true, data: response.data })
    } else {
      console.log('❌ Unexpected response:', response.status, response.data)
      results.push({ 
        name: 'Next.js /api/admin/monitor/logs', 
        success: false, 
        error: `Status ${response.status}` 
      })
    }
  } catch (error: any) {
    console.log('❌ Failed:', error.message)
    results.push({ 
      name: 'Next.js /api/admin/monitor/logs', 
      success: false, 
      error: error.message 
    })
  }
}

async function testBaileysHealth() {
  console.log('\n=== Test 3: Baileys Health Check ===\n')
  
  try {
    const response = await axios.get(`${BAILEYS_URL}/health`, {
      timeout: 5000
    })
    
    console.log('✅ Baileys server is running')
    console.log('   Response:', response.data)
    results.push({ name: 'Baileys Health', success: true, data: response.data })
  } catch (error: any) {
    console.log('❌ Failed:', error.message)
    results.push({ 
      name: 'Baileys Health', 
      success: false, 
      error: error.message 
    })
  }
}

async function testDatabaseConnection() {
  console.log('\n=== Test 4: Database SystemLog table ===\n')
  
  try {
    const { prisma } = await import('../lib/prisma')
    
    // Count logs in database
    const count = await prisma.systemLog.count()
    console.log(`✅ Database connection OK`)
    console.log(`   SystemLog entries: ${count}`)
    
    // Get recent logs
    const recent = await prisma.systemLog.findMany({
      orderBy: { createdAt: 'desc' },
      take: 3,
      select: { id: true, source: true, level: true, message: true, createdAt: true }
    })
    
    if (recent.length > 0) {
      console.log('   Recent logs:')
      recent.forEach(log => {
        console.log(`     [${log.source}] ${log.level}: ${log.message.substring(0, 50)}...`)
      })
    } else {
      console.log('   ⚠️  No logs in database')
    }
    
    await prisma.$disconnect()
    results.push({ name: 'Database SystemLog', success: true, data: { count, recent } })
  } catch (error: any) {
    console.log('❌ Failed:', error.message)
    results.push({ 
      name: 'Database SystemLog', 
      success: false, 
      error: error.message 
    })
  }
}

async function testDirectBaileysWithKey() {
  console.log('\n=== Test 5: Baileys with API Key ===\n')
  
  try {
    const response = await axios.get(`${BAILEYS_URL}/api/logs?lines=10`, {
      headers: { 'X-Api-Key': API_KEY },
      timeout: 5000
    })
    
    console.log('✅ Request with API key succeeded')
    console.log(`   Lines: ${response.data.lines?.length || 0}`)
    results.push({ name: 'Baileys with API Key', success: true })
  } catch (error: any) {
    console.log('❌ Failed:', error.message)
    results.push({ 
      name: 'Baileys with API Key', 
      success: false, 
      error: error.message 
    })
  }
}

async function generateTestLog() {
  console.log('\n=== Test 6: Generate Test Log ===\n')
  
  try {
    // Create a test log entry in database
    const { prisma } = await import('../lib/prisma')
    
    const testLog = await prisma.systemLog.create({
      data: {
        source: 'nextjs',
        service: 'test',
        level: 'INFO',
        category: 'general',
        message: 'Test log entry from monitoring test script',
        context: 'Generated at ' + new Date().toISOString(),
        rawLine: '[TEST] Monitoring system test',
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
      }
    })
    
    console.log('✅ Test log created:', testLog.id)
    results.push({ name: 'Generate Test Log', success: true, data: { id: testLog.id } })
    
    await prisma.$disconnect()
  } catch (error: any) {
    console.log('❌ Failed:', error.message)
    results.push({ 
      name: 'Generate Test Log', 
      success: false, 
      error: error.message 
    })
  }
}

async function printSummary() {
  console.log('\n' + '='.repeat(60))
  console.log('TEST SUMMARY')
  console.log('='.repeat(60))
  
  const passed = results.filter(r => r.success).length
  const failed = results.filter(r => !r.success).length
  
  results.forEach(r => {
    const icon = r.success ? '✅' : '❌'
    console.log(`${icon} ${r.name}`)
    if (r.error) {
      console.log(`   Error: ${r.error}`)
    }
  })
  
  console.log('\n' + '-'.repeat(60))
  console.log(`Total: ${results.length} tests, ${passed} passed, ${failed} failed`)
  console.log('='.repeat(60))
  
  if (failed > 0) {
    console.log('\n🔧 RECOMMENDATIONS:')
    
    const baileysFail = results.find(r => r.name === 'Baileys /api/logs' && !r.success)
    if (baileysFail) {
      console.log('\n1. Baileys endpoint not accessible:')
      console.log('   - Check if WAHA_ENDPOINT env var is correct')
      console.log('   - Check if Baileys server is running on port 3001')
      console.log('   - Check firewall/security groups')
    }
    
    const dbFail = results.find(r => r.name === 'Database SystemLog' && !r.success)
    if (dbFail) {
      console.log('\n2. Database connection failed:')
      console.log('   - Check DATABASE_URL env var')
      console.log('   - Ensure Prisma schema is migrated')
    }
    
    const emptyBuffer = results.find(r => 
      r.name === 'Baileys /api/logs' && 
      r.success && 
      r.data?.lines?.length === 0
    )
    if (emptyBuffer) {
      console.log('\n3. Baileys log buffer is empty:')
      console.log('   - This is normal if server just started')
      console.log('   - The buffer only fills with HTTP requests and logged events')
      console.log('   - Need to add more addToLogBuffer() calls in Baileys')
    }
  }
}

async function main() {
  console.log('🔍 Testing Monitoring System...')
  console.log(`Base URL: ${BASE_URL}`)
  console.log(`Baileys URL: ${BAILEYS_URL}`)
  
  await testBaileysHealth()
  await testBaileysEndpoint()
  await testDirectBaileysWithKey()
  await testDatabaseConnection()
  await testNextJsLogsApi()
  await generateTestLog()
  
  await printSummary()
  
  process.exit(0)
}

main().catch(e => {
  console.error('Fatal error:', e)
  process.exit(1)
})
