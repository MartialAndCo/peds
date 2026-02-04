import { NextResponse } from 'next/server'
import { runSwarm } from '@/lib/swarm'
import { prisma } from '@/lib/prisma'

export async function GET() {
  const start = Date.now()
  
  try {
    const contact = await prisma.contact.create({
      data: { phone_whatsapp: `test-${Date.now()}`, name: 'Test' }
    })
    
    await prisma.agentContact.create({
      data: {
        agentId: 'cmkvg0kzz00003vyv03zzt9kc',
        contactId: contact.id,
        phase: 'CONNECTION',
        signals: []
      }
    })
    
    const msgStart = Date.now()
    const response = await runSwarm('Salut', [], contact.id, 'cmkvg0kzz00003vyv03zzt9kc', 'Test', 'text')
    const msgDuration = Date.now() - msgStart
    
    await prisma.agentContact.deleteMany({ where: { contactId: contact.id } })
    await prisma.contact.delete({ where: { id: contact.id } })
    
    return NextResponse.json({
      success: true,
      message: 'Salut',
      response,
      duration: msgDuration,
      totalTime: Date.now() - start
    })
    
  } catch (error: any) {
    console.error('[TestSwarm] Error:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
