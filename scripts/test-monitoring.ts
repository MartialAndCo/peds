#!/usr/bin/env tsx
/**
 * Script de test pour le système de monitoring
 * Usage: npx tsx scripts/test-monitoring.ts
 */

import axios from 'axios'

const BASE_URL = process.env.NEXTAUTH_URL || 'http://localhost:3000'
const WEBHOOK_SECRET = process.env.WEBHOOK_SECRET || ''

async function testMonitoring() {
  console.log('🧪 Testing System Monitoring...\n')
  
  // Test 1: Collect logs
  console.log('1️⃣ Testing log collection...')
  try {
    const res = await axios.post(`${BASE_URL}/api/admin/monitor/collect`, {}, {
      headers: { 'x-internal-secret': WEBHOOK_SECRET }
    })
    console.log('✅ Collect:', res.data)
  } catch (e: any) {
    console.error('❌ Collect failed:', e.response?.data || e.message)
  }
  
  // Test 2: Get logs
  console.log('\n2️⃣ Testing log retrieval...')
  try {
    const res = await axios.get(`${BASE_URL}/api/admin/monitor/logs?since=120&limit=10`, {
      headers: { 'x-internal-secret': WEBHOOK_SECRET }
    })
    console.log('✅ Logs retrieved:', res.data.logs.length, 'entries')
    console.log('📊 Stats:', res.data.stats)
  } catch (e: any) {
    console.error('❌ Logs failed:', e.response?.data || e.message)
  }
  
  // Test 3: Cleanup
  console.log('\n3️⃣ Testing cleanup...')
  try {
    const res = await axios.get(`${BASE_URL}/api/cron/cleanup-logs`, {
      headers: { 'x-internal-secret': WEBHOOK_SECRET }
    })
    console.log('✅ Cleanup:', res.data)
  } catch (e: any) {
    console.error('❌ Cleanup failed:', e.response?.data || e.message)
  }
  
  // Test 4: Docker logs (via Baileys)
  console.log('\n4️⃣ Testing Docker logs endpoint...')
  try {
    const BAILEYS_URL = process.env.WAHA_ENDPOINT || 'http://13.60.16.81:3001'
    const AUTH_TOKEN = process.env.AUTH_TOKEN || ''
    const res = await axios.get(`${BAILEYS_URL}/api/docker-logs?container=discord_bot&lines=10`, {
      headers: { 'X-Api-Key': AUTH_TOKEN },
      timeout: 10000
    })
    console.log('✅ Docker logs:', res.data.container, '-', res.data.lines.length, 'lines')
  } catch (e: any) {
    console.error('❌ Docker logs failed:', e.response?.data || e.message)
  }
  
  console.log('\n✨ Tests completed!')
}

testMonitoring().catch(console.error)
