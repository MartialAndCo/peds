'use client'

import { useState } from 'react'
import axios from 'axios'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Loader2, Sparkles, Check } from 'lucide-react'

interface SmartAddDialogProps {
    open: boolean
    onOpenChange: (open: boolean) => void
    agentId: string
    onSuccess?: () => void
}

export function SmartAddDialog({ open, onOpenChange, agentId, onSuccess }: SmartAddDialogProps) {
    const [phone, setPhone] = useState('')
    const [platform, setPlatform] = useState('')
    const [conversation, setConversation] = useState('')
    const [loading, setLoading] = useState(false)
    const [result, setResult] = useState<{ success: boolean, context?: string } | null>(null)
    const [error, setError] = useState('')

    const handleSubmit = async () => {
        if (!phone || !platform || !conversation) {
            setError('All fields are required')
            return
        }

        setLoading(true)
        setError('')
        setResult(null)

        try {
            const res = await axios.post('/api/contacts/smart-add', {
                phone,
                platform,
                conversation,
                agentId
            })

            setResult({
                success: true,
                context: res.data.generatedContext
            })

            // Auto-close after success
            setTimeout(() => {
                onOpenChange(false)
                onSuccess?.()
                // Reset state
                setPhone('')
                setPlatform('')
                setConversation('')
                setResult(null)
            }, 2000)

        } catch (err: any) {
            setError(err.response?.data?.error || err.message || 'Failed to add contact')
        } finally {
            setLoading(false)
        }
    }

    const handleClose = () => {
        if (!loading) {
            onOpenChange(false)
            setPhone('')
            setPlatform('')
            setConversation('')
            setResult(null)
            setError('')
        }
    }

    return (
        <Dialog open={open} onOpenChange={handleClose}>
            <DialogContent className="bg-[#1e293b] border-white/[0.08] max-w-2xl">
                <DialogHeader>
                    <DialogTitle className="text-white flex items-center gap-2">
                        <Sparkles className="h-5 w-5 text-amber-400" />
                        Smart Add
                    </DialogTitle>
                </DialogHeader>

                {result?.success ? (
                    <div className="py-8 text-center">
                        <div className="w-16 h-16 rounded-full bg-green-500/20 flex items-center justify-center mx-auto mb-4">
                            <Check className="h-8 w-8 text-green-400" />
                        </div>
                        <p className="text-white font-medium mb-2">Contact Added!</p>
                        <p className="text-white/40 text-sm max-w-md mx-auto">
                            {result.context?.substring(0, 150)}...
                        </p>
                    </div>
                ) : (
                    <>
                        <div className="space-y-4 py-4">
                            {/* Phone */}
                            <div className="space-y-2">
                                <label className="text-white/60 text-sm">Phone Number</label>
                                <Input
                                    value={phone}
                                    onChange={(e) => setPhone(e.target.value)}
                                    placeholder="+33612345678"
                                    className="bg-white/[0.04] border-white/[0.08] text-white placeholder:text-white/30"
                                    disabled={loading}
                                />
                            </div>

                            {/* Platform */}
                            <div className="space-y-2">
                                <label className="text-white/60 text-sm">Platform (where you talked)</label>
                                <Input
                                    value={platform}
                                    onChange={(e) => setPlatform(e.target.value)}
                                    placeholder="Instagram, Telegram, TikTok..."
                                    className="bg-white/[0.04] border-white/[0.08] text-white placeholder:text-white/30"
                                    disabled={loading}
                                />
                            </div>

                            {/* Conversation */}
                            <div className="space-y-2">
                                <label className="text-white/60 text-sm">Paste Conversation</label>
                                <Textarea
                                    value={conversation}
                                    onChange={(e) => setConversation(e.target.value)}
                                    placeholder="Paste the raw conversation text here..."
                                    className="bg-white/[0.04] border-white/[0.08] text-white placeholder:text-white/30 min-h-[200px] font-mono text-sm"
                                    disabled={loading}
                                />
                            </div>

                            {error && (
                                <p className="text-red-400 text-sm">{error}</p>
                            )}
                        </div>

                        <DialogFooter>
                            <Button
                                variant="ghost"
                                onClick={handleClose}
                                disabled={loading}
                                className="text-white/60"
                            >
                                Cancel
                            </Button>
                            <Button
                                onClick={handleSubmit}
                                disabled={loading || !phone || !platform || !conversation}
                                className="bg-amber-500 hover:bg-amber-600 text-black"
                            >
                                {loading ? (
                                    <>
                                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                                        Analyzing...
                                    </>
                                ) : (
                                    <>
                                        <Sparkles className="h-4 w-4 mr-2" />
                                        Smart Add
                                    </>
                                )}
                            </Button>
                        </DialogFooter>
                    </>
                )}
            </DialogContent>
        </Dialog>
    )
}
