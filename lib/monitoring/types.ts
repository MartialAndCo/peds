// Types pour le système de monitoring

export type LogSource = 'whatsapp' | 'discord' | 'nextjs' | 'cron'

export type LogLevel = 'CRITICAL' | 'ERROR' | 'WARN' | 'INFO'

export type ErrorCategory = 
  | 'connection' 
  | 'api' 
  | 'database' 
  | 'memory' 
  | 'auth' 
  | 'system' 
  | 'general'

export interface LogEntry {
  id: string
  timestamp: Date
  source: LogSource
  service?: string
  level: LogLevel
  category: ErrorCategory
  message: string
  context?: string
  rawLine?: string
  metadata?: Record<string, any>
  isRead: boolean
  readAt?: Date
  readBy?: string
}

export interface LogStats {
  total: number
  bySource: Record<LogSource, number>
  byLevel: Record<LogLevel, number>
  byCategory: Record<ErrorCategory, number>
  criticalCount: number
  unreadCount: number
  lastUpdated: Date
}

export interface ErrorPattern {
  keywords: string[]
  level: LogLevel
  category: ErrorCategory
  service?: string
  messageTemplate?: string
}

export interface RawLogLine {
  line: string
  timestamp?: string
  source: LogSource
}

export interface FetchLogsOptions {
  sources?: LogSource[]
  level?: LogLevel[]
  since?: Date
  limit?: number
  unreadOnly?: boolean
}

export interface MonitorConfig {
  // Intervalle de collecte en ms (défaut: 30000 = 30s)
  collectionInterval: number
  // Durée de vie des logs en jours (défaut: 7)
  logRetentionDays: number
  // Niveau minimum pour créer une notification
  notificationLevel: LogLevel
  // Sources à monitorer
  enabledSources: LogSource[]
}

export const DEFAULT_MONITOR_CONFIG: MonitorConfig = {
  collectionInterval: 30000,
  logRetentionDays: 7,
  notificationLevel: 'ERROR',
  enabledSources: ['whatsapp', 'discord', 'nextjs']
}
