import { ErrorPattern, LogLevel, ErrorCategory } from './types'

// Patterns de détection d'erreurs dans les logs
export const ERROR_PATTERNS: ErrorPattern[] = [
  // ========== CRITICAL ==========
  {
    keywords: ['FATAL', 'fatal error', 'unhandledexception', 'unhandledrejection', 'process.exit'],
    level: 'CRITICAL',
    category: 'system',
    messageTemplate: 'Process crash detected'
  },
  {
    keywords: ['heap out of memory', 'ENOMEM', 'allocation failed', 'javascript heap out of memory'],
    level: 'CRITICAL',
    category: 'memory',
    messageTemplate: 'Memory exhaustion detected'
  },
  {
    keywords: ['ECONNREFUSED', 'connection refused', 'disconnected', 'connection lost', 'stream errored'],
    level: 'CRITICAL',
    category: 'connection',
    service: 'whatsapp',
    messageTemplate: 'Connection lost to WhatsApp'
  },
  {
    keywords: ['bad mac', 'decrypt error', 'ciphertext', 'waiting for this message'],
    level: 'CRITICAL',
    category: 'system',
    service: 'whatsapp',
    messageTemplate: 'Encryption/decryption error'
  },
  {
    keywords: ['prisma', 'database connection', 'connection pool', 'timeout acquiring'],
    level: 'CRITICAL',
    category: 'database',
    messageTemplate: 'Database connection issue'
  },
  
  // ========== ERROR ==========
  {
    keywords: ['500', '502', '503', '504', 'internal server error'],
    level: 'ERROR',
    category: 'api',
    messageTemplate: 'Server error (5xx)'
  },
  {
    keywords: ['401', '403', 'unauthorized', 'forbidden', 'invalid token', 'auth failed'],
    level: 'ERROR',
    category: 'auth',
    messageTemplate: 'Authentication/authorization error'
  },
  {
    keywords: ['429', 'rate limit', 'too many requests', 'throttled'],
    level: 'ERROR',
    category: 'api',
    messageTemplate: 'Rate limiting detected'
  },
  {
    keywords: ['timeout', 'ETIMEDOUT', 'ECONNABORTED', 'request timeout'],
    level: 'ERROR',
    category: 'api',
    messageTemplate: 'Request timeout'
  },
  {
    keywords: ['socket hang up', 'econnreset', 'connection reset', 'broken pipe'],
    level: 'ERROR',
    category: 'connection',
    messageTemplate: 'Network connection error'
  },
  {
    keywords: ['query failed', 'database error', 'sql error', 'constraint violation'],
    level: 'ERROR',
    category: 'database',
    messageTemplate: 'Database query error'
  },
  {
    keywords: ['webhook failed', 'webhook error', 'axios error', 'fetch failed'],
    level: 'ERROR',
    category: 'api',
    messageTemplate: 'External API/webhook error'
  },
  {
    keywords: ['discord', 'discordjs', 'bot login'],
    level: 'ERROR',
    category: 'system',
    service: 'discord',
    messageTemplate: 'Discord bot error'
  },
  
  // ========== WARN ==========
  {
    keywords: ['404', 'not found', 'ENOENT', 'file not found'],
    level: 'WARN',
    category: 'system',
    messageTemplate: 'Resource not found'
  },
  {
    keywords: ['slow query', 'long execution', 'performance', 'slow'],
    level: 'WARN',
    category: 'database',
    messageTemplate: 'Performance warning'
  },
  {
    keywords: ['retry', 'retries', 'attempt', 'will retry'],
    level: 'WARN',
    category: 'system',
    messageTemplate: 'Retry attempt detected'
  },
  {
    keywords: ['deprecated', 'deprecation', 'legacy'],
    level: 'WARN',
    category: 'system',
    messageTemplate: 'Deprecation warning'
  },
  {
    keywords: ['high memory', 'memory usage', 'rss'],
    level: 'WARN',
    category: 'memory',
    messageTemplate: 'High memory usage'
  },
  {
    keywords: ['qr timeout', 'scan qr', 'authentication', 'logged out'],
    level: 'WARN',
    category: 'auth',
    service: 'whatsapp',
    messageTemplate: 'WhatsApp authentication warning'
  }
]

// Mots-clés à ignorer (bruit)
export const IGNORED_KEYWORDS = [
  'health',
  'GET /status',
  'GET /api/status',
  'GET /api/metrics',
  'GET /api/logs',
  'heartbeat',
  'ping',
  '200 OK',
  'success',
  'info: connected',
  'debug'
]

// Parse une ligne de log et détecte si c'est une erreur
export function parseLogLine(line: string, source: string): {
  level: LogLevel
  category: ErrorCategory
  service?: string
  message: string
} | null {
  // Ignorer les lignes de bruit
  const lowerLine = line.toLowerCase()
  if (IGNORED_KEYWORDS.some(k => lowerLine.includes(k.toLowerCase()))) {
    return null
  }

  // Chercher les patterns
  for (const pattern of ERROR_PATTERNS) {
    const matches = pattern.keywords.some(kw => 
      lowerLine.includes(kw.toLowerCase())
    )
    
    if (matches) {
      return {
        level: pattern.level,
        category: pattern.category,
        service: pattern.service || detectService(line, source),
        message: pattern.messageTemplate || extractMessage(line)
      }
    }
  }

  // Si pas de pattern mais contient "error" ou "fail"
  if (lowerLine.includes('error') || lowerLine.includes('fail')) {
    return {
      level: 'ERROR',
      category: 'general',
      service: detectService(line, source),
      message: extractMessage(line)
    }
  }

  return null
}

// Détecte le service à partir de la ligne
function detectService(line: string, source: string): string {
  const lower = line.toLowerCase()
  
  if (source === 'discord' || lower.includes('discord')) return 'discord'
  if (lower.includes('baileys') || lower.includes('whatsapp')) return 'whatsapp'
  if (lower.includes('prisma') || lower.includes('database')) return 'database'
  if (lower.includes('openai') || lower.includes('venice') || lower.includes('anthropic')) return 'ai'
  if (lower.includes('elevenlabs') || lower.includes('tts')) return 'voice'
  if (lower.includes('supabase')) return 'storage'
  
  return source
}

// Extrait un message lisible de la ligne de log
function extractMessage(line: string): string {
  // Supprimer les timestamps et niveaux de log communs
  let cleaned = line
    .replace(/^\d{4}-\d{2}-\d{2}[T ]\d{2}:\d{2}:\d{2}[\.,]?\d*Z?\s*/i, '')
    .replace(/^\[?(ERROR|WARN|INFO|DEBUG|TRACE)\]?\s*/i, '')
    .replace(/^\[?[^\]]+\]?\s*/, '')
    .trim()
  
  // Limiter la longueur
  if (cleaned.length > 200) {
    cleaned = cleaned.substring(0, 200) + '...'
  }
  
  return cleaned || 'Unknown error'
}

// Génère un ID unique pour un log
export function generateLogId(source: string, line: string, timestamp: Date): string {
  const hash = line.split('').reduce((a, b) => {
    a = ((a << 5) - a) + b.charCodeAt(0)
    return a & a
  }, 0)
  return `${source}-${timestamp.getTime()}-${Math.abs(hash)}`
}
