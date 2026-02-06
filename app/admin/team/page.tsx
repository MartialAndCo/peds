'use client'

import { useState, useEffect } from 'react'
import { Plus, Trash2, Shield, Users, Loader2, UserPlus, TrendingUp, Gamepad2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import Link from 'next/link'
import { useToast } from '@/components/ui/use-toast'
import { EditUserDialog } from '@/components/dashboard/edit-user-dialog'
import { CreateProviderDialog } from '@/components/dashboard/create-provider-dialog'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Badge } from '@/components/ui/badge'

interface User {
    id: string
    email: string
    role: string
    agents: { id: string, name: string, color: string }[]
    createdAt: string
}

interface Provider {
    id: string
    email: string
    createdAt: string
    agent: { id: string, name: string, color: string } | null
    stats: {
        totalLeads: number
        totalCost: number
    }
}

export default function TeamPage() {
    const { toast } = useToast()
    const [activeTab, setActiveTab] = useState('team')
    const [users, setUsers] = useState<User[]>([])
    const [providers, setProviders] = useState<Provider[]>([])
    const [isLoading, setIsLoading] = useState(true)
    const [isDeleting, setIsDeleting] = useState<string | null>(null)
    const [allAgents, setAllAgents] = useState<any[]>([])

    useEffect(() => {
        fetchData()
    }, [])

    async function fetchData() {
        try {
            const [usersRes, agentsRes, providersRes] = await Promise.all([
                fetch('/api/admin/users'),
                fetch('/api/agents'),
                fetch('/api/admin/providers')
            ])

            if (!usersRes.ok) throw new Error('Failed to fetch users')
            const usersData = await usersRes.json()
            // Filter out providers from team list
            setUsers(usersData.filter((u: User) => u.role !== 'PROVIDER'))

            if (agentsRes.ok) {
                const agentsData = await agentsRes.json()
                setAllAgents(agentsData)
            }

            if (providersRes.ok) {
                const providersData = await providersRes.json()
                setProviders(providersData)
            }
        } catch (error) {
            toast({
                variant: "destructive",
                title: "Error",
                description: "Failed to load data"
            })
        } finally {
            setIsLoading(false)
        }
    }

    async function handleDeleteUser(id: string) {
        if (!confirm('Are you sure you want to delete this user?')) return

        setIsDeleting(id)
        try {
            const res = await fetch(`/api/admin/users?id=${id}`, {
                method: 'DELETE'
            })

            if (!res.ok) {
                const err = await res.json()
                throw new Error(err.error || 'Failed to delete')
            }

            toast({ title: "Success", description: "User removed" })
            setUsers(users.filter(u => u.id !== id))
        } catch (error: any) {
            toast({
                variant: "destructive",
                title: "Error",
                description: error.message
            })
        } finally {
            setIsDeleting(null)
        }
    }

    async function handleDeleteProvider(id: string) {
        if (!confirm('Are you sure you want to delete this provider? All their leads will remain in the system.')) return

        setIsDeleting(id)
        try {
            const res = await fetch(`/api/admin/providers?id=${id}`, {
                method: 'DELETE'
            })

            if (!res.ok) {
                const err = await res.json()
                throw new Error(err.error || 'Failed to delete')
            }

            toast({ title: "Success", description: "Provider removed" })
            setProviders(providers.filter(p => p.id !== id))
        } catch (error: any) {
            toast({
                variant: "destructive",
                title: "Error",
                description: error.message
            })
        } finally {
            setIsDeleting(null)
        }
    }

    if (isLoading) {
        return <div className="p-8 flex justify-center"><Loader2 className="h-8 w-8 animate-spin text-white/50" /></div>
    }

    const totalLeadCost = providers.reduce((sum, p) => sum + p.stats.totalCost, 0)

    return (
        <div className="space-y-6 max-w-7xl mx-auto">
            <Tabs value={activeTab} onValueChange={setActiveTab}>
                <div className="flex items-center justify-between">
                    <div>
                        <h1 className="text-2xl font-bold text-white">Team Management</h1>
                        <p className="text-white/40">Manage administrators, collaborators and lead providers</p>
                    </div>
                    <div className="flex items-center gap-4">
                        <TabsList className="bg-slate-800">
                            <TabsTrigger value="team" className="data-[state=active]:bg-slate-700">Team</TabsTrigger>
                            <TabsTrigger value="providers" className="data-[state=active]:bg-slate-700">
                                Providers
                                {providers.length > 0 && (
                                    <Badge variant="secondary" className="ml-2 bg-blue-500/20 text-blue-400">
                                        {providers.length}
                                    </Badge>
                                )}
                            </TabsTrigger>
                        </TabsList>
                        
                        {activeTab === 'team' ? (
                            <Link href="/admin/team/create">
                                <Button className="bg-white text-black hover:bg-white/90">
                                    <Plus className="h-4 w-4 mr-2" />
                                    Add Member
                                </Button>
                            </Link>
                        ) : (
                            <CreateProviderDialog 
                                allAgents={allAgents} 
                                onCreate={fetchData}
                            />
                        )}
                    </div>
                </div>

                {/* Team Tab */}
                <TabsContent value="team" className="mt-6">
                    <div className="grid gap-4">
                        {users.map((user) => (
                            <div
                                key={user.id}
                                className="bg-[#1e293b] border border-white/5 p-4 rounded-xl flex items-center justify-between group"
                            >
                                <div className="flex items-center gap-4">
                                    <div className="h-10 w-10 rounded-full bg-white/5 flex items-center justify-center">
                                        {user.role === 'ADMIN' ? (
                                            <Shield className="h-5 w-5 text-amber-400" />
                                        ) : (
                                            <Users className="h-5 w-5 text-blue-400" />
                                        )}
                                    </div>
                                    <div>
                                        <p className="text-white font-medium">{user.email}</p>
                                        <div className="flex items-center gap-2 mt-1">
                                            <span className={`text-[10px] uppercase font-bold px-2 py-0.5 rounded-full ${user.role === 'ADMIN' ? 'bg-amber-500/10 text-amber-400' : 'bg-blue-500/10 text-blue-400'
                                                }`}>
                                                {user.role}
                                            </span>
                                            {user.agents.length > 0 && (
                                                <div className="flex -space-x-1">
                                                    {user.agents.map(agent => (
                                                        <div
                                                            key={agent.id}
                                                            title={agent.name}
                                                            className="h-5 w-5 rounded-full border border-[#1e293b] flex items-center justify-center text-[8px] text-white font-bold"
                                                            style={{ backgroundColor: agent.color }}
                                                        >
                                                            {agent.name.substring(0, 1)}
                                                        </div>
                                                    ))}
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                </div>

                                <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                    {user.role !== 'ADMIN' && (
                                        <>
                                            <EditUserDialog
                                                user={user}
                                                allAgents={allAgents}
                                                onUpdate={fetchData}
                                            />
                                            <Button
                                                size="icon"
                                                variant="destructive"
                                                onClick={() => handleDeleteUser(user.id)}
                                                disabled={!!isDeleting}
                                            >
                                                {isDeleting === user.id ? (
                                                    <Loader2 className="h-4 w-4 animate-spin" />
                                                ) : (
                                                    <Trash2 className="h-4 w-4" />
                                                )}
                                            </Button>
                                        </>
                                    )}
                                </div>
                            </div>
                        ))}
                    </div>
                </TabsContent>

                {/* Providers Tab */}
                <TabsContent value="providers" className="mt-6 space-y-6">
                    {/* Stats */}
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <div className="bg-[#1e293b] border border-white/5 p-4 rounded-xl">
                            <p className="text-white/40 text-sm">Total Providers</p>
                            <p className="text-2xl font-bold text-white mt-1">{providers.length}</p>
                        </div>
                        <div className="bg-[#1e293b] border border-white/5 p-4 rounded-xl">
                            <p className="text-white/40 text-sm">Total Leads</p>
                            <p className="text-2xl font-bold text-white mt-1">
                                {providers.reduce((sum, p) => sum + p.stats.totalLeads, 0)}
                            </p>
                        </div>
                        <div className="bg-[#1e293b] border border-white/5 p-4 rounded-xl">
                            <p className="text-white/40 text-sm">Total Cost</p>
                            <p className="text-2xl font-bold text-green-400 mt-1">${totalLeadCost}</p>
                            <p className="text-xs text-white/30">at $4 per lead</p>
                        </div>
                    </div>

                    {/* Providers List */}
                    <div className="grid gap-4">
                        {providers.length === 0 ? (
                            <div className="text-center py-12 bg-[#1e293b] border border-white/5 rounded-xl">
                                <UserPlus className="h-12 w-12 text-white/20 mx-auto mb-4" />
                                <p className="text-white/60">No providers yet</p>
                                <p className="text-white/40 text-sm mt-1">Create a provider to start tracking leads</p>
                            </div>
                        ) : (
                            providers.map((provider) => (
                                <div
                                    key={provider.id}
                                    className="bg-[#1e293b] border border-white/5 p-4 rounded-xl flex items-center justify-between group"
                                >
                                    <div className="flex items-center gap-4">
                                        <div className="h-10 w-10 rounded-full bg-green-500/20 flex items-center justify-center">
                                            <TrendingUp className="h-5 w-5 text-green-400" />
                                        </div>
                                        <div>
                                            <p className="text-white font-medium">{provider.email}</p>
                                            <div className="flex items-center gap-2 mt-1">
                                                <span className="text-[10px] uppercase font-bold px-2 py-0.5 rounded-full bg-green-500/10 text-green-400">
                                                    PROVIDER
                                                </span>
                                                {provider.agent && (
                                                    <div 
                                                        className="flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full text-white"
                                                        style={{ backgroundColor: provider.agent.color }}
                                                    >
                                                        <Gamepad2 className="h-3 w-3" />
                                                        {provider.agent.name}
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    </div>

                                    <div className="flex items-center gap-6">
                                        {/* Stats */}
                                        <div className="text-right hidden sm:block">
                                            <p className="text-lg font-bold text-white">{provider.stats.totalLeads}</p>
                                            <p className="text-xs text-white/40">leads</p>
                                        </div>
                                        <div className="text-right hidden sm:block">
                                            <p className="text-lg font-bold text-green-400">${provider.stats.totalCost}</p>
                                            <p className="text-xs text-white/40">cost</p>
                                        </div>

                                        {/* Actions */}
                                        <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                            <Link href={`/admin/provider-leads?providerId=${provider.id}`}>
                                                <Button size="sm" variant="outline" className="border-slate-600">
                                                    View Leads
                                                </Button>
                                            </Link>
                                            <Button
                                                size="icon"
                                                variant="destructive"
                                                onClick={() => handleDeleteProvider(provider.id)}
                                                disabled={!!isDeleting}
                                            >
                                                {isDeleting === provider.id ? (
                                                    <Loader2 className="h-4 w-4 animate-spin" />
                                                ) : (
                                                    <Trash2 className="h-4 w-4" />
                                                )}
                                            </Button>
                                        </div>
                                    </div>
                                </div>
                            ))
                        )}
                    </div>
                </TabsContent>
            </Tabs>
        </div>
    )
}
