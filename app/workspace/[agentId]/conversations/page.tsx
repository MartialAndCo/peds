'use client'

import { useEffect, useState, useCallback } from 'react'
import { useParams, useRouter } from 'next/navigation'
import axios from 'axios'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Separator } from '@/components/ui/separator'
import { cn } from '@/lib/utils'
import { usePWAMode } from '@/hooks/use-pwa-mode'
import { 
  Search, 
  Loader2, 
  RefreshCw, 
  MessageSquare,
  Inbox,
  X
} from 'lucide-react'
import { ConversationCard, ConversationCardData } from '@/components/conversations/conversation-card'
import { 
  ConversationFilters, 
  ConversationFilter,
  ConversationSort,
  SortOption 
} from '@/components/conversations/conversation-filters'
import { MobileConversationList } from '@/components/pwa/pages/mobile-conversation-list'
import { ConversationUnifiedView } from '@/components/conversations/conversation-unified-view'

interface FilterCounts {
  all: number
  unread: number
  needs_reply: number
  priority: number
  moneypot: number
  crisis: number
  new: number
  paused: number
  dormant: number
}

export default function WorkspaceConversationsPage() {
  const router = useRouter()
  const { isPWAStandalone } = usePWAMode()
  const { agentId } = useParams()
  
  const [conversations, setConversations] = useState<ConversationCardData[]>([])
  const [loading, setLoading] = useState(true)
  const [activeFilter, setActiveFilter] = useState<ConversationFilter>('all')
  const [sortBy, setSortBy] = useState<SortOption>('lastActivity')
  const [searchQuery, setSearchQuery] = useState('')
  const [counts, setCounts] = useState<FilterCounts>({
    all: 0, unread: 0, needs_reply: 0, priority: 0,
    moneypot: 0, crisis: 0, new: 0, paused: 0, dormant: 0
  })
  const [selectedConversationId, setSelectedConversationId] = useState<number | null>(null)
  const [isViewOpen, setIsViewOpen] = useState(false)

  const fetchConversations = useCallback(async () => {
    setLoading(true)
    try {
      const res = await axios.get(
        `/api/conversations/enriched?agentId=${agentId}&filter=${activeFilter}&sort=${sortBy}&search=${searchQuery}`
      )
      setConversations(res.data.conversations)
      setCounts(res.data.counts)
    } catch (error) {
      console.error('Failed to fetch conversations:', error)
    } finally {
      setLoading(false)
    }
  }, [agentId, activeFilter, sortBy, searchQuery])

  useEffect(() => {
    fetchConversations()
    
    // Auto-refresh every 10 seconds for unread counts
    const interval = setInterval(fetchConversations, 10000)
    return () => clearInterval(interval)
  }, [fetchConversations])

  const handleConversationClick = (conversationId: number) => {
    setSelectedConversationId(conversationId)
    setIsViewOpen(true)
    
    // Mark as read when opened (will be handled by the view component)
  }

  const handleCloseView = () => {
    setIsViewOpen(false)
    setSelectedConversationId(null)
    fetchConversations() // Refresh to update unread counts
  }

  const selectedConversation = conversations.find(c => c.id === selectedConversationId)

  // Mobile view
  if (isPWAStandalone) {
    return (
      <div className="h-full flex flex-col bg-[#0f172a]">
        {/* Mobile Header */}
        <div className="sticky top-0 z-10 bg-[#0f172a]/95 backdrop-blur-xl border-b border-white/[0.06] px-4 py-3">
          <div className="flex items-center justify-between mb-3">
            <h1 className="text-2xl font-bold text-white flex items-center gap-2">
              <Inbox className="h-6 w-6" />
              Inbox
              {counts.unread > 0 && (
                <Badge className="bg-red-500 text-white border-0 ml-2">
                  {counts.unread}
                </Badge>
              )}
            </h1>
            <Button
              variant="ghost"
              size="icon"
              onClick={fetchConversations}
              disabled={loading}
              className="text-white/60"
            >
              <RefreshCw className={cn("h-5 w-5", loading && "animate-spin")} />
            </Button>
          </div>
          
          {/* Search */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-white/40" />
            <Input
              placeholder="Search conversations..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9 bg-white/5 border-white/10 rounded-xl text-white placeholder:text-white/30"
            />
          </div>
          
          {/* Mobile Filters */}
          <div className="mt-3">
            <ConversationFilters
              activeFilter={activeFilter}
              onFilterChange={setActiveFilter}
              counts={counts}
              compact
            />
          </div>
        </div>

        {/* Mobile Conversation List */}
        <ScrollArea className="flex-1">
          <div className="px-4 py-2 space-y-2">
            {loading && conversations.length === 0 ? (
              <div className="flex justify-center py-10">
                <Loader2 className="h-8 w-8 animate-spin text-white/30" />
              </div>
            ) : conversations.length === 0 ? (
              <div className="text-center py-10 text-white/30">
                <MessageSquare className="h-12 w-12 mx-auto mb-3 opacity-20" />
                <p>No conversations found</p>
              </div>
            ) : (
              conversations.map((conv) => (
                <ConversationCard
                  key={conv.id}
                  conversation={conv}
                  onClick={() => handleConversationClick(conv.id)}
                  isSelected={selectedConversationId === conv.id}
                  compact
                />
              ))
            )}
          </div>
        </ScrollArea>

        {/* Mobile Unified View Drawer */}
        {isViewOpen && selectedConversation && (
          <ConversationUnifiedView
            conversation={selectedConversation}
            isOpen={isViewOpen}
            onClose={handleCloseView}
            agentId={agentId as string}
          />
        )}
      </div>
    )
  }

  // Desktop view
  return (
    <div className="h-[calc(100vh-4rem)] flex gap-6">
      {/* Left Sidebar - Filters & List */}
      <div className={cn(
        "flex flex-col transition-all duration-300",
        isViewOpen ? "w-80 flex-shrink-0" : "w-full"
      )}>
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-4">
            <h2 className="text-2xl font-bold tracking-tighter text-white italic flex items-center gap-3">
              <Inbox className="h-7 w-7" />
              Inbox
              {counts.unread > 0 && (
                <Badge className="bg-red-500 text-white border-0 text-sm px-2.5 py-0.5">
                  {counts.unread} unread
                </Badge>
              )}
            </h2>
          </div>
          <div className="flex items-center gap-2">
            <ConversationSort value={sortBy} onChange={setSortBy} />
            <Button
              variant="outline"
              size="sm"
              onClick={fetchConversations}
              disabled={loading}
              className="border-white/10 text-white/60 hover:text-white hover:bg-white/5"
            >
              <RefreshCw className={cn("h-4 w-4 mr-2", loading && "animate-spin")} />
              Refresh
            </Button>
          </div>
        </div>

        {/* Search & Filters */}
        <div className="space-y-4 mb-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-white/40" />
            <Input
              placeholder="Search by name or phone..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9 bg-white/5 border-white/10 rounded-xl text-white placeholder:text-white/30"
            />
            {searchQuery && (
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setSearchQuery('')}
                className="absolute right-2 top-1/2 -translate-y-1/2 h-6 w-6 text-white/40 hover:text-white"
              >
                <X className="h-3 w-3" />
              </Button>
            )}
          </div>
          
          <ConversationFilters
            activeFilter={activeFilter}
            onFilterChange={setActiveFilter}
            counts={counts}
          />
        </div>

        <Separator className="bg-white/10 mb-4" />

        {/* Conversation List */}
        <ScrollArea className="flex-1 -mx-2 px-2">
          {loading && conversations.length === 0 ? (
            <div className="flex justify-center py-10">
              <Loader2 className="h-10 w-10 animate-spin text-white/30" />
            </div>
          ) : conversations.length === 0 ? (
            <div className="text-center py-12 text-white/30">
              <MessageSquare className="h-16 w-16 mx-auto mb-4 opacity-20" />
              <p className="text-lg">No conversations found</p>
              <p className="text-sm mt-1">Try adjusting your filters</p>
            </div>
          ) : (
            <div className="space-y-3 pb-4">
              {conversations.map((conv) => (
                <ConversationCard
                  key={conv.id}
                  conversation={conv}
                  onClick={() => handleConversationClick(conv.id)}
                  isSelected={selectedConversationId === conv.id}
                />
              ))}
            </div>
          )}
        </ScrollArea>
      </div>

      {/* Right Panel - Unified View */}
      {isViewOpen && selectedConversation && (
        <>
          <Separator orientation="vertical" className="bg-white/10" />
          <div className="flex-1 min-w-0">
            <ConversationUnifiedView
              conversation={selectedConversation}
              isOpen={isViewOpen}
              onClose={handleCloseView}
              agentId={agentId as string}
              embedded
            />
          </div>
        </>
      )}
    </div>
  )
}
