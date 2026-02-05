'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { useRouter } from 'next/navigation'
import axios from 'axios'
import { 
  Card, 
  CardContent, 
  CardHeader, 
  CardTitle 
} from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { 
  RefreshCw, 
  Terminal, 
  Trash2, 
  GitBranch, 
  Power, 
  CheckCircle, 
  XCircle, 
  Loader2, 
  Wrench,
  AlertTriangle,
  AlertCircle,
  Info,
  Bell,
  Eye,
  EyeOff,
  Server,
  MessageSquare,
  Activity,
  Clock,
  Filter,
  Download,
  CheckCheck
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { useToast } from '@/components/ui/use-toast'

// Types
interface LogEntry {
  id: string
  timestamp: string
  source: 'whatsapp' | 'discord' | 'nextjs' | 'cron'
  service?: string
  level: 'CRITICAL' | 'ERROR' | 'WARN' | 'INFO'
  category: string
  message: string
  context?: string
  rawLine?: string
  isRead: boolean
}

interface LogStats {
  total: number
  bySource: Record<string, number>
  byLevel: Record<string, number>
  criticalCount: number
  unreadCount: number
}

interface SystemStatus {
  connected: boolean
  user: string | null
  uptime: string
  uptimeSeconds: number
  memory: {
    heapUsed: string
    heapTotal: string
    rss: string
  }
  chatsLoaded: number
  lidMappings: number
  nodeVersion: string
  timestamp: string
}

const LEVEL_CONFIG = {
  CRITICAL: { 
    color: 'bg-red-500', 
    text: 'text-red-500',
    bg: 'bg-red-500/10',
    border: 'border-red-500/20',
    icon: AlertTriangle,
    label: 'CRITICAL'
  },
  ERROR: { 
    color: 'bg-orange-500', 
    text: 'text-orange-500',
    bg: 'bg-orange-500/10',
    border: 'border-orange-500/20',
    icon: AlertCircle,
    label: 'ERROR'
  },
  WARN: { 
    color: 'bg-yellow-500', 
    text: 'text-yellow-500',
    bg: 'bg-yellow-500/10',
    border: 'border-yellow-500/20',
    icon: Info,
    label: 'WARN'
  },
  INFO: { 
    color: 'bg-blue-500', 
    text: 'text-blue-500',
    bg: 'bg-blue-500/10',
    border: 'border-blue-500/20',
    icon: Info,
    label: 'INFO'
  }
}

const SOURCE_CONFIG = {
  whatsapp: { icon: MessageSquare, label: 'WhatsApp', color: 'text-green-500' },
  discord: { icon: MessageSquare, label: 'Discord', color: 'text-indigo-500' },
  nextjs: { icon: Server, label: 'Next.js', color: 'text-blue-500' },
  cron: { icon: Clock, label: 'Cron', color: 'text-purple-500' }
}

export default function SystemMonitorPage() {
  const router = useRouter()
  const { toast } = useToast()
  
  // États
  const [logs, setLogs] = useState<LogEntry[]>([])
  const [stats, setStats] = useState<LogStats | null>(null)
  const [systemStatus, setSystemStatus] = useState<SystemStatus | null>(null)
  const [loading, setLoading] = useState(true)
  const [actionLoading, setActionLoading] = useState<string | null>(null)
  const [actionResult, setActionResult] = useState<{ success: boolean; message: string } | null>(null)
  
  // Filtres
  const [selectedSources, setSelectedSources] = useState<string[]>(['whatsapp', 'discord', 'nextjs'])
  const [selectedLevels, setSelectedLevels] = useState<string[]>(['CRITICAL', 'ERROR', 'WARN'])
  const [autoRefresh, setAutoRefresh] = useState(true)
  const [showOnlyUnread, setShowOnlyUnread] = useState(false)
  const [expandedLog, setExpandedLog] = useState<string | null>(null)
  
  // SSE
  const eventSourceRef = useRef<EventSource | null>(null)
  const unreadCount = logs.filter(l => !l.isRead).length

  // Fetch des logs
  const fetchLogs = useCallback(async () => {
    try {
      const levelParam = selectedLevels.join(',')
      const sourcesParam = selectedSources.join(',')
      
      const res = await axios.get(
        `/api/admin/monitor/logs?level=${levelParam}&sources=${sourcesParam}&since=120&limit=200`
      )
      
      if (res.data.success) {
        setLogs(res.data.logs)
        setStats(res.data.stats)
      }
    } catch (e: any) {
      console.error('Failed to fetch logs:', e)
      toast({
        title: 'Error',
        description: 'Failed to fetch logs',
        variant: 'destructive'
      })
    }
  }, [selectedLevels, selectedSources, toast])

  // Fetch du statut système WhatsApp
  const fetchSystemStatus = useCallback(async () => {
    try {
      const res = await axios.get('/api/admin/status')
      if (res.data.success && res.data.status) {
        const dockerStatus = res.data.status
        setSystemStatus({
          connected: dockerStatus.status === 'CONNECTED',
          user: dockerStatus.user || null,
          uptime: dockerStatus.uptime || '--',
          uptimeSeconds: dockerStatus.uptimeSeconds || 0,
          memory: dockerStatus.memory || { heapUsed: '--', heapTotal: '--', rss: '--' },
          chatsLoaded: dockerStatus.chatsLoaded || 0,
          lidMappings: dockerStatus.lidMappings || 0,
          nodeVersion: dockerStatus.nodeVersion || '--',
          timestamp: dockerStatus.timestamp || new Date().toISOString()
        })
      }
    } catch (e) {
      // Silent fail
    }
  }, [])

  // Mark logs as read
  const markAsRead = async (logIds?: string[]) => {
    try {
      if (logIds && logIds.length > 0) {
        await axios.post('/api/admin/monitor/logs', { logIds })
        setLogs(prev => prev.map(l => 
          logIds.includes(l.id) ? { ...l, isRead: true } : l
        ))
      } else {
        await axios.post('/api/admin/monitor/logs', { markAllRead: true })
        setLogs(prev => prev.map(l => ({ ...l, isRead: true })))
      }
    } catch (e) {
      toast({
        title: 'Error',
        description: 'Failed to mark logs as read',
        variant: 'destructive'
      })
    }
  }

  // Execute action
  const executeAction = async (action: string) => {
    if (actionLoading) return
    
    if (['restart', 'clear_sessions'].includes(action)) {
      const confirmed = window.confirm(`Are you sure you want to ${action.replace('_', ' ')}? This will interrupt the service.`)
      if (!confirmed) return
    }

    setActionLoading(action)
    setActionResult(null)

    try {
      const res = await axios.post('/api/admin/action', { action })
      setActionResult({
        success: res.data.success,
        message: res.data.message || res.data.output || res.data.error || 'Unknown result'
      })
      toast({
        title: res.data.success ? 'Success' : 'Error',
        description: res.data.message || 'Action completed',
        variant: res.data.success ? 'default' : 'destructive'
      })
    } catch (e: any) {
      setActionResult({ success: false, message: e.response?.data?.error || e.message })
      toast({
        title: 'Error',
        description: e.response?.data?.error || e.message,
        variant: 'destructive'
      })
    } finally {
      setActionLoading(null)
    }
  }

  // Repair session
  const repairSession = async () => {
    if (actionLoading) return
    setActionLoading('repair')
    setActionResult(null)

    try {
      const res = await axios.post('/api/admin/repair', { sessionId: '1' })
      setActionResult({
        success: res.data.success,
        message: res.data.success
          ? `✅ Session repaired! Cleaned: ${res.data.details?.cleaned?.length || 0} files.`
          : res.data.message || 'Repair failed'
      })
    } catch (e: any) {
      setActionResult({ success: false, message: e.response?.data?.message || e.message })
    } finally {
      setActionLoading(null)
    }
  }

  // Setup SSE pour temps réel
  useEffect(() => {
    if (!autoRefresh) {
      if (eventSourceRef.current) {
        eventSourceRef.current.close()
        eventSourceRef.current = null
      }
      return
    }

    const sourcesParam = selectedSources.join(',')
    const es = new EventSource(`/api/admin/monitor/stream?sources=${sourcesParam}`)
    
    es.onmessage = (event) => {
      const data = JSON.parse(event.data)
      if (data.type === 'logs' && data.logs.length > 0) {
        setLogs(prev => {
          // Merge et déduplique
          const newLogs = data.logs.filter((l: LogEntry) => 
            !prev.some(p => p.id === l.id)
          )
          if (newLogs.length > 0) {
            const merged = [...newLogs, ...prev].slice(0, 200)
            // Notification pour erreurs CRITICAL
            const criticalCount = newLogs.filter((l: LogEntry) => l.level === 'CRITICAL').length
            if (criticalCount > 0) {
              toast({
                title: `🚨 ${criticalCount} Critical Error${criticalCount > 1 ? 's' : ''}`,
                description: 'New critical system errors detected',
                variant: 'destructive'
              })
            }
            return merged
          }
          return prev
        })
        if (data.stats) setStats(data.stats)
      }
    }
    
    es.onerror = () => {
      console.error('SSE error')
      es.close()
    }
    
    eventSourceRef.current = es
    
    return () => {
      es.close()
      eventSourceRef.current = null
    }
  }, [autoRefresh, selectedSources, toast])

  // Polling initial et périodique
  useEffect(() => {
    fetchLogs()
    fetchSystemStatus()
    setLoading(false)

    const interval = setInterval(() => {
      fetchSystemStatus()
    }, 10000) // 10s pour le statut système

    return () => clearInterval(interval)
  }, [fetchLogs, fetchSystemStatus])

  const filteredLogs = showOnlyUnread 
    ? logs.filter(l => !l.isRead)
    : logs

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Activity className="h-6 w-6 text-blue-500" />
            System Monitor
          </h1>
          <p className="text-muted-foreground">
            Real-time error tracking and system health
          </p>
        </div>
        <div className="flex items-center gap-3">
          {unreadCount > 0 && (
            <Badge variant="destructive" className="animate-pulse">
              <Bell className="h-3 w-3 mr-1" />
              {unreadCount} unread
            </Badge>
          )}
          <Button
            variant="outline"
            size="sm"
            onClick={() => setAutoRefresh(!autoRefresh)}
            className={cn(autoRefresh && 'bg-green-500/10 text-green-600')}
          >
            {autoRefresh ? (
              <><CheckCircle className="h-4 w-4 mr-2" /> Live</>
            ) : (
              <><EyeOff className="h-4 w-4 mr-2" /> Paused</>
            )}
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={fetchLogs}
            disabled={loading}
          >
            <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
        </div>
      </div>

      {/* Stats Cards */}
      {stats && (
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
          <Card className={cn(stats.criticalCount > 0 && 'border-red-500/50 bg-red-500/5')}>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Critical</p>
                  <p className={cn('text-2xl font-bold', stats.criticalCount > 0 ? 'text-red-500' : '')}>
                    {stats.criticalCount}
                  </p>
                </div>
                <AlertTriangle className={cn('h-8 w-8', stats.criticalCount > 0 ? 'text-red-500' : 'text-muted-foreground')} />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Errors</p>
                  <p className="text-2xl font-bold text-orange-500">{stats.byLevel.ERROR || 0}</p>
                </div>
                <AlertCircle className="h-8 w-8 text-orange-500/50" />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Warnings</p>
                  <p className="text-2xl font-bold text-yellow-500">{stats.byLevel.WARN || 0}</p>
                </div>
                <Info className="h-8 w-8 text-yellow-500/50" />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">WhatsApp</p>
                  <p className="text-2xl font-bold text-green-500">{stats.bySource.whatsapp || 0}</p>
                </div>
                <MessageSquare className="h-8 w-8 text-green-500/50" />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Discord</p>
                  <p className="text-2xl font-bold text-indigo-500">{stats.bySource.discord || 0}</p>
                </div>
                <Server className="h-8 w-8 text-indigo-500/50" />
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* System Status */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Server className="h-5 w-5" />
            WhatsApp Server Status
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="flex items-center gap-3">
              <div className={cn(
                'h-3 w-3 rounded-full',
                systemStatus?.connected ? 'bg-green-500 animate-pulse' : 'bg-red-500'
              )} />
              <div>
                <p className="text-sm text-muted-foreground">Status</p>
                <p className="font-medium">
                  {systemStatus?.connected ? 'Connected' : 'Disconnected'}
                </p>
              </div>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Uptime</p>
              <p className="font-medium">{systemStatus?.uptime || '--'}</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Memory</p>
              <p className="font-medium">{systemStatus?.memory?.heapUsed || '--'}</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Chats</p>
              <p className="font-medium">{systemStatus?.chatsLoaded ?? '--'}</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Filters */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <Filter className="h-5 w-5" />
            Filters
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Source filters */}
          <div className="flex flex-wrap gap-2">
            <span className="text-sm text-muted-foreground self-center mr-2">Sources:</span>
            {Object.entries(SOURCE_CONFIG).map(([source, config]) => {
              const Icon = config.icon
              const isSelected = selectedSources.includes(source)
              return (
                <Button
                  key={source}
                  variant={isSelected ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => {
                    setSelectedSources(prev => 
                      isSelected 
                        ? prev.filter(s => s !== source)
                        : [...prev, source]
                    )
                  }}
                  className="h-8"
                >
                  <Icon className={cn('h-4 w-4 mr-2', config.color)} />
                  {config.label}
                </Button>
              )
            })}
          </div>
          
          {/* Level filters */}
          <div className="flex flex-wrap gap-2">
            <span className="text-sm text-muted-foreground self-center mr-2">Levels:</span>
            {Object.entries(LEVEL_CONFIG).map(([level, config]) => {
              const Icon = config.icon
              const isSelected = selectedLevels.includes(level)
              return (
                <Button
                  key={level}
                  variant={isSelected ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => {
                    setSelectedLevels(prev => 
                      isSelected 
                        ? prev.filter(l => l !== level)
                        : [...prev, level]
                    )
                  }}
                  className={cn('h-8', !isSelected && config.bg, !isSelected && config.text)}
                >
                  <Icon className={cn('h-4 w-4 mr-2')} />
                  {config.label}
                </Button>
              )
            })}
          </div>

          {/* Options */}
          <div className="flex gap-2 pt-2 border-t">
            <Button
              variant={showOnlyUnread ? 'default' : 'outline'}
              size="sm"
              onClick={() => setShowOnlyUnread(!showOnlyUnread)}
            >
              <Eye className="h-4 w-4 mr-2" />
              Unread Only {unreadCount > 0 && `(${unreadCount})`}
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => markAsRead()}
              disabled={unreadCount === 0}
            >
              <CheckCheck className="h-4 w-4 mr-2" />
              Mark All Read
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Quick Actions */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <Power className="h-5 w-5" />
            Quick Actions
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => executeAction('git_pull')}
              disabled={!!actionLoading}
            >
              {actionLoading === 'git_pull' ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <GitBranch className="h-4 w-4 mr-2" />}
              Git Pull
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => executeAction('restart')}
              disabled={!!actionLoading}
              className="border-yellow-500/50 hover:bg-yellow-500/10"
            >
              {actionLoading === 'restart' ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <RefreshCw className="h-4 w-4 mr-2" />}
              Restart Container
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={repairSession}
              disabled={!!actionLoading}
              className="border-amber-500/50 hover:bg-amber-500/10"
            >
              {actionLoading === 'repair' ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Wrench className="h-4 w-4 mr-2" />}
              Repair Session
            </Button>
          </div>
          
          {actionResult && (
            <div className={cn(
              'mt-4 p-3 rounded-lg text-sm',
              actionResult.success 
                ? 'bg-green-500/10 border border-green-500/20 text-green-600' 
                : 'bg-red-500/10 border border-red-500/20 text-red-600'
            )}>
              {actionResult.message}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Logs Table */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Terminal className="h-5 w-5" />
            Error Logs
            <Badge variant="outline">{filteredLogs.length} entries</Badge>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="rounded-lg border overflow-hidden">
            <table className="w-full">
              <thead className="bg-muted/50">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase">Level</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase">Source</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase">Time</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase">Message</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {filteredLogs.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="px-4 py-8 text-center text-muted-foreground">
                      <CheckCircle className="h-8 w-8 mx-auto mb-2 text-green-500" />
                      No errors found. All systems operational!
                    </td>
                  </tr>
                ) : (
                  filteredLogs.map((log) => {
                    const levelConfig = LEVEL_CONFIG[log.level]
                    const LevelIcon = levelConfig.icon
                    const sourceConfig = SOURCE_CONFIG[log.source]
                    const isExpanded = expandedLog === log.id
                    
                    return (
                      <tr 
                        key={log.id} 
                        className={cn(
                          'hover:bg-muted/50 transition-colors',
                          !log.isRead && 'bg-blue-500/5',
                          log.level === 'CRITICAL' && 'bg-red-500/5'
                        )}
                      >
                        <td className="px-4 py-3">
                          <Badge className={cn(levelConfig.bg, levelConfig.text, levelConfig.border)}>
                            <LevelIcon className="h-3 w-3 mr-1" />
                            {levelConfig.label}
                          </Badge>
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2">
                            {sourceConfig && <sourceConfig.icon className={cn('h-4 w-4', sourceConfig.color)} />}
                            <span className="text-sm capitalize">{log.source}</span>
                            {log.service && (
                              <span className="text-xs text-muted-foreground">({log.service})</span>
                            )}
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          <span className="text-sm text-muted-foreground font-mono">
                            {new Date(log.timestamp).toLocaleTimeString()}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <div className="space-y-1">
                            <p className={cn('text-sm font-medium', !log.isRead && 'text-blue-600')}>
                              {log.message}
                            </p>
                            {isExpanded && log.context && (
                              <pre className="mt-2 p-3 bg-slate-900 rounded text-xs text-green-400 overflow-x-auto max-h-40 overflow-y-auto">
                                {log.context}
                              </pre>
                            )}
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-6 text-xs"
                              onClick={() => setExpandedLog(isExpanded ? null : log.id)}
                            >
                              {isExpanded ? 'Show Less' : 'Show More'}
                            </Button>
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex gap-1">
                            {!log.isRead && (
                              <Button
                                variant="ghost"
                                size="sm"
                                className="h-8 w-8 p-0"
                                onClick={() => markAsRead([log.id])}
                              >
                                <Eye className="h-4 w-4" />
                              </Button>
                            )}
                          </div>
                        </td>
                      </tr>
                    )
                  })
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
