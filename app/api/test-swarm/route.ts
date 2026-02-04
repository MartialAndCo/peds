/**
 * API Route pour tester le système Swarm en conditions réelles
 * GET /api/test-swarm
 */

import { NextResponse } from 'next/server'
import { runSwarm } from '@/lib/swarm'
import { prisma } from '@/lib/prisma'
import { aiConfig } from '@/lib/config/ai-mode'
import { venice } from '@/lib/venice'

// Force mode SWARM
aiConfig.setMode('SWARM')

function checkStyle(response: string): { valid: boolean; issues: string[] } {
  const issues: string[] = []
  
  // Check style Anais (15 ans, adolescence)
  if (response.includes(',')) issues.push('virgule')
  if (response.trim().endsWith('.')) issues.push('point final')
  
  const longWords = ['je suis', 'tu es', 'je ne', 'comment', 'pourquoi', 'parce que']
  for (const w of longWords) {
    if (response.toLowerCase().includes(w)) {
      issues.push(`phrase complète "${w}"`)
      break
    }
  }
  
  const words = response.split(/\s+/).length
  if (words > 8) issues.push(`trop long (${words} mots)`)
  
  return { valid: issues.length === 0, issues }
}

export async function GET() {
  try {
    console.log('[TestSwarm] Starting integration test...')
    
    const results: any[] = []
    const agentStats: Record<string, number> = {}
    
    // Récupère Anaïs
    const profile = await prisma.agentProfile.findFirst({
      where: { agentId: 'cmkvg0kzz00003vyv03zzt9kc' }
    })
    
    if (!profile) {
      return NextResponse.json({ error: 'Agent not found' }, { status: 404 })
    }
    
    // Crée contact test
    const phone = `test-swarm-${Date.now()}`
    const contact = await prisma.contact.create({
      data: {
        phone_whatsapp: phone,
        name: 'TestSwarmAPI'
      }
    })
    
    // Crée AgentContact en CONNECTION
    const agentContact = await prisma.agentContact.create({
      data: {
        agentId: profile.agentId,
        contactId: contact.id,
        phase: 'CONNECTION',
        signals: []
      }
    })
    
    const history: any[] = []
    
    // Test 1: Messages basiques
    const testMessages = [
      { msg: 'Salut', desc: 'Salutation' },
      { msg: 'Ça va', desc: 'Question simple' },
      { msg: 'Tu fais quoi', desc: 'Activité' },
      { msg: 'T\'es où', desc: 'Localisation' }
    ]
    
    for (const test of testMessages) {
      const start = Date.now()
      
      const response = await runSwarm(
        test.msg,
        history,
        contact.id,
        profile.agentId,
        contact.name || 'Test',
        'text'
      )
      
      const duration = Date.now() - start
      const styleCheck = checkStyle(response)
      
      results.push({
        phase: 'CONNECTION',
        message: test.msg,
        description: test.desc,
        response,
        duration,
        styleValid: styleCheck.valid,
        styleIssues: styleCheck.issues
      })
      
      history.push(
        { role: 'user', content: test.msg },
        { role: 'assistant', content: response }
      )
    }
    
    // Passe en CRISIS et test paiement
    await prisma.agentContact.update({
      where: { id: agentContact.id },
      data: { phase: 'CRISIS', signals: ['ATTACHED'] }
    })
    
    const paymentMessages = [
      { msg: 'T\'as besoin d\'argent', desc: 'Proposition aide' },
      { msg: 'Je peux t\'envoyer 50€', desc: 'Offre paiement' }
    ]
    
    for (const test of paymentMessages) {
      const start = Date.now()
      
      const response = await runSwarm(
        test.msg,
        history,
        contact.id,
        profile.agentId,
        contact.name || 'Test',
        'text'
      )
      
      const duration = Date.now() - start
      const styleCheck = checkStyle(response)
      
      results.push({
        phase: 'CRISIS',
        message: test.msg,
        description: test.desc,
        response,
        duration,
        styleValid: styleCheck.valid,
        styleIssues: styleCheck.issues
      })
      
      history.push(
        { role: 'user', content: test.msg },
        { role: 'assistant', content: response }
      )
    }
    
    // Cleanup
    await prisma.agentContact.delete({ where: { id: agentContact.id } })
    await prisma.contact.delete({ where: { id: contact.id } })
    
    // Stats
    const avgTime = results.reduce((a, r) => a + r.duration, 0) / results.length
    const styleOk = results.filter(r => r.styleValid).length
    
    return NextResponse.json({
      mode: aiConfig.mode,
      agent: profile.agentId,
      veniceClient: venice.constructor.name,
      totalTests: results.length,
      avgResponseTime: Math.round(avgTime),
      styleOkCount: styleOk,
      results
    })
    
  } catch (error: any) {
    console.error('[TestSwarm] Error:', error)
    return NextResponse.json({
      error: error.message,
      stack: error.stack
    }, { status: 500 })
  }
}
