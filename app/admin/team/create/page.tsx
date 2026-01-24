'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { ArrowLeft, Loader2, Check } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import Link from 'next/link'
import { useToast } from '@/components/ui/use-toast'
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select"

export default function CreateUserPage() {
    const router = useRouter()
    const { toast } = useToast()
    const [isLoading, setIsLoading] = useState(false)
    const [loadingAgents, setLoadingAgents] = useState(true)

    // Form State
    const [email, setEmail] = useState('')
    const [password, setPassword] = useState('')
    const [role, setRole] = useState('COLLABORATOR')
    const [selectedAgents, setSelectedAgents] = useState<number[]>([])

    // Data State
    const [agents, setAgents] = useState<any[]>([])

    useEffect(() => {
        // Fetch agents for selection
        fetch('/api/agents')
            .then(res => res.json())
            .then(data => setAgents(data))
            .finally(() => setLoadingAgents(false))
    }, [])

    const toggleAgent = (id: number) => {
        if (selectedAgents.includes(id)) {
            setSelectedAgents(selectedAgents.filter(aid => aid !== id))
        } else {
            setSelectedAgents([...selectedAgents, id])
        }
    }

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()
        setIsLoading(true)

        try {
            const res = await fetch('/api/admin/users', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    email,
                    password,
                    role,
                    agentIds: role === 'ADMIN' ? [] : selectedAgents
                })
            })

            if (!res.ok) {
                const err = await res.json()
                throw new Error(err.error || 'Failed to create user')
            }

            toast({ title: "Success", description: "User created successfully" })
            router.push('/admin/team')
        } catch (error: any) {
            toast({
                variant: "destructive",
                title: "Error",
                description: error.message
            })
            setIsLoading(false)
        }
    }

    return (
        <div className="max-w-2xl mx-auto space-y-8">
            <div className="flex items-center gap-4">
                <Link href="/admin/team">
                    <Button variant="ghost" size="icon" className="text-white/50 hover:text-white">
                        <ArrowLeft className="h-5 w-5" />
                    </Button>
                </Link>
                <div>
                    <h1 className="text-2xl font-bold text-white">Add Member</h1>
                    <p className="text-white/40">Create a new account for your team</p>
                </div>
            </div>

            <form onSubmit={handleSubmit} className="space-y-6">

                {/* Credentials */}
                <div className="bg-[#1e293b] p-6 rounded-xl border border-white/5 space-y-4">
                    <h3 className="text-white font-medium mb-4">Account Details</h3>

                    <div className="grid gap-2">
                        <Label className="text-white">Email Address</Label>
                        <Input
                            type="email"
                            required
                            className="bg-black/20 border-white/10 text-white"
                            value={email}
                            onChange={e => setEmail(e.target.value)}
                        />
                    </div>

                    <div className="grid gap-2">
                        <Label className="text-white">Password</Label>
                        <Input
                            type="password"
                            required
                            className="bg-black/20 border-white/10 text-white"
                            value={password}
                            onChange={e => setPassword(e.target.value)}
                        />
                    </div>

                    <div className="grid gap-2">
                        <Label className="text-white">Role</Label>
                        <Select value={role} onValueChange={setRole}>
                            <SelectTrigger className="bg-black/20 border-white/10 text-white">
                                <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="COLLABORATOR">Collaborator (Restricted)</SelectItem>
                                <SelectItem value="ADMIN">Administrator (Full Access)</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>
                </div>

                {/* Agent Access (Only for Collaborator) */}
                {role === 'COLLABORATOR' && (
                    <div className="bg-[#1e293b] p-6 rounded-xl border border-white/5 space-y-4">
                        <h3 className="text-white font-medium mb-4">Agent Access</h3>
                        <p className="text-white/40 text-sm mb-4">Select which agents this user can interact with.</p>

                        {loadingAgents ? (
                            <div className="flex justify-center p-4"><Loader2 className="h-6 w-6 animate-spin text-white/30" /></div>
                        ) : (
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                {agents.map(agent => {
                                    const isSelected = selectedAgents.includes(agent.id)
                                    return (
                                        <div
                                            key={agent.id}
                                            onClick={() => toggleAgent(agent.id)}
                                            className={`
                                                cursor-pointer p-3 rounded-lg border transition-all flex items-center gap-3
                                                ${isSelected
                                                    ? 'bg-blue-500/20 border-blue-500/50'
                                                    : 'bg-black/20 border-transparent hover:bg-white/5'}
                                            `}
                                        >
                                            <div
                                                className="h-8 w-8 rounded-full flex items-center justify-center text-xs font-bold text-white"
                                                style={{ backgroundColor: agent.color }}
                                            >
                                                {agent.name.substring(0, 1)}
                                            </div>
                                            <div className="flex-1">
                                                <p className={`font-medium ${isSelected ? 'text-white' : 'text-white/70'}`}>
                                                    {agent.name}
                                                </p>
                                                <p className="text-[10px] text-white/30">{agent.phone}</p>
                                            </div>
                                            {isSelected && <Check className="h-4 w-4 text-blue-400" />}
                                        </div>
                                    )
                                })}
                            </div>
                        )}
                        <p className="text-right text-xs text-white/30">{selectedAgents.length} agents selected</p>
                    </div>
                )}

                <div className="flex justify-end pt-4">
                    <Button
                        type="submit"
                        size="lg"
                        className="bg-white text-black hover:bg-white/90"
                        disabled={isLoading}
                    >
                        {isLoading && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                        Create User
                    </Button>
                </div>

            </form>
        </div>
    )
}
