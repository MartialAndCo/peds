#!/usr/bin/env tsx
/**
 * Test script to debug the /api/conversations/enriched 500 error
 * Tests each part of the where clause to identify the issue
 */

import { prisma } from '../lib/prisma'

async function testConversationsAPI() {
  console.log('=== Testing Conversations API Queries ===\n')

  const testResults: { test: string; success: boolean; error?: string; duration?: number }[] = []

  // Test 1: Basic conversation query
  console.log('Test 1: Basic conversation query (no filters)')
  try {
    const start = Date.now()
    const conversations = await prisma.conversation.findMany({
      take: 5,
      include: { contact: { select: { id: true, name: true } } }
    })
    const duration = Date.now() - start
    console.log(`  ✓ Success - Found ${conversations.length} conversations (${duration}ms)\n`)
    testResults.push({ test: 'Basic query', success: true, duration })
  } catch (error: any) {
    console.error(`  ✗ Failed: ${error.message}\n`)
    testResults.push({ test: 'Basic query', success: false, error: error.message })
  }

  // Test 2: Simple AND structure with contact.isHidden
  console.log('Test 2: Simple AND with contact.isHidden filter')
  try {
    const start = Date.now()
    const conversations = await prisma.conversation.findMany({
      where: {
        AND: [
          {
            contact: {
              OR: [
                { isHidden: false },
                { isHidden: null }
              ]
            }
          }
        ]
      },
      take: 5
    })
    const duration = Date.now() - start
    console.log(`  ✓ Success - Found ${conversations.length} conversations (${duration}ms)\n`)
    testResults.push({ test: 'AND with contact.isHidden', success: true, duration })
  } catch (error: any) {
    console.error(`  ✗ Failed: ${error.message}\n`)
    testResults.push({ test: 'AND with contact.isHidden', success: false, error: error.message })
  }

  // Test 3: Metadata path query (MAIN SUSPECT)
  console.log('Test 3: Metadata path query (path: [state], equals: WAITING_FOR_LEAD)')
  try {
    const start = Date.now()
    const conversations = await prisma.conversation.findMany({
      where: {
        metadata: {
          path: ['state'],
          equals: 'WAITING_FOR_LEAD'
        }
      },
      take: 5
    })
    const duration = Date.now() - start
    console.log(`  ✓ Success - Found ${conversations.length} conversations (${duration}ms)\n`)
    testResults.push({ test: 'Metadata path query', success: true, duration })
  } catch (error: any) {
    console.error(`  ✗ Failed: ${error.message}`)
    console.error(`  Error code: ${error.code || 'N/A'}`)
    console.error(`  Meta: ${JSON.stringify(error.meta || {})}\n`)
    testResults.push({ test: 'Metadata path query', success: false, error: error.message })
  }

  // Test 4: NOT with metadata path query
  console.log('Test 4: NOT with nested AND containing metadata path query')
  try {
    const start = Date.now()
    const conversations = await prisma.conversation.findMany({
      where: {
        NOT: {
          AND: [
            { status: 'paused' },
            {
              metadata: {
                path: ['state'],
                equals: 'WAITING_FOR_LEAD'
              }
            }
          ]
        }
      },
      take: 5
    })
    const duration = Date.now() - start
    console.log(`  ✓ Success - Found ${conversations.length} conversations (${duration}ms)\n`)
    testResults.push({ test: 'NOT + metadata path', success: true, duration })
  } catch (error: any) {
    console.error(`  ✗ Failed: ${error.message}`)
    console.error(`  Error code: ${error.code || 'N/A'}`)
    console.error(`  Meta: ${JSON.stringify(error.meta || {})}\n`)
    testResults.push({ test: 'NOT + metadata path', success: false, error: error.message })
  }

  // Test 5: Full base where clause (like in API)
  console.log('Test 5: Full base where clause (excluding pending leads)')
  try {
    const start = Date.now()
    const where: any = {
      AND: [
        {
          contact: {
            OR: [
              { isHidden: false },
              { isHidden: null }
            ]
          }
        },
        {
          NOT: {
            AND: [
              { status: 'paused' },
              {
                metadata: {
                  path: ['state'],
                  equals: 'WAITING_FOR_LEAD'
                }
              }
            ]
          }
        }
      ]
    }
    const conversations = await prisma.conversation.findMany({ where, take: 5 })
    const duration = Date.now() - start
    console.log(`  ✓ Success - Found ${conversations.length} conversations (${duration}ms)\n`)
    testResults.push({ test: 'Full base where clause', success: true, duration })
  } catch (error: any) {
    console.error(`  ✗ Failed: ${error.message}`)
    console.error(`  Error code: ${error.code || 'N/A'}`)
    console.error(`  Meta: ${JSON.stringify(error.meta || {})}\n`)
    testResults.push({ test: 'Full base where clause', success: false, error: error.message })
  }

  // Test 6: With agentId filter
  console.log('Test 6: With agentId OR filter')
  try {
    const start = Date.now()
    // Get a real agentId first
    const agent = await prisma.agent.findFirst()
    const agentId = agent?.id || 'test-agent-id'
    
    const where: any = {
      AND: [
        {
          contact: {
            OR: [
              { isHidden: false },
              { isHidden: null }
            ]
          }
        }
      ]
    }
    
    where.AND.push({
      OR: [
        { agentId: agentId },
        { agentId: null }
      ]
    })
    
    const conversations = await prisma.conversation.findMany({ where, take: 5 })
    const duration = Date.now() - start
    console.log(`  ✓ Success - Found ${conversations.length} conversations (${duration}ms)\n`)
    testResults.push({ test: 'With agentId filter', success: true, duration })
  } catch (error: any) {
    console.error(`  ✗ Failed: ${error.message}\n`)
    testResults.push({ test: 'With agentId filter', success: false, error: error.message })
  }

  // Test 7: Full query with includes (like in API)
  console.log('Test 7: Full query with all includes')
  try {
    const start = Date.now()
    const where: any = {
      AND: [
        {
          contact: {
            OR: [
              { isHidden: false },
              { isHidden: null }
            ]
          }
        },
        {
          NOT: {
            AND: [
              { status: 'paused' },
              {
                metadata: {
                  path: ['state'],
                  equals: 'WAITING_FOR_LEAD'
                }
              }
            ]
          }
        }
      ]
    }
    
    const conversations = await prisma.conversation.findMany({
      where,
      include: {
        contact: {
          select: {
            id: true,
            name: true,
            phone_whatsapp: true,
            status: true,
            agentPhase: true,
            trustScore: true,
            source: true,
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
      take: 5
    })
    const duration = Date.now() - start
    console.log(`  ✓ Success - Found ${conversations.length} conversations (${duration}ms)\n`)
    testResults.push({ test: 'Full query with includes', success: true, duration })
  } catch (error: any) {
    console.error(`  ✗ Failed: ${error.message}`)
    console.error(`  Error code: ${error.code || 'N/A'}`)
    console.error(`  Meta: ${JSON.stringify(error.meta || {})}\n`)
    testResults.push({ test: 'Full query with includes', success: false, error: error.message })
  }

  // Test 8: Count queries with buildCountWhere
  console.log('Test 8: Count queries (like buildCountWhere in API)')
  try {
    const start = Date.now()
    const baseWhere: any = {
      AND: [
        {
          contact: {
            OR: [
              { isHidden: false },
              { isHidden: null }
            ]
          }
        },
        {
          NOT: {
            AND: [
              { status: 'paused' },
              {
                metadata: {
                  path: ['state'],
                  equals: 'WAITING_FOR_LEAD'
                }
              }
            ]
          }
        }
      ]
    }
    
    const buildCountWhere = (extraConditions: any = {}) => ({
      AND: [
        ...baseWhere.AND,
        ...(Object.keys(extraConditions).length > 0 ? [extraConditions] : [])
      ]
    })
    
    const counts = {
      all: await prisma.conversation.count({ where: baseWhere }),
      unread: await prisma.conversation.count({ where: buildCountWhere({ unreadCount: { gt: 0 } }) }),
      moneypot: await prisma.conversation.count({ where: buildCountWhere({ contact: { agentPhase: 'MONEYPOT' } }) }),
    }
    const duration = Date.now() - start
    console.log(`  ✓ Success - Counts: all=${counts.all}, unread=${counts.unread}, moneypot=${counts.moneypot} (${duration}ms)\n`)
    testResults.push({ test: 'Count queries', success: true, duration })
  } catch (error: any) {
    console.error(`  ✗ Failed: ${error.message}`)
    console.error(`  Error code: ${error.code || 'N/A'}`)
    console.error(`  Meta: ${JSON.stringify(error.meta || {})}\n`)
    testResults.push({ test: 'Count queries', success: false, error: error.message })
  }

  // Test 9: Test each filter individually
  console.log('Test 9: Testing individual filter conditions')
  const filterTests = [
    { name: 'unread', condition: { unreadCount: { gt: 0 } } },
    { name: 'needs_reply', condition: { unreadCount: { gt: 0 }, lastMessageSender: 'contact' } },
    { name: 'moneypot', condition: { contact: { agentPhase: 'MONEYPOT' } } },
    { name: 'crisis', condition: { contact: { agentPhase: 'CRISIS' } } },
    { name: 'new', condition: { contact: { status: 'new' } } },
    { name: 'paused', condition: { status: 'paused' } },
    { name: 'priority', condition: { OR: [{ contact: { agentPhase: 'CRISIS' } }, { contact: { trustScore: { gte: 70 } } }, { unreadCount: { gt: 0 } }] } },
    { name: 'dormant', condition: { lastMessageAt: { lt: new Date(Date.now() - 24 * 60 * 60 * 1000) }, status: 'active' } },
  ]

  for (const filter of filterTests) {
    try {
      const start = Date.now()
      const baseWhere: any = {
        AND: [
          {
            contact: {
              OR: [
                { isHidden: false },
                { isHidden: null }
              ]
            }
          },
          {
            NOT: {
              AND: [
                { status: 'paused' },
                {
                  metadata: {
                    path: ['state'],
                    equals: 'WAITING_FOR_LEAD'
                  }
                }
              ]
            }
          }
        ]
      }
      const where = {
        AND: [...baseWhere.AND, filter.condition]
      }
      const count = await prisma.conversation.count({ where })
      const duration = Date.now() - start
      console.log(`  ✓ ${filter.name}: ${count} results (${duration}ms)`)
    } catch (error: any) {
      console.error(`  ✗ ${filter.name}: ${error.message}`)
      testResults.push({ test: `Filter: ${filter.name}`, success: false, error: error.message })
    }
  }
  console.log('')

  // Test 10: Check if there are any conversations with metadata.state
  console.log('Test 10: Check conversations with metadata.state = WAITING_FOR_LEAD')
  try {
    const start = Date.now()
    const waitingConversations = await prisma.conversation.findMany({
      where: {
        metadata: {
          path: ['state'],
          equals: 'WAITING_FOR_LEAD'
        }
      },
      select: { id: true, status: true, metadata: true }
    })
    const duration = Date.now() - start
    console.log(`  Found ${waitingConversations.length} conversations with state=WAITING_FOR_LEAD`)
    if (waitingConversations.length > 0) {
      console.log(`  Sample: ${JSON.stringify(waitingConversations[0])}`)
    }
    console.log(`  (${duration}ms)\n`)
    testResults.push({ test: 'Check WAITING_FOR_LEAD conversations', success: true, duration })
  } catch (error: any) {
    console.error(`  ✗ Failed: ${error.message}\n`)
    testResults.push({ test: 'Check WAITING_FOR_LEAD conversations', success: false, error: error.message })
  }

  // Test 11: Alternative metadata query syntax (using path string instead of array)
  console.log('Test 11: Alternative metadata query (string path)')
  try {
    const start = Date.now()
    const conversations = await prisma.conversation.findMany({
      where: {
        metadata: {
          path: 'state',
          equals: 'WAITING_FOR_LEAD'
        }
      },
      take: 5
    })
    const duration = Date.now() - start
    console.log(`  ✓ Success with string path - Found ${conversations.length} conversations (${duration}ms)\n`)
    testResults.push({ test: 'Metadata string path', success: true, duration })
  } catch (error: any) {
    console.error(`  ✗ Failed (expected for some DB types): ${error.message}\n`)
    // Don't mark as failure - this is just testing alternative syntax
  }

  // Summary
  console.log('=== TEST SUMMARY ===')
  console.log(`Total tests: ${testResults.length}`)
  console.log(`Passed: ${testResults.filter(r => r.success).length}`)
  console.log(`Failed: ${testResults.filter(r => !r.success).length}`)
  
  const failures = testResults.filter(r => !r.success)
  if (failures.length > 0) {
    console.log('\nFailed tests:')
    failures.forEach(f => {
      console.log(`  - ${f.test}: ${f.error}`)
    })
  }

  await prisma.$disconnect()
  process.exit(failures.length > 0 ? 1 : 0)
}

testConversationsAPI().catch(async (error) => {
  console.error('Unexpected error:', error)
  await prisma.$disconnect()
  process.exit(1)
})
