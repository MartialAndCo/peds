'use client'

import { useEffect, useState, Suspense } from 'react'
import { useSearchParams } from 'next/navigation'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
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
    Clock,
    DollarSign,
    Users,
    ArrowLeft
} from 'lucide-react'
import { format } from 'date-fns'
import Link from 'next/link'

interface Lead {
    id: string
    type: 'WHATSAPP' | 'DISCORD'
    identifier: string
    age?: number
    location?: string
    source: string
    context?: string
    notes?: string
    status: 'PENDING' | 'IMPORTED' | 'CONVERTED' | 'REJECTED'
    pricePaid: number
    createdAt: string
    provider: {
        id: string
        email: string
    }
    agent: {
        id: string
        name: string
        color: string
    }
    contact?: {
        id: string
        status: string
        agentPhase: string
        conversations: {
            status: string
            lastMessageAt: string
        }[]
    }
}

interface LeadsResponse {
    leads: Lead[]
    total: number
    page: number
    pages: number
    stats: {
        total: number
        totalCost: number
        byStatus: Record<string, number>
    }
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

// Wrapper component to handle Suspense for useSearchParams
function ProviderLeadsContent() {
    const searchParams = useSearchParams()
    const initialProviderId = searchParams.get('providerId')
    
    const [data, setData] = useState<LeadsResponse | null>(null)
    const [loading, setLoading] = useState(true)
    const [page, setPage] = useState(1)
    const [filter, setFilter] = useState('')
    const [providerFilter, setProviderFilter] = useState(initialProviderId || '')
    const [statusFilter, setStatusFilter] = useState<string>('ALL')
    const [dateFrom, setDateFrom] = useState('')
    const [dateTo, setDateTo] = useState('')

    useEffect(() => {
        fetchLeads()
    }, [page, providerFilter, statusFilter, dateFrom, dateTo])

    const fetchLeads = async () => {
        setLoading(true)
        try {
            const params = new URLSearchParams()
            params.set('page', page.toString())
            params.set('limit', '50')
            if (providerFilter) params.set('providerId', providerFilter)
            if (statusFilter !== 'ALL') params.set('status', statusFilter)
            if (dateFrom) params.set('from', dateFrom)
            if (dateTo) params.set('to', dateTo)

            const res = await fetch(`/api/admin/provider-leads?${params}`)
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
        lead.provider.email.toLowerCase().includes(filter.toLowerCase()) ||
        lead.location?.toLowerCase().includes(filter.toLowerCase())
    ) || []

    return (
        <div className="space-y-6 max-w-7xl mx-auto">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                    <Link href="/admin/team">
                        <Button variant="outline" size="icon" className="border-slate-700">
                            <ArrowLeft className="h-4 w-4" />
                        </Button>
                    </Link>
                    <div>
                        <h1 className="text-2xl font-bold text-white">Provider Leads</h1>
                        <p className="text-white/40">View and manage all leads from providers</p>
                    </div>
                </div>
            </div>

            {/* Stats Cards */}
            {data?.stats && (
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                    <Card className="bg-slate-900 border-slate-800">
                        <CardContent className="p-4">
                            <div className="flex items-center justify-between">
                                <div>
                                    <p className="text-sm text-slate-400">Total Leads</p>
                                    <p className="text-2xl font-bold text-white">{data.stats.total}</p>
                                </div>
                                <Users className="h-8 w-8 text-slate-600" />
                            </div>
                        </CardContent>
                    </Card>
                    <Card className="bg-slate-900 border-slate-800">
                        <CardContent className="p-4">
                            <div className="flex items-center justify-between">
                                <div>
                                    <p className="text-sm text-slate-400">Total Cost</p>
                                    <p className="text-2xl font-bold text-green-400">${data.stats.totalCost}</p>
                                </div>
                                <DollarSign className="h-8 w-8 text-slate-600" />
                            </div>
                        </CardContent>
                    </Card>
                    <Card className="bg-slate-900 border-slate-800">
                        <CardContent className="p-4">
                            <div className="flex items-center justify-between">
                                <div>
                                    <p className="text-sm text-slate-400">Converted</p>
                                    <p className="text-2xl font-bold text-green-400">
                                        {data.stats.byStatus.CONVERTED || 0}
                                    </p>
                                </div>
                                <div className="w-3 h-3 rounded-full bg-green-500" />
                            </div>
                        </CardContent>
                    </Card>
                    <Card className="bg-slate-900 border-slate-800">
                        <CardContent className="p-4">
                            <div className="flex items-center justify-between">
                                <div>
                                    <p className="text-sm text-slate-400">Pending</p>
                                    <p className="text-2xl font-bold text-yellow-400">
                                        {data.stats.byStatus.PENDING || 0}
                                    </p>
                                </div>
                                <div className="w-3 h-3 rounded-full bg-yellow-500" />
                            </div>
                        </CardContent>
                    </Card>
                </div>
            )}

            {/* Filters */}
            <Card className="bg-slate-900 border-slate-800">
                <CardContent className="p-4">
                    <div className="flex flex-wrap gap-4">
                        <div className="flex-1 min-w-[200px]">
                            <div className="relative">
                                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                                <Input
                                    placeholder="Search leads..."
                                    value={filter}
                                    onChange={(e) => setFilter(e.target.value)}
                                    className="pl-10 bg-slate-800 border-slate-700 text-white"
                                />
                            </div>
                        </div>
                        
                        <select
                            value={statusFilter}
                            onChange={(e) => { setStatusFilter(e.target.value); setPage(1) }}
                            className="bg-slate-800 border border-slate-700 text-white rounded-lg px-3 py-2"
                        >
                            <option value="ALL">All Status</option>
                            <option value="PENDING">Pending</option>
                            <option value="IMPORTED">Imported</option>
                            <option value="CONVERTED">Converted</option>
                            <option value="REJECTED">Rejected</option>
                        </select>

                        <Input
                            type="date"
                            value={dateFrom}
                            onChange={(e) => { setDateFrom(e.target.value); setPage(1) }}
                            className="bg-slate-800 border-slate-700 text-white w-auto"
                            placeholder="From"
                        />
                        <Input
                            type="date"
                            value={dateTo}
                            onChange={(e) => { setDateTo(e.target.value); setPage(1) }}
                            className="bg-slate-800 border-slate-700 text-white w-auto"
                            placeholder="To"
                        />

                        <Button onClick={fetchLeads} variant="outline" className="border-slate-700">
                            <Filter className="w-4 h-4 mr-2" />
                            Filter
                        </Button>
                    </div>
                </CardContent>
            </Card>

            {/* Leads Table */}
            <Card className="bg-slate-900 border-slate-800">
                <CardHeader>
                    <div className="flex items-center justify-between">
                        <CardTitle className="text-white">Lead Details</CardTitle>
                        {data && (
                            <span className="text-sm text-slate-400">
                                Showing {filteredLeads.length} of {data.total} leads
                            </span>
                        )}
                    </div>
                </CardHeader>
                <CardContent>
                    {loading ? (
                        <div className="space-y-3">
                            {[...Array(5)].map((_, i) => (
                                <Skeleton key={i} className="h-16 bg-slate-800" />
                            ))}
                        </div>
                    ) : filteredLeads.length === 0 ? (
                        <div className="text-center py-12">
                            <p className="text-slate-400">No leads found</p>
                        </div>
                    ) : (
                        <div className="overflow-x-auto">
                            <table className="w-full">
                                <thead>
                                    <tr className="border-b border-slate-800">
                                        <th className="text-left py-3 px-4 text-sm font-medium text-slate-400">Type</th>
                                        <th className="text-left py-3 px-4 text-sm font-medium text-slate-400">Identifier</th>
                                        <th className="text-left py-3 px-4 text-sm font-medium text-slate-400">Info</th>
                                        <th className="text-left py-3 px-4 text-sm font-medium text-slate-400">Source</th>
                                        <th className="text-left py-3 px-4 text-sm font-medium text-slate-400">Provider</th>
                                        <th className="text-left py-3 px-4 text-sm font-medium text-slate-400">Agent</th>
                                        <th className="text-left py-3 px-4 text-sm font-medium text-slate-400">Status</th>
                                        <th className="text-left py-3 px-4 text-sm font-medium text-slate-400">Date</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {filteredLeads.map((lead) => (
                                        <tr key={lead.id} className="border-b border-slate-800/50 hover:bg-slate-800/50">
                                            <td className="py-3 px-4">
                                                {lead.type === 'WHATSAPP' ? (
                                                    <div className="flex items-center gap-2 text-green-400">
                                                        <MessageCircle className="w-4 h-4" />
                                                        <span className="text-sm">WhatsApp</span>
                                                    </div>
                                                ) : (
                                                    <div className="flex items-center gap-2 text-indigo-400">
                                                        <Gamepad2 className="w-4 h-4" />
                                                        <span className="text-sm">Discord</span>
                                                    </div>
                                                )}
                                            </td>
                                            <td className="py-3 px-4">
                                                <span className="text-white font-medium">{lead.identifier}</span>
                                            </td>
                                            <td className="py-3 px-4">
                                                <div className="text-sm text-slate-400">
                                                    {lead.age && <span className="mr-2">{lead.age}y</span>}
                                                    {lead.location && <span>{lead.location}</span>}
                                                </div>
                                                {lead.context && (
                                                    <p className="text-xs text-slate-500 mt-1 max-w-[200px] truncate">
                                                        {lead.context}
                                                    </p>
                                                )}
                                            </td>
                                            <td className="py-3 px-4">
                                                <span className="text-sm text-slate-300">{lead.source}</span>
                                            </td>
                                            <td className="py-3 px-4">
                                                <span className="text-sm text-slate-300">{lead.provider.email}</span>
                                            </td>
                                            <td className="py-3 px-4">
                                                <div 
                                                    className="inline-flex items-center gap-1 px-2 py-1 rounded text-xs text-white"
                                                    style={{ backgroundColor: lead.agent.color }}
                                                >
                                                    {lead.agent.name}
                                                </div>
                                            </td>
                                            <td className="py-3 px-4">
                                                <Badge 
                                                    variant="outline" 
                                                    className={statusColors[lead.status]}
                                                >
                                                    {statusLabels[lead.status]}
                                                </Badge>
                                            </td>
                                            <td className="py-3 px-4">
                                                <div className="flex items-center gap-1 text-sm text-slate-400">
                                                    <Clock className="w-3 h-3" />
                                                    {format(new Date(lead.createdAt), 'MMM d, HH:mm')}
                                                </div>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}

                    {/* Pagination */}
                    {data && data.pages > 1 && (
                        <div className="flex items-center justify-between mt-6 pt-4 border-t border-slate-800">
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
                </CardContent>
            </Card>
        </div>
    )
}

// Main export with Suspense boundary
export default function ProviderLeadsPage() {
    return (
        <Suspense fallback={
            <div className="space-y-6 max-w-7xl mx-auto p-6">
                <div className="flex items-center gap-4">
                    <div className="h-10 w-10 bg-slate-800 rounded-lg animate-pulse" />
                    <div>
                        <div className="h-8 w-48 bg-slate-800 rounded animate-pulse" />
                        <div className="h-4 w-32 bg-slate-800 rounded mt-2 animate-pulse" />
                    </div>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                    {[...Array(4)].map((_, i) => (
                        <div key={i} className="h-24 bg-slate-800 rounded-lg animate-pulse" />
                    ))}
                </div>
                <div className="h-96 bg-slate-800 rounded-lg animate-pulse" />
            </div>
        }>
            <ProviderLeadsContent />
        </Suspense>
    )
}
