import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { aggregateLogs } from '@/lib/monitoring/log-aggregator'

export const dynamic = 'force-dynamic'

// Server-Sent Events endpoint pour le temps réel
export async function GET(req: Request) {
  const session = await getServerSession(authOptions)
  if (!session) {
    return new Response('Unauthorized', { status: 401 })
  }

  const { searchParams } = new URL(req.url)
  const sources = searchParams.get('sources')?.split(',') || ['whatsapp', 'discord']
  
  // Créer le stream SSE
  const stream = new ReadableStream({
    async start(controller) {
      // En-têtes SSE
      const encoder = new TextEncoder()
      
      const sendEvent = (data: any) => {
        const message = `data: ${JSON.stringify(data)}\n\n`
        controller.enqueue(encoder.encode(message))
      }
      
      // Envoyer un message initial
      sendEvent({ type: 'connected', timestamp: new Date().toISOString() })
      
      // Intervalle de polling (toutes les 5 secondes)
      const interval = setInterval(async () => {
        try {
          const since = new Date(Date.now() - 30 * 1000) // 30 dernières secondes
          const { logs, stats } = await aggregateLogs({
            sources: sources as any,
            since,
            limit: 50
          })
          
          // Ne renvoyer que s'il y a des nouveaux logs
          if (logs.length > 0) {
            sendEvent({
              type: 'logs',
              logs,
              stats,
              timestamp: new Date().toISOString()
            })
          }
        } catch (error) {
          console.error('[Monitor Stream] Error:', error)
          sendEvent({
            type: 'error',
            message: 'Failed to fetch logs',
            timestamp: new Date().toISOString()
          })
        }
      }, 5000)
      
      // Nettoyage quand le client se déconnecte
      req.signal.addEventListener('abort', () => {
        clearInterval(interval)
        controller.close()
      })
    }
  })
  
  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive'
    }
  })
}
