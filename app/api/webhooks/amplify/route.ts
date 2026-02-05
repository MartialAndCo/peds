/**
 * Webhook pour recevoir les notifications Amplify
 * Configurez dans la console Amplify : Hosting > Build settings > Incoming webhooks
 * 
 * Payload Amplify example:
 * {
 *   "appId": "d2in5shy58lp10",
 *   "branchName": "main",
 *   "jobId": "7",
 *   "jobStatus": "SUCCEED" | "FAILED" | "STARTED",
 *   "commitId": "abc123...",
 *   "commitMessage": "fix: ..."
 * }
 */

import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export const dynamic = 'force-dynamic'

export async function POST(req: Request) {
  try {
    // Vérifier le secret si configuré
    const secret = req.headers.get('x-amplify-secret')
    const expectedSecret = process.env.AMPLIFY_WEBHOOK_SECRET
    
    if (expectedSecret && secret !== expectedSecret) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const payload = await req.json()
    
    // Parser le payload Amplify
    const { 
      appId, 
      branchName, 
      jobId, 
      jobStatus, 
      commitId, 
      commitMessage,
      errorMessage,
      errorDetails 
    } = payload

    // Déterminer le niveau de log
    let level: 'CRITICAL' | 'ERROR' | 'WARN' | 'INFO' = 'INFO'
    if (jobStatus === 'FAILED') level = 'CRITICAL'
    else if (jobStatus === 'STARTED') level = 'INFO'
    else if (jobStatus === 'SUCCEED') level = 'INFO'

    // Créer un message descriptif
    let message = `Amplify build ${jobStatus}`
    if (jobStatus === 'FAILED') {
      message = `Build FAILED on ${branchName}: ${errorMessage || commitMessage || 'Unknown error'}`
    } else if (jobStatus === 'SUCCEED') {
      message = `Build succeeded on ${branchName}: ${commitMessage || 'No message'}`
    } else if (jobStatus === 'STARTED') {
      message = `Build started on ${branchName}`
    }

    // Stocker le log dans SystemLog
    const logEntry = await prisma.systemLog.create({
      data: {
        source: 'amplify',
        service: 'amplify-hosting',
        level,
        category: jobStatus === 'FAILED' ? 'system' : 'general',
        message,
        context: JSON.stringify({
          appId,
          branchName,
          jobId,
          jobStatus,
          commitId,
          commitMessage,
          errorMessage,
          errorDetails,
          timestamp: new Date().toISOString()
        }, null, 2),
        rawLine: `[AMPLIFY] ${jobStatus} - ${branchName} - Job ${jobId}: ${commitMessage || 'No message'}`,
        metadata: {
          appId,
          branchName,
          jobId,
          commitId
        },
        expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000) // 30 jours pour les builds
      }
    })

    // Si c'est une erreur critique, créer aussi une notification
    if (level === 'CRITICAL') {
      await prisma.systemLog.create({
        data: {
          source: 'nextjs',
          service: 'notification',
          level: 'CRITICAL',
          category: 'system',
          message: `🚨 Deploy FAILED: ${branchName}`,
          context: `Build ${jobId} failed on branch ${branchName}. Check Amplify console.`,
          rawLine: `[NOTIFICATION] Amplify build failed on ${branchName}`,
          expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
        }
      })
    }

    console.log('[Amplify Webhook] Logged:', {
      jobId,
      status: jobStatus,
      logId: logEntry.id
    })

    return NextResponse.json({ 
      success: true, 
      received: true,
      logId: logEntry.id
    })

  } catch (error: any) {
    console.error('[Amplify Webhook] Error:', error)
    
    // Log l'erreur quand même
    try {
      await prisma.systemLog.create({
        data: {
          source: 'amplify',
          service: 'webhook',
          level: 'ERROR',
          category: 'system',
          message: 'Webhook processing error: ' + error.message,
          context: error.stack || '',
          rawLine: `[AMPLIFY WEBHOOK ERROR] ${error.message}`,
          expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
        }
      })
    } catch (e) {
      // Ignorer si même le log échoue
    }

    return NextResponse.json(
      { error: error.message },
      { status: 500 }
    )
  }
}

// GET pour vérifier que le webhook est accessible
export async function GET(req: Request) {
  return NextResponse.json({
    status: 'Amplify webhook endpoint ready',
    endpoints: {
      webhook: '/api/webhooks/amplify',
      method: 'POST',
      description: 'Receive Amplify build notifications'
    }
  })
}
