import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'

export const dynamic = 'force-dynamic'

export async function GET(req: Request) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(req.url)
    const agentId = searchParams.get('agentId')
    const filter = searchParams.get('filter') || 'all'
    const sort = searchParams.get('sort') || 'lastActivity'
    const limit = parseInt(searchParams.get('limit') || '100')
    const search = searchParams.get('search') || ''

    console.log(`[API GET /conversations/enriched] AgentId: ${agentId}, Filter: ${filter}, Sort: ${sort}`)

    // Build the where clause components
    const conditions: any[] = []

    // Base filter: exclude system/hidden contacts from dashboard
    conditions.push({
        contact: {
            source: { notIn: ['system', 'hidden'] }
        }
    })

    // Agent filter
    if (agentId) {
      conditions.push({
        OR: [{ agentId: agentId }, { agentId: null }]
      })
    }

    // Search filter
    if (search) {
      conditions.push({
        contact: {
          OR: [
            { name: { contains: search, mode: 'insensitive' } },
            { phone_whatsapp: { contains: search, mode: 'insensitive' } }
          ]
        }
      })
    }

    // Apply specific filters
    switch (filter) {
      case 'unread':
        conditions.push({ unreadCount: { gt: 0 } })
        break
      case 'needs_reply':
        conditions.push({ unreadCount: { gt: 0 } })
        conditions.push({ lastMessageSender: 'contact' })
        break
      case 'moneypot':
        conditions.push({
          contact: { agentPhase: 'MONEYPOT' }
        })
        break
      case 'crisis':
        conditions.push({
          contact: { agentPhase: 'CRISIS' }
        })
        break
      case 'new':
        conditions.push({
          contact: { status: 'new' }
        })
        break
      case 'paused':
        conditions.push({ status: 'paused' })
        break
      case 'priority':
        // High priority = CRISIS phase OR trustScore > 70 OR unread > 0
        conditions.push({
          OR: [
            { contact: { agentPhase: 'CRISIS' } },
            { contact: { trustScore: { gte: 70 } } },
            { unreadCount: { gt: 0 } }
          ]
        })
        break
      case 'dormant':
        // No activity in last 24 hours
        const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000)
        conditions.push({ lastMessageAt: { lt: oneDayAgo } })
        conditions.push({ status: 'active' })
        break
      case 'all':
      default:
        // No additional filter
        break
    }

    // Build final where clause with AND
    const where: any = conditions.length > 1 
      ? { AND: conditions }
      : conditions[0] || {}

    // Fetch conversations
    let conversations = await prisma.conversation.findMany({
      where,
      include: {
        contact: {
          include: {
            lead: true
          }
        },
        prompt: {
          select: {
            id: true,
            name: true,
            model: true,
            temperature: true,
          }
        },
        messages: {
          orderBy: { timestamp: 'desc' },
          take: 1,
          select: {
            id: true,
            message_text: true,
            sender: true,
            timestamp: true,
          }
        },
        _count: {
          select: {
            messages: true
          }
        }
      },
      take: limit
    })

    // Get AgentContact data for signals if agentId provided
    let agentContactMap = new Map()
    if (agentId) {
      const agentContacts = await prisma.agentContact.findMany({
        where: { agentId },
        select: {
          contactId: true,
          signals: true,
          phase: true,
          trustScore: true,
        }
      })
      agentContactMap = new Map(agentContacts.map(ac => [ac.contactId, ac]))
    }

    // Transform conversations to match frontend format
    const transformedConversations = conversations.map((conv: any) => {
      const lastMsg = conv.messages?.[0]
      return {
        id: conv.id,
        contact: {
          id: conv.contact.id,
          name: conv.contact.name,
          phone_whatsapp: conv.contact.phone_whatsapp,
          status: conv.contact.status,
          agentPhase: conv.contact.agentPhase,
          trustScore: conv.contact.trustScore,
          source: conv.contact.source,
          lead: conv.contact.lead,
        },
        lastMessage: lastMsg ? {
          message_text: lastMsg.message_text,
          sender: lastMsg.sender,
          timestamp: lastMsg.timestamp,
        } : undefined,
        unreadCount: conv.unreadCount || 0,
        aiEnabled: conv.ai_enabled ?? true,
        status: conv.status,
        lastMessageAt: conv.lastMessageAt || conv.createdAt,
        priority: conv.priority || 'normal',
        createdAt: conv.createdAt,
        agentContext: agentContactMap.get(conv.contactId) || null,
        prompt: conv.prompt,
        messageCount: conv._count?.messages || 0,
      }
    })

    // Sort conversations
    const sortedConversations = transformedConversations.sort((a: any, b: any) => {
      switch (sort) {
        case 'unread':
          if (a.unreadCount !== b.unreadCount) {
            return b.unreadCount - a.unreadCount
          }
          break
        case 'trust':
          const trustA = (a as any).agentContext?.trustScore || a.contact.trustScore || 0
          const trustB = (b as any).agentContext?.trustScore || b.contact.trustScore || 0
          if (trustA !== trustB) {
            return trustB - trustA
          }
          break
        case 'phase':
          const phaseOrder = { 'MONEYPOT': 0, 'CRISIS': 1, 'VULNERABILITY': 2, 'CONNECTION': 3, null: 4 }
          const phaseA = phaseOrder[a.contact.agentPhase as keyof typeof phaseOrder] ?? 4
          const phaseB = phaseOrder[b.contact.agentPhase as keyof typeof phaseOrder] ?? 4
          if (phaseA !== phaseB) {
            return phaseA - phaseB
          }
          break
        case 'created':
          return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
        case 'lastActivity':
        default:
          break
      }
      
      // Default: sort by lastMessageAt (or createdAt if no messages)
      const dateA = a.lastMessageAt || a.createdAt
      const dateB = b.lastMessageAt || b.createdAt
      return new Date(dateB).getTime() - new Date(dateA).getTime()
    })

    // Calculate counts for each filter
    const counts = {
      all: await prisma.conversation.count({ where }),
      unread: await prisma.conversation.count({ where: { AND: [...conditions, { unreadCount: { gt: 0 } }] } }),
      needs_reply: await prisma.conversation.count({ where: { AND: [...conditions, { unreadCount: { gt: 0 } }, { lastMessageSender: 'contact' }] } }),
      moneypot: await prisma.conversation.count({ where: { AND: [...conditions, { contact: { agentPhase: 'MONEYPOT' } }] } }),
      crisis: await prisma.conversation.count({ where: { AND: [...conditions, { contact: { agentPhase: 'CRISIS' } }] } }),
      new: await prisma.conversation.count({ where: { AND: [...conditions, { contact: { status: 'new' } }] } }),
      paused: await prisma.conversation.count({ where: { AND: [...conditions, { status: 'paused' }] } }),
      priority: await prisma.conversation.count({ 
        where: { 
          AND: [
            ...conditions,
            { 
              OR: [
                { contact: { agentPhase: 'CRISIS' } },
                { contact: { trustScore: { gte: 70 } } },
                { unreadCount: { gt: 0 } }
              ]
            }
          ]
        } 
      }),
      dormant: await prisma.conversation.count({ 
        where: { 
          AND: [
            ...conditions,
            { lastMessageAt: { lt: new Date(Date.now() - 24 * 60 * 60 * 1000) } },
            { status: 'active' }
          ]
        } 
      }),
    }

    return NextResponse.json({
      conversations: sortedConversations,
      counts,
      filter,
      sort
    })

  } catch (error: any) {
    console.error("[API] GET /conversations/enriched error:", error)
    console.error("[API] Error details:", {
      message: error?.message,
      stack: error?.stack,
      name: error?.name,
      code: error?.code,
    })
    return NextResponse.json({ 
      error: 'Internal Server Error', 
      details: error?.message || 'Unknown error',
      code: error?.code || 'UNKNOWN'
    }, { status: 500 })
  }
}
