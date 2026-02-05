import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { settingsService } from '@/lib/settings-cache'
import { venice } from '@/lib/venice'
import { anthropic } from '@/lib/anthropic'

export const dynamic = 'force-dynamic'

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id: idStr } = await params
    const id = parseInt(idStr)
    if (isNaN(id)) {
      return NextResponse.json({ error: 'Invalid ID' }, { status: 400 })
    }

    // Get conversation with ALL relations
    const conversation = await prisma.conversation.findUnique({
      where: { id },
      include: { 
        contact: true,
        prompt: true,
        agent: {
          include: {
            profile: true
          }
        }
      }
    })

    if (!conversation) {
      return NextResponse.json({ error: 'Conversation not found' }, { status: 404 })
    }

    // Get agent profile
    const profile = conversation.agent?.profile
    if (!profile) {
      return NextResponse.json({ error: 'Agent profile not found' }, { status: 404 })
    }

    // Get settings
    const settings = await settingsService.getSettings()
    
    // Fetch agent-specific settings
    const agentWithSettings = await prisma.agent.findUnique({
      where: { id: conversation.agentId || undefined },
      include: { settings: true }
    })
    
    agentWithSettings?.settings.forEach((s: any) => {
      settings[s.key] = s.value
    })

    // Get recent messages for context
    const recentMessages = await prisma.message.findMany({
      where: { conversationId: id },
      orderBy: { timestamp: 'desc' },
      take: 15
    })

    const history = recentMessages.reverse().map((m: any) => ({
      role: m.sender === 'contact' ? 'user' : 'assistant',
      content: m.message_text
    })) as Array<{role: string, content: string}>

    // Get AgentContact for phase and signals
    const agentContact = await prisma.agentContact.findFirst({
      where: {
        agentId: conversation.agentId || '',
        contactId: conversation.contactId
      }
    })

    const currentPhase = agentContact?.phase || conversation.contact.agentPhase || 'CONNECTION'

    // Build the FULL system prompt like the real chat handler
    let systemPrompt = ''

    // 1. IDENTITY (CRITICAL - who the agent is)
    if (profile.identityTemplate) {
      systemPrompt += profile.identityTemplate + '\n\n'
    }

    // 2. CONTEXT (location, family, etc.)
    if (profile.contextTemplate) {
      systemPrompt += profile.contextTemplate + '\n\n'
    }

    // 3. CURRENT PHASE TEMPLATE
    const phaseTemplates: Record<string, string | null> = {
      'CONNECTION': profile.phaseConnectionTemplate,
      'VULNERABILITY': profile.phaseVulnerabilityTemplate,
      'CRISIS': profile.phaseCrisisTemplate,
      'MONEYPOT': profile.phaseMoneypotTemplate
    }
    const phaseTemplate = phaseTemplates[currentPhase]
    if (phaseTemplate) {
      systemPrompt += phaseTemplate + '\n\n'
    }

    // 4. STYLE RULES (how to write)
    if (profile.styleRules) {
      systemPrompt += profile.styleRules + '\n\n'
    }

    // 5. SAFETY RULES
    if (profile.safetyRules) {
      systemPrompt += profile.safetyRules + '\n\n'
    }

    // 6. PAYMENT RULES (if MONEYPOT phase)
    if (currentPhase === 'MONEYPOT' && profile.paymentRules) {
      systemPrompt += profile.paymentRules + '\n\n'
    }

    // 7. MISSION TEMPLATE
    if (profile.missionTemplate) {
      systemPrompt += profile.missionTemplate + '\n\n'
    }

    // Add regeneration-specific instruction
    systemPrompt += `\n\n[REGENERATION MODE]: Generate your next response to continue this conversation naturally. Stay in character. Keep it short and authentic to your personality. Don't break the fourth wall. Don't mention being an AI.`

    // Generate AI response
    const provider = settings.ai_provider || 'venice'
    let responseText = ""

    if (provider === 'anthropic') {
      responseText = await anthropic.chatCompletion(
        systemPrompt,
        history,
        "Continue the conversation.",
        { 
          apiKey: settings.anthropic_api_key, 
          model: settings.anthropic_model || 'claude-3-haiku-20240307',
          temperature: 0.8,
          max_tokens: 300 // Keep it concise
        }
      )
    } else {
      responseText = await venice.chatCompletion(
        systemPrompt,
        history,
        "Continue the conversation.",
        { 
          apiKey: settings.venice_api_key, 
          model: settings.venice_model || 'venice-uncensored',
          temperature: 0.8,
          max_tokens: 300 // Keep it concise
        }
      )
    }

    return NextResponse.json({ 
      success: true, 
      response: responseText,
      phase: currentPhase,
      provider
    })

  } catch (error: any) {
    console.error('[API] POST /conversations/[id]/regenerate error:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
