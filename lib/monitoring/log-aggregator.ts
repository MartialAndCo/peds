import axios from 'axios'
import { prisma } from '@/lib/prisma'
import { 
  LogEntry, 
  LogSource, 
  LogLevel, 
  RawLogLine,
  FetchLogsOptions,
  LogStats 
} from './types'
import { parseLogLine, generateLogId } from './error-patterns'

// Configuration des endpoints
// Force le port 3001 (Baileys) car parfois WAHA_ENDPOINT est configuré avec le mauvais port
const RAW_ENDPOINT = process.env.WAHA_ENDPOINT || 'http://13.60.16.81:3001'
// Fix: Remplace explicitement :3000 par :3001, ou force le port si l'URL contient l'IP
let BAILEYS_ENDPOINT = RAW_ENDPOINT.replace(':3000', ':3001')
// Double sécurité: si l'URL contient encore :3000 ou n'a pas de port explicite sur l'IP de prod
if (BAILEYS_ENDPOINT.includes('13.60.16.81:3000')) {
  BAILEYS_ENDPOINT = 'http://13.60.16.81:3001'
} else if (BAILEYS_ENDPOINT === 'http://13.60.16.81' || BAILEYS_ENDPOINT === 'https://13.60.16.81') {
  BAILEYS_ENDPOINT = 'http://13.60.16.81:3001'
}
const BAILEYS_API_KEY = process.env.AUTH_TOKEN || process.env.WAHA_API_KEY

interface LogSourceConfig {
  name: LogSource
  endpoint: string
  fetcher: () => Promise<RawLogLine[]>
}

// Récupère les logs du serveur WhatsApp (Baileys)
async function fetchWhatsAppLogs(): Promise<RawLogLine[]> {
  try {
    console.log('[LogAggregator] Fetching WhatsApp logs from:', BAILEYS_ENDPOINT)
    const response = await axios.get(`${BAILEYS_ENDPOINT}/api/logs?lines=200`, {
      headers: { 'X-Api-Key': BAILEYS_API_KEY },
      timeout: 5000
    })
    
    if (response.data.success && Array.isArray(response.data.lines)) {
      return response.data.lines.map((line: string) => ({
        line,
        source: 'whatsapp' as LogSource,
        timestamp: extractTimestamp(line)
      }))
    }
    return []
  } catch (error: any) {
    console.error('[LogAggregator] WhatsApp logs fetch failed:', error.message)
    // Retourne une entrée d'erreur mais ne fait pas planter le dashboard
    return [{
      line: `[ERROR] WhatsApp server unreachable: ${error.code || error.message}. Endpoint: ${BAILEYS_ENDPOINT}`,
      source: 'whatsapp',
      timestamp: new Date().toISOString()
    }]
  }
}

// Récupère les logs Discord - DÉSACTIVÉ (docker pas accessible depuis le conteneur)
async function fetchDiscordLogs(): Promise<RawLogLine[]> {
  // Retourne vide pour l'instant - les erreurs Discord seront dans les logs WhatsApp si webhook échoue
  return []
}

// Récupère les logs Cron - DÉSACTIVÉ (docker pas accessible depuis le conteneur)
async function fetchCronLogs(): Promise<RawLogLine[]> {
  return []
}

// Récupère les logs Next.js internes depuis la DB
async function fetchNextjsLogs(): Promise<RawLogLine[]> {
  try {
    // Récupère les erreurs console récentes depuis SystemLog
    const recentLogs = await prisma.systemLog.findMany({
      where: {
        source: 'nextjs',
        createdAt: { gte: new Date(Date.now() - 5 * 60 * 1000) } // 5 dernières minutes
      },
      orderBy: { createdAt: 'desc' },
      take: 50
    })
    
    return recentLogs.map(log => ({
      line: log.rawLine || log.message,
      source: 'nextjs' as LogSource,
      timestamp: log.createdAt.toISOString()
    }))
  } catch (error) {
    console.error('[LogAggregator] Next.js logs fetch failed:', error)
    return []
  }
}

// Extrait un timestamp d'une ligne de log
function extractTimestamp(line: string): string {
  // Patterns communs de timestamp
  const patterns = [
    // ISO 8601: 2026-02-05T17:20:30.123Z
    /(\d{4}-\d{2}-\d{2}[T ]\d{2}:\d{2}:\d{2}[\.,]?\d*Z?)/,
    // Standard: 2026-02-05 17:20:30
    /(\d{4}-\d{2}-\d{2}\s+\d{2}:\d{2}:\d{2})/,
    // Docker: 2026-02-05T17:20:30.123456789Z
    /(\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d+Z)/
  ]
  
  for (const pattern of patterns) {
    const match = line.match(pattern)
    if (match) return match[1]
  }
  
  return new Date().toISOString()
}

// Parse et transforme les logs bruts en entrées structurées
export function parseRawLogs(rawLogs: RawLogLine[]): LogEntry[] {
  const entries: LogEntry[] = []
  
  for (const raw of rawLogs) {
    // Si la ligne contient "[ERROR]" au début, c'est une erreur système générée par nous
    if (raw.line.startsWith('[ERROR]') || raw.line.includes('unreachable') || raw.line.includes('ECONNREFUSED')) {
      const timestamp = raw.timestamp ? new Date(raw.timestamp) : new Date()
      entries.push({
        id: generateLogId(raw.source, raw.line, timestamp),
        timestamp,
        source: raw.source,
        service: 'system',
        level: 'CRITICAL',
        category: 'connection',
        message: raw.line.replace('[ERROR]', '').trim(),
        context: raw.line,
        rawLine: raw.line,
        isRead: false
      })
      continue
    }
    
    const parsed = parseLogLine(raw.line, raw.source)
    if (!parsed) continue // Ignorer les lignes sans erreur
    
    const timestamp = raw.timestamp ? new Date(raw.timestamp) : new Date()
    
    entries.push({
      id: generateLogId(raw.source, raw.line, timestamp),
      timestamp,
      source: raw.source,
      service: parsed.service,
      level: parsed.level,
      category: parsed.category,
      message: parsed.message,
      context: raw.line.length > 500 ? raw.line.substring(0, 500) + '...' : raw.line,
      rawLine: raw.line,
      isRead: false
    })
  }
  
  return entries
}

// Récupère et agrège tous les logs
export async function aggregateLogs(options: FetchLogsOptions = {}): Promise<{
  logs: LogEntry[]
  stats: LogStats
}> {
  const sources = options.sources || ['whatsapp', 'discord', 'nextjs']
  const since = options.since || new Date(Date.now() - 24 * 60 * 60 * 1000) // 24h par défaut
  
  // Récupère les logs de toutes les sources en parallèle
  const fetchPromises: Promise<RawLogLine[]>[] = []
  
  if (sources.includes('whatsapp')) fetchPromises.push(fetchWhatsAppLogs())
  if (sources.includes('discord')) fetchPromises.push(fetchDiscordLogs())
  if (sources.includes('cron')) fetchPromises.push(fetchCronLogs())
  if (sources.includes('nextjs')) fetchPromises.push(fetchNextjsLogs())
  
  const results = await Promise.allSettled(fetchPromises)
  
  const allRawLogs: RawLogLine[] = []
  results.forEach(result => {
    if (result.status === 'fulfilled') {
      allRawLogs.push(...result.value)
    }
  })
  
  // Parse les logs
  const parsedLogs = parseRawLogs(allRawLogs)
  
  // Filtrer par date
  let filteredLogs = parsedLogs.filter(log => log.timestamp >= since)
  
  // Filtrer par niveau si spécifié
  if (options.level && options.level.length > 0) {
    filteredLogs = filteredLogs.filter(log => options.level?.includes(log.level))
  }
  
  // Trier par timestamp décroissant
  filteredLogs.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime())
  
  // Limiter le nombre de résultats
  if (options.limit) {
    filteredLogs = filteredLogs.slice(0, options.limit)
  }
  
  // Calculer les stats
  const stats = calculateStats(filteredLogs)
  
  return { logs: filteredLogs, stats }
}

// Calcule les statistiques des logs
function calculateStats(logs: LogEntry[]): LogStats {
  const stats: LogStats = {
    total: logs.length,
    bySource: { whatsapp: 0, discord: 0, nextjs: 0, cron: 0, amplify: 0 },
    byLevel: { CRITICAL: 0, ERROR: 0, WARN: 0, INFO: 0 },
    byCategory: { 
      connection: 0, api: 0, database: 0, memory: 0, 
      auth: 0, system: 0, general: 0 
    },
    criticalCount: 0,
    unreadCount: 0,
    lastUpdated: new Date()
  }
  
  for (const log of logs) {
    stats.bySource[log.source]++
    stats.byLevel[log.level]++
    stats.byCategory[log.category]++
    if (log.level === 'CRITICAL') stats.criticalCount++
    if (!log.isRead) stats.unreadCount++
  }
  
  return stats
}

// Persiste les logs critiques en base de données
export async function persistLogs(logs: LogEntry[]): Promise<void> {
  const criticalLogs = logs.filter(log => 
    log.level === 'CRITICAL' || log.level === 'ERROR'
  )
  
  for (const log of criticalLogs) {
    try {
      // Vérifier si le log existe déjà (éviter les doublons)
      const existing = await prisma.systemLog.findUnique({
        where: { id: log.id }
      })
      
      if (existing) continue
      
      // Calculer la date d'expiration (7 jours)
      const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
      
      await prisma.systemLog.create({
        data: {
          id: log.id,
          source: log.source,
          service: log.service,
          level: log.level,
          category: log.category,
          message: log.message,
          context: log.context,
          rawLine: log.rawLine,
          metadata: log.metadata || {},
          isRead: false,
          notificationCreated: false,
          expiresAt
        }
      })
    } catch (error) {
      console.error('[LogAggregator] Failed to persist log:', error)
    }
  }
}

// Marque les logs comme lus
export async function markLogsAsRead(logIds: string[], userId: string): Promise<void> {
  await prisma.systemLog.updateMany({
    where: { id: { in: logIds } },
    data: { 
      isRead: true, 
      readAt: new Date(),
      readBy: userId
    }
  })
}

// Nettoie les vieux logs (à appeler par un cron)
export async function cleanupOldLogs(): Promise<number> {
  const result = await prisma.systemLog.deleteMany({
    where: {
      expiresAt: { lt: new Date() }
    }
  })
  
  console.log(`[LogAggregator] Cleaned up ${result.count} expired logs`)
  return result.count
}
