'use client'

import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'
import { 
  Bell, 
  AlertTriangle, 
  TrendingUp, 
  Clock, 
  MessageCircle,
  Zap,
  Check,
  Filter,
  X
} from 'lucide-react'
import { useState } from 'react'

export type ConversationFilter = 
  | 'all' 
  | 'unread' 
  | 'needs_reply' 
  | 'priority' 
  | 'moneypot' 
  | 'crisis' 
  | 'dormant' 
  | 'new' 
  | 'paused'

interface FilterConfig {
  id: ConversationFilter
  label: string
  icon: any
  color: string
  description: string
}

const filters: FilterConfig[] = [
  {
    id: 'all',
    label: 'All',
    icon: MessageCircle,
    color: 'text-white/60 border-white/10 hover:bg-white/5',
    description: 'All conversations'
  },
  {
    id: 'unread',
    label: 'Unread',
    icon: Bell,
    color: 'text-red-400 border-red-500/20 bg-red-500/10 hover:bg-red-500/20',
    description: 'New messages from contacts'
  },
  {
    id: 'needs_reply',
    label: 'Needs Reply',
    icon: Zap,
    color: 'text-orange-400 border-orange-500/20 bg-orange-500/10 hover:bg-orange-500/20',
    description: 'Waiting for your response'
  },
  {
    id: 'priority',
    label: 'High Priority',
    icon: AlertTriangle,
    color: 'text-amber-400 border-amber-500/20 bg-amber-500/10 hover:bg-amber-500/20',
    description: 'Crisis or high trust contacts'
  },
  {
    id: 'moneypot',
    label: 'Moneypot',
    icon: TrendingUp,
    color: 'text-emerald-400 border-emerald-500/20 bg-emerald-500/10 hover:bg-emerald-500/20',
    description: 'Payment ready phase'
  },
  {
    id: 'crisis',
    label: 'Crisis',
    icon: AlertTriangle,
    color: 'text-red-400 border-red-500/20 bg-red-500/10 hover:bg-red-500/20',
    description: 'Crisis phase contacts'
  },
  {
    id: 'new',
    label: 'New Leads',
    icon: MessageCircle,
    color: 'text-sky-400 border-sky-500/20 bg-sky-500/10 hover:bg-sky-500/20',
    description: 'Fresh contacts'
  },
  {
    id: 'paused',
    label: 'Paused',
    icon: Clock,
    color: 'text-white/40 border-white/10 hover:bg-white/5',
    description: 'AI paused, needs context'
  },
  {
    id: 'dormant',
    label: 'Dormant',
    icon: Clock,
    color: 'text-white/30 border-white/5 hover:bg-white/5',
    description: 'No activity >24h'
  },
]

interface ConversationFiltersProps {
  activeFilter: ConversationFilter
  onFilterChange: (filter: ConversationFilter) => void
  counts: Record<ConversationFilter, number>
  compact?: boolean
}

export function ConversationFilters({ 
  activeFilter, 
  onFilterChange, 
  counts,
  compact = false 
}: ConversationFiltersProps) {
  const [showAll, setShowAll] = useState(false)
  
  const visibleFilters = compact && !showAll 
    ? filters.slice(0, 4) 
    : filters

  if (compact) {
    return (
      <div className="space-y-2">
        <div className="flex items-center justify-between px-1">
          <span className="text-xs font-medium text-white/40 uppercase tracking-wider">Filters</span>
          {filters.length > 4 && (
            <Button 
              variant="ghost" 
              size="sm" 
              onClick={() => setShowAll(!showAll)}
              className="h-6 text-[10px] text-white/40 hover:text-white"
            >
              {showAll ? 'Less' : 'More'}
            </Button>
          )}
        </div>
        <div className="flex flex-wrap gap-1.5">
          {visibleFilters.map((filter) => {
            const Icon = filter.icon
            const count = counts[filter.id] || 0
            const isActive = activeFilter === filter.id
            
            return (
              <button
                key={filter.id}
                onClick={() => onFilterChange(filter.id)}
                className={cn(
                  "flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium transition-all border",
                  isActive 
                    ? filter.color + " ring-1 ring-white/10" 
                    : "text-white/40 border-transparent hover:bg-white/5 hover:text-white/60"
                )}
              >
                <Icon className="h-3 w-3" />
                <span>{filter.label}</span>
                {count > 0 && (
                  <span className={cn(
                    "ml-0.5 text-[10px] px-1 rounded-full",
                    isActive ? "bg-white/20" : "bg-white/10"
                  )}>
                    {count > 99 ? '99+' : count}
                  </span>
                )}
              </button>
            )
          })}
        </div>
      </div>
    )
  }

  // Desktop view
  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <Filter className="h-4 w-4 text-white/40" />
        <span className="text-xs font-medium text-white/40 uppercase tracking-wider">Quick Filters</span>
      </div>
      
      <div className="flex flex-wrap gap-2">
        {filters.map((filter) => {
          const Icon = filter.icon
          const count = counts[filter.id] || 0
          const isActive = activeFilter === filter.id
          
          return (
            <Button
              key={filter.id}
              variant="outline"
              size="sm"
              onClick={() => onFilterChange(filter.id)}
              className={cn(
                "h-8 px-3 text-xs font-medium transition-all border",
                isActive 
                  ? filter.color + " ring-1 ring-white/10 shadow-lg" 
                  : "text-white/40 border-white/10 hover:bg-white/5 hover:text-white/60 hover:border-white/20"
              )}
            >
              <Icon className="h-3.5 w-3.5 mr-1.5" />
              {filter.label}
              {count > 0 && (
                <Badge 
                  variant="secondary" 
                  className={cn(
                    "ml-2 text-[10px] px-1.5 py-0",
                    isActive ? "bg-white/20 text-white" : "bg-white/10 text-white/60"
                  )}
                >
                  {count > 99 ? '99+' : count}
                </Badge>
              )}
            </Button>
          )
        })}
      </div>
    </div>
  )
}

// Sort options
export type SortOption = 'lastActivity' | 'unread' | 'trust' | 'phase' | 'created'

interface SortConfig {
  id: SortOption
  label: string
}

const sortOptions: SortConfig[] = [
  { id: 'lastActivity', label: 'Last Activity' },
  { id: 'unread', label: 'Unread First' },
  { id: 'trust', label: 'Trust Score' },
  { id: 'phase', label: 'Phase' },
  { id: 'created', label: 'Date Created' },
]

interface ConversationSortProps {
  value: SortOption
  onChange: (sort: SortOption) => void
}

export function ConversationSort({ value, onChange }: ConversationSortProps) {
  return (
    <div className="flex items-center gap-2">
      <span className="text-xs text-white/40">Sort by:</span>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value as SortOption)}
        className="bg-white/5 border border-white/10 rounded-md text-xs text-white/80 px-2 py-1 focus:outline-none focus:ring-1 focus:ring-white/20"
      >
        {sortOptions.map((opt) => (
          <option key={opt.id} value={opt.id} className="bg-[#0f172a]">
            {opt.label}
          </option>
        ))}
      </select>
    </div>
  )
}
