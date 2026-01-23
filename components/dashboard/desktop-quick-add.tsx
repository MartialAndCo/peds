'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Plus } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useToast } from '@/components/ui/use-toast'
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
    DialogFooter,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"

export function DesktopQuickAdd() {
    const router = useRouter()
    const { toast } = useToast()

    // Quick Add State
    const [isAddOpen, setIsAddOpen] = useState(false)
    const [isAdding, setIsAdding] = useState(false)
    const [newContact, setNewContact] = useState({ phone: '', context: '', name: '' })

    const handleQuickAdd = async () => {
        if (!newContact.phone) {
            toast({ title: "Error", description: "Phone number is required", variant: "destructive" })
            return
        }

        setIsAdding(true)
        try {
            const res = await fetch('/api/contacts', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    phone_whatsapp: newContact.phone,
                    name: newContact.name || "New Lead",
                    context: newContact.context,
                    source: "desktop_dashboard_quick_add"
                })
            })

            if (!res.ok) throw new Error('Failed to create contact')

            toast({
                title: "Lead Added 🚀",
                description: "System is waiting for their first message to apply context.",
                className: "bg-emerald-500 border-none text-white",
            })
            setIsAddOpen(false)
            setNewContact({ phone: '', context: '', name: '' })
            router.refresh()
        } catch (error) {
            console.error(error)
            toast({ title: "Error", description: "Failed to add contact", variant: "destructive" })
        } finally {
            setIsAdding(false)
        }
    }

    return (
        <Dialog open={isAddOpen} onOpenChange={setIsAddOpen}>
            <DialogTrigger asChild>
                <Button className="bg-blue-600 hover:bg-blue-500 text-white gap-2">
                    <Plus className="h-4 w-4" />
                    Add Lead
                </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[425px] bg-[#0f172a] border-white/10 text-white">
                <DialogHeader>
                    <DialogTitle>Add New Lead</DialogTitle>
                    <DialogDescription className="text-white/50">
                        Add a number and context. The AI will apply this context upon the first message.
                    </DialogDescription>
                </DialogHeader>
                <div className="grid gap-4 py-4">
                    <div className="space-y-2">
                        <Label>Phone Number</Label>
                        <Input
                            placeholder="+33 6 12 34 56 78"
                            className="bg-white/5 border-white/10 text-white placeholder:text-white/20"
                            value={newContact.phone}
                            onChange={(e) => setNewContact({ ...newContact, phone: e.target.value })}
                        />
                    </div>
                    <div className="space-y-2">
                        <Label>Name (Optional)</Label>
                        <Input
                            placeholder="John Doe"
                            className="bg-white/5 border-white/10 text-white placeholder:text-white/20"
                            value={newContact.name}
                            onChange={(e) => setNewContact({ ...newContact, name: e.target.value })}
                        />
                    </div>
                    <div className="space-y-2">
                        <Label>Context / Lead Info</Label>
                        <Textarea
                            placeholder="e.g. Met on Tinder, 24yo, likes travel..."
                            className="bg-white/5 border-white/10 text-white placeholder:text-white/20 min-h-[100px]"
                            value={newContact.context}
                            onChange={(e) => setNewContact({ ...newContact, context: e.target.value })}
                        />
                    </div>
                </div>
                <DialogFooter>
                    <Button
                        className="bg-blue-600 hover:bg-blue-500 text-white w-full sm:w-auto"
                        onClick={handleQuickAdd}
                        disabled={isAdding}
                    >
                        {isAdding ? "Adding..." : "Add Lead & Wait"}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    )
}
