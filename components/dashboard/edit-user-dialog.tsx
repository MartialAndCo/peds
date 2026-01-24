"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Shield, Loader2, Save } from "lucide-react"
import { useToast } from "@/components/ui/use-toast"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Checkbox } from "@/components/ui/checkbox"

interface Agent {
    id: number
    name: string
    color: string
}

interface User {
    id: string
    email: string
    role: string
    agents: { id: number, name: string, color: string }[]
}

export function EditUserDialog({ user, allAgents, onUpdate }: { user: User, allAgents: Agent[], onUpdate: () => void }) {
    const [open, setOpen] = useState(false)
    const [loading, setLoading] = useState(false)
    const { toast } = useToast()

    const [email, setEmail] = useState(user.email)
    const [role, setRole] = useState(user.role)
    const [password, setPassword] = useState("") // Optional, only if changing
    const [selectedAgents, setSelectedAgents] = useState<string[]>(user.agents.map(a => a.id.toString()))

    const handleAgentToggle = (agentId: string) => {
        setSelectedAgents(prev =>
            prev.includes(agentId)
                ? prev.filter(id => id !== agentId)
                : [...prev, agentId]
        )
    }

    const handleSubmit = async () => {
        setLoading(true)
        try {
            const res = await fetch('/api/admin/users', {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    id: user.id,
                    email,
                    role,
                    password: password || undefined, // Send undefined if empty to avoid accidental reset
                    agentIds: selectedAgents
                })
            })

            const data = await res.json()
            if (!res.ok) throw new Error(data.error || 'Failed to update')

            toast({ title: "Success", description: "User updated successfully" })
            setOpen(false)
            onUpdate()
        } catch (e: any) {
            toast({ title: "Error", description: e.message, variant: "destructive" })
        } finally {
            setLoading(false)
        }
    }

    return (
        <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
                <Button
                    size="icon"
                    variant="ghost"
                    className="hover:bg-blue-500/20 hover:text-blue-400 text-white/40"
                    title="Edit User"
                >
                    <Shield className="h-4 w-4" />
                </Button>
            </DialogTrigger>
            <DialogContent className="bg-slate-900 border-white/10 text-white">
                <DialogHeader>
                    <DialogTitle>Edit Team Member</DialogTitle>
                </DialogHeader>

                <div className="space-y-4 py-4">
                    <div className="space-y-2">
                        <Label>Email</Label>
                        <Input
                            value={email}
                            onChange={e => setEmail(e.target.value)}
                            className="bg-black/20 border-white/10"
                        />
                    </div>

                    <div className="space-y-2">
                        <Label>Role</Label>
                        <Select value={role} onValueChange={setRole}>
                            <SelectTrigger className="bg-black/20 border-white/10">
                                <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="ADMIN">Admin</SelectItem>
                                <SelectItem value="COLLABORATOR">Collaborator</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>

                    <div className="space-y-2">
                        <Label>Password (Leave empty to keep current)</Label>
                        <Input
                            type="password"
                            value={password}
                            onChange={e => setPassword(e.target.value)}
                            className="bg-black/20 border-white/10"
                            placeholder="••••••••"
                        />
                    </div>

                    <div className="space-y-3 pt-2">
                        <Label>Agent Access</Label>
                        <div className="grid grid-cols-2 gap-2">
                            {allAgents.map(agent => (
                                <div key={agent.id} className="flex items-center space-x-2 bg-white/5 p-2 rounded hover:bg-white/10 transition-colors">
                                    <Checkbox
                                        id={`agent-${agent.id}`}
                                        checked={selectedAgents.includes(agent.id.toString())}
                                        onCheckedChange={() => handleAgentToggle(agent.id.toString())}
                                        className="border-white/20 data-[state=checked]:bg-blue-500"
                                    />
                                    <label
                                        htmlFor={`agent-${agent.id}`}
                                        className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 cursor-pointer flex items-center gap-2"
                                    >
                                        <div className="w-2 h-2 rounded-full" style={{ backgroundColor: agent.color }} />
                                        {agent.name}
                                    </label>
                                </div>
                            ))}
                        </div>
                    </div>

                    <Button
                        onClick={handleSubmit}
                        disabled={loading}
                        className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold"
                    >
                        {loading && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                        Save Changes
                    </Button>
                </div>
            </DialogContent>
        </Dialog>
    )
}
