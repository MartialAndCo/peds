'use client'

import { useEffect, useState } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Skeleton } from '@/components/ui/skeleton'
import { Badge } from '@/components/ui/badge'
import { 
    Search, 
    Filter, 
    MessageCircle, 
    Gamepad2, 
    ChevronLeft,
    ChevronRight,
    Calendar,
    Clock
} from 'lucide-react'
import { format } from 'date-fns'

interface Lead {
    id: string
    type: 'WHATSAPP' | 'DISCORD'
    identifier: string
    age?: number
    location?: string
    source: string
    status: 'PENDING' | 'IMPORTED' | 'CONVERTED' | 'REJECTED'
    createdAt: string
    agent: {
        id: string
        name: string
        color: string
    }
    contact?: {
        id: string
        status: string
    }
}

interface LeadsResponse {
    leads: Lead[]
    total: number
    page: number
    pages: number
}

const statusColors: Record<string, string> = {
    PENDING: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/50',
    IMPORTED: 'bg-blue-500/20 text-blue-400 border-blue-500/50',
    CONVERTED: 'bg-green-500/20 text-green-400 border-green-500/50',
    REJECTED: 'bg-red-500/20 text-red-400 border-red-500/50'
}

const statusLabels: Record<string, string> = {
    PENDING: 'Pending',
    IMPORTED: 'Imported',
    CONVERTED: 'Converted',
    REJECTED: 'Rejected'
}

export default function LeadHistoryPage() {
    const [data, setData] = useState<LeadsResponse | null>(null)
    const [loading, setLoading] = useState(true)
    const [page, setPage] = useState(1)
    const [filter, setFilter] = useState('')
    const [typeFilter, setTypeFilter] = useState<string>('ALL')
    const [statusFilter, setStatusFilter] = useState<string>('ALL')

    useEffect(() => {
        fetchLeads()
    }, [page, typeFilter, statusFilter])

    const fetchLeads = async () => {
        setLoading(true)
        try {
            const params = new URLSearchParams()
            params.set('page', page.toString())
            params.set('limit', '20')
            if (typeFilter !== 'ALL') params.set('type', typeFilter)
            if (statusFilter !== 'ALL') params.set('status', statusFilter)

            const res = await fetch(`/api/provider/leads?${params}`)
            if (res.ok) {
                const data = await res.json()
                setData(data)
            }
        } catch (error) {
            console.error('Failed to fetch leads:', error)
        } finally {
            setLoading(false)
        }
    }

    const filteredLeads = data?.leads.filter(lead => 
        filter === '' || 
        lead.identifier.toLowerCase().includes(filter.toLowerCase()) ||
        lead.source.toLowerCase().includes(filter.toLowerCase()) ||
        lead.location?.toLowerCase().includes(filter.toLowerCase())
    ) || []

    return (
        <div className="pb-24">
            {/* Header */}
            <div className="mb-6">
                <h2 className="text-2xl font-bold text-white">Lead History</h2>
                <p className="text-slate-400 mt-1">View all your submitted leads</p>
            </div>

            {/* Search & Filters */}
            <div className="space-y-3 mb-4">
                <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                    <Input
                        placeholder="Search by identifier, source, location..."
                        value={filter}
                        onChange={(e) => setFilter(e.target.value)}
                        className="pl-10 bg-slate-800 border-slate-700 text-white"
                    />
                </div>
                
                <div className="flex gap-2 overflow-x-auto pb-2">
                    <select
                        value={typeFilter}
                        onChange={(e) => { setTypeFilter(e.target.value); setPage(1) }}
                        className="bg-slate-800 border border-slate-700 text-white rounded-lg px-3 py-2 text-sm"
                    >
                        <option value="ALL">All Types</option>
                        <option value="WHATSAPP">WhatsApp</option>
                        <option value="DISCORD">Discord</option>
                    </select>
                    
                    <select
                        value={statusFilter}
                        onChange={(e) => { setStatusFilter(e.target.value); setPage(1) }}
                        className="bg-slate-800 border border-slate-700 text-white rounded-lg px-3 py-2 text-sm"
                    >
                        <option value="ALL">All Status</option>
                        <option value="PENDING">Pending</option>
                        <option value="IMPORTED">Imported</option>
                        <option value="CONVERTED">Converted</option>
                        <option value="REJECTED">Rejected</option>
                    </select>
                </div>
            </div>

            {/* Stats */}
            {data && (
                <div className="flex items-center justify-between text-sm text-slate-400 mb-4">
                    <span>{data.total} total leads</span>
                    <span>Page {data.page} of {data.pages}</span>
                </div>
            )}

            {/* Leads List */}
            <div className="space-y-3">
                {loading ? (
                    // Skeletons
                    [...Array(5)].map((_, i) => (
                        <Skeleton key={i} className="h-32 bg-slate-800" />
                    ))
                ) : filteredLeads.length === 0 ? (
                    <Card className="bg-slate-900 border-slate-800">
                        <CardContent className="p-8 text-center">
                            <p className="text-slate-400">No leads found</p>
                            <Button onClick={fetchLeads} variant="outline" className="mt-4">
                                Refresh
                            </Button>
                        </CardContent>
                    </Card>
                ) : (
                    filteredLeads.map((lead) => (
                        <Card key={lead.id} className="bg-slate-900 border-slate-800 hover:border-slate-700 transition-colors">
                            <CardContent className="p-4">
                                <div className="flex items-start justify-between gap-3">
                                    <div className="flex-1 min-w-0">
                                        {/* Header */}
                                        <div className="flex items-center gap-2 mb-2">
                                            {lead.type === 'WHATSAPP' ? (
                                                <div className="w-8 h-8 rounded-lg bg-green-500/20 flex items-center justify-center shrink-0">
                                                    <MessageCircle className="w-4 h-4 text-green-400" />
                                                </div>
                                            ) : (
                                                <div className="w-8 h-8 rounded-lg bg-indigo-500/20 flex items-center justify-center shrink-0">
                                                    <Gamepad2 className="w-4 h-4 text-indigo-400" />
                                                </div>
                                            )}
                                            <div className="min-w-0">
                                                <p className="font-medium text-white truncate">
                                                    {lead.identifier}
                                                </p>
                                                <p className="text-xs text-slate-500">{lead.source}</p>
                                            </div>
                                        </div>

                                        {/* Details */}
                                        <div className="flex flex-wrap gap-2 text-xs text-slate-400 mt-3">
                                            {lead.age && (
                                                <span className="bg-slate-800 px-2 py-1 rounded">
                                                    {lead.age} years
                                                </span>
                                            )}
                                            {lead.location && (
                                                <span className="bg-slate-800 px-2 py-1 rounded truncate max-w-[150px]">
                                                    {lead.location}
                                                </span>
                                            )}
                                            <span 
                                                className="px-2 py-1 rounded text-white"
                                                style={{ backgroundColor: lead.agent.color || '#3b82f6' }}
                                            >
                                                {lead.agent.name}
                                            </span>
                                        </div>

                                        {/* Date */}
                                        <div className="flex items-center gap-1 text-xs text-slate-500 mt-2">
                                            <Clock className="w-3 h-3" />
                                            {format(new Date(lead.createdAt), 'MMM d, yyyy HH:mm')}
                                        </div>
                                    </div>

                                    {/* Status Badge */}
                                    <Badge 
                                        variant="outline" 
                                        className={`shrink-0 ${statusColors[lead.status]}`}
                                    >
                                        {statusLabels[lead.status]}
                                    </Badge>
                                </div>
                            </CardContent>
                        </Card>
                    ))
                )}
            </div>

            {/* Pagination */}
            {data && data.pages > 1 && (
                <div className="flex items-center justify-between mt-6">
                    <Button
                        variant="outline"
                        onClick={() => setPage(p => Math.max(1, p - 1))}
                        disabled={page === 1 || loading}
                        className="border-slate-700 text-slate-300"
                    >
                        <ChevronLeft className="w-4 h-4 mr-1" />
                        Previous
                    </Button>
                    <span className="text-sm text-slate-400">
                        Page {page} of {data.pages}
                    </span>
                    <Button
                        variant="outline"
                        onClick={() => setPage(p => Math.min(data.pages, p + 1))}
                        disabled={page === data.pages || loading}
                        className="border-slate-700 text-slate-300"
                    >
                        Next
                        <ChevronRight className="w-4 h-4 ml-1" />
                    </Button>
                </div>
            )}
        </div>
    )
}
