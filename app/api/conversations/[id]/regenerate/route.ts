import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { settingsService } from '@/lib/settings-cache'
import { director } from '@/lib/director'
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

    const { messageText } = await req.json()

    // Get conversation with contact and prompt
    const conversation = await prisma.conversation.findUnique({
      where: { id },
      include: { 
        contact: true,
        prompt: true
      }
    })

    if (!conversation) {
      return NextResponse.json({ error: 'Conversation not found' }, { status: 404 })
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

    // Determine phase
    const { phase, details, reason } = await director.determinePhase(
      conversation.contact.phone_whatsapp,
      conversation.agentId || 'default'
    )

    // Build system prompt
    const systemPrompt = await director.buildSystemPrompt(
      settings,
      conversation.contact,
      phase,
      details,
      conversation.prompt?.system_prompt || "You are a helpful assistant.",
      conversation.agentId || 'default',
      reason
    ) || "You are a helpful assistant."

    // Generate AI response
    const provider = settings.ai_provider || 'venice'
    let responseText = ""

    if (provider === 'anthropic') {
      responseText = await anthropic.chatCompletion(
        systemPrompt,
        history,
        messageText || "Continue the conversation naturally.",
        { 
          apiKey: settings.anthropic_api_key, 
          model: settings.anthropic_model || 'claude-3-haiku-20240307' 
        }
      )
    } else {
      responseText = await venice.chatCompletion(
        systemPrompt,
        history,
        messageText || "Continue the conversation naturally.",
        { 
          apiKey: settings.venice_api_key, 
          model: settings.venice_model || 'venice-uncensored' 
        }
      )
    }

    return NextResponse.json({ 
      success: true, 
      response: responseText,
      phase,
      provider
    })

  } catch (error: any) {
    console.error('[API] POST /conversations/[id]/regenerate error:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
