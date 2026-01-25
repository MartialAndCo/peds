'use client'

import { useState, useEffect } from 'react'
import { Plus, Trash2, Shield, Users, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useToast } from '@/components/ui/use-toast'
import { EditUserDialog } from '@/components/dashboard/edit-user-dialog'

interface User {
    id: string
    email: string
    role: string
    agents: { id: number, name: string, color: string }[]
    createdAt: string
}

export default function TeamPage() {
    const router = useRouter()
    const { toast } = useToast()
    const [users, setUsers] = useState<User[]>([])
    const [isLoading, setIsLoading] = useState(true)
    const [isDeleting, setIsDeleting] = useState<string | null>(null)
    const [allAgents, setAllAgents] = useState<any[]>([])

    useEffect(() => {
        fetchData()
    }, [])

    async function fetchData() {
        try {
            const [usersRes, agentsRes] = await Promise.all([
                fetch('/api/admin/users'),
                fetch('/api/agents')
            ])

            if (!usersRes.ok) throw new Error('Failed to fetch users')
            const usersData = await usersRes.json()
            setUsers(usersData)

            if (agentsRes.ok) {
                const agentsData = await agentsRes.json()
                setAllAgents(agentsData)
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

    async function handleDelete(id: string) {
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

    if (isLoading) {
        return <div className="p-8 flex justify-center"><Loader2 className="h-8 w-8 animate-spin text-white/50" /></div>
    }

    return (
        <div className="space-y-6 max-w-7xl mx-auto">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-bold text-white">Team Management</h1>
                    <p className="text-white/40">Manage administrators and collaborators</p>
                </div>
                <Link href="/admin/team/create">
                    <Button className="bg-white text-black hover:bg-white/90">
                        <Plus className="h-4 w-4 mr-2" />
                        Add Member
                    </Button>
                </Link>
            </div>

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
                                        onClick={() => handleDelete(user.id)}
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
        </div>
    )
}
