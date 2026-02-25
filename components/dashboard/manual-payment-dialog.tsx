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
import { Plus, Search, Loader2 } from "lucide-react"
import { createManualPayment, searchContacts } from "@/app/actions/payments"
import { useToast } from "@/components/ui/use-toast"
import { Switch } from "@/components/ui/switch"
import { getContactDisplayName } from "@/lib/contact-display"

export function ManualPaymentDialog({ agentId }: { agentId: string }) {
    const [open, setOpen] = useState(false)
    const [loading, setLoading] = useState(false)
    const { toast } = useToast()

    // Form State
    const [isNewContact, setIsNewContact] = useState(false)
    const [amount, setAmount] = useState("")
    const [method, setMethod] = useState("Cash")
    const [note, setNote] = useState("")

    // Contact Selection
    const [selectedContact, setSelectedContact] = useState<{ id: string, name: string } | null>(null)
    const [searchTerm, setSearchTerm] = useState("")
    const [searchResults, setSearchResults] = useState<any[]>([])

    // New Contact
    const [newName, setNewName] = useState("")
    const [newPhone, setNewPhone] = useState("")

    const handleSearch = async (term: string) => {
        setSearchTerm(term)
        if (term.length >= 2) {
            const results = await searchContacts(term)
            setSearchResults(results)
        } else {
            setSearchResults([])
        }
    }

    const selectResult = (c: any) => {
        setSelectedContact(c)
        setSearchTerm(c.name || c.phone_whatsapp)
        setSearchResults([])
    }

    const handleSubmit = async () => {
        if (!amount) return toast({ title: "Error", description: "Amount required", variant: "destructive" })
        if (!isNewContact && !selectedContact) return toast({ title: "Error", description: "Select a contact", variant: "destructive" })
        if (isNewContact && (!newName || !newPhone)) return toast({ title: "Error", description: "Name/Phone required", variant: "destructive" })

        setLoading(true)
        try {
            const res = await createManualPayment({
                agentId,
                amount: parseFloat(amount),
                method,
                note,
                isNewContact,
                contactId: selectedContact?.id,
                contactName: isNewContact ? newName : selectedContact?.name,
                contactPhone: isNewContact ? newPhone : undefined
            })

            if (res.success) {
                toast({ title: "Success", description: "Payment recorded" })
                setOpen(false)
                // Reset
                setAmount("")
                setNote("")
                setSelectedContact(null)
                setNewName("")
            } else {
                toast({ title: "Error", description: res.error, variant: "destructive" })
            }
        } catch (e) {
            toast({ title: "Error", description: "Failed to create", variant: "destructive" })
        } finally {
            setLoading(false)
        }
    }

    return (
        <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
                <Button className="bg-emerald-500 hover:bg-emerald-600 text-white font-bold text-xs uppercase tracking-widest">
                    <Plus className="w-4 h-4 mr-2" /> Add Manual
                </Button>
            </DialogTrigger>
            <DialogContent className="bg-slate-900 border-white/10 text-white">
                <DialogHeader>
                    <DialogTitle>Record Manual Payment</DialogTitle>
                </DialogHeader>

                <div className="space-y-4 py-4">
                    {/* Contact Selection Mode */}
                    <div className="flex items-center justify-between bg-white/5 p-3 rounded-lg">
                        <Label>Create New Contact?</Label>
                        <Switch checked={isNewContact} onCheckedChange={setIsNewContact} />
                    </div>

                    {!isNewContact ? (
                        <div className="space-y-2 relative">
                            <Label>Existing Contact</Label>
                            <div className="relative">
                                <Search className="absolute left-3 top-2.5 h-4 w-4 text-white/40" />
                                <Input
                                    placeholder="Search name or phone..."
                                    value={searchTerm}
                                    onChange={e => handleSearch(e.target.value)}
                                    className="pl-9 bg-black/20 border-white/10"
                                />
                            </div>
                            {searchResults.length > 0 && (
                                <div className="absolute z-10 w-full bg-slate-800 border border-white/10 rounded-lg mt-1 overflow-hidden shadow-xl max-h-40 overflow-y-auto">
                                    {searchResults.map(c => {
                                        const displayName = getContactDisplayName(c, "Unknown")
                                        return (
                                        <div
                                            key={c.id}
                                            onClick={() => selectResult(c)}
                                            className="p-3 hover:bg-white/5 cursor-pointer text-sm"
                                        >
                                            <div className="font-bold text-white">{displayName}</div>
                                            <div className="text-white/50 text-xs">{c.phone_whatsapp}</div>
                                        </div>
                                        )
                                    })}
                                </div>
                            )}
                        </div>
                    ) : (
                        <div className="grid grid-cols-2 gap-4 animate-in fade-in slide-in-from-top-2">
                            <div className="space-y-2">
                                <Label>Name</Label>
                                <Input
                                    value={newName}
                                    onChange={e => setNewName(e.target.value)}
                                    className="bg-black/20 border-white/10"
                                    placeholder="Jean Dupont"
                                />
                            </div>
                            <div className="space-y-2">
                                <Label>Phone</Label>
                                <Input
                                    value={newPhone}
                                    onChange={e => setNewPhone(e.target.value)}
                                    className="bg-black/20 border-white/10"
                                    placeholder="+336..."
                                />
                            </div>
                        </div>
                    )}

                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <Label>Amount (€)</Label>
                            <Input
                                type="number"
                                value={amount}
                                onChange={e => setAmount(e.target.value)}
                                className="bg-black/20 border-white/10 font-mono text-lg text-emerald-400"
                                placeholder="0.00"
                            />
                        </div>
                        <div className="space-y-2">
                            <Label>Method</Label>
                            <Input
                                value={method}
                                onChange={e => setMethod(e.target.value)}
                                className="bg-black/20 border-white/10"
                                placeholder="Cash, Wire..."
                            />
                        </div>
                    </div>

                    <div className="space-y-2">
                        <Label>Internal Note</Label>
                        <Input
                            value={note}
                            onChange={e => setNote(e.target.value)}
                            className="bg-black/20 border-white/10"
                            placeholder="Optional context..."
                        />
                    </div>

                    <Button
                        onClick={handleSubmit}
                        disabled={loading}
                        className="w-full bg-emerald-500 hover:bg-emerald-600 text-white font-bold"
                    >
                        {loading && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                        Confirm Payment
                    </Button>
                </div>
            </DialogContent>
        </Dialog>
    )
}
