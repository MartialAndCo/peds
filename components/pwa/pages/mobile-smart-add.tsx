'use client'

import { useState } from 'react'
import axios from 'axios'
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Loader2, Sparkles, Check, X } from 'lucide-react'

interface MobileSmartAddProps {
    open: boolean
    onOpenChange: (open: boolean) => void
    agentId: string
    onSuccess?: () => void
}

export function MobileSmartAdd({ open, onOpenChange, agentId, onSuccess }: MobileSmartAddProps) {
    const [phone, setPhone] = useState('')
    const [platform, setPlatform] = useState('')
    const [conversation, setConversation] = useState('')
    const [loading, setLoading] = useState(false)
    const [success, setSuccess] = useState(false)
    const [error, setError] = useState('')

    const handleSubmit = async () => {
        if (!phone || !platform || !conversation) {
            setError('Fill all fields')
            return
        }

        setLoading(true)
        setError('')

        try {
            await axios.post('/api/contacts/smart-add', {
                phone,
                platform,
                conversation,
                agentId
            })

            setSuccess(true)
            setTimeout(() => {
                handleClose()
                onSuccess?.()
            }, 1500)

        } catch (err: any) {
            setError(err.response?.data?.error || 'Failed')
        } finally {
            setLoading(false)
        }
    }

    const handleClose = () => {
        if (!loading) {
            onOpenChange(false)
            // Reset after animation
            setTimeout(() => {
                setPhone('')
                setPlatform('')
                setConversation('')
                setSuccess(false)
                setError('')
            }, 300)
        }
    }

    return (
        <Sheet open={open} onOpenChange={handleClose}>
            <SheetContent
                side="bottom"
                className="h-[90vh] rounded-t-[30px] border-white/10 bg-[#0f172a] p-0 overflow-hidden"
            >
                <div className="flex flex-col h-full">
                    {/* Drag Handle */}
                    <div className="w-12 h-1 rounded-full bg-white/10 mx-auto mt-3 mb-2" />

                    {/* Header */}
                    <div className="px-6 pb-4 border-b border-white/5 flex items-center justify-between">
                        <div className="flex items-center gap-2">
                            <Sparkles className="h-5 w-5 text-amber-400" />
                            <h2 className="text-xl font-bold text-white">Smart Add</h2>
                        </div>
                        <Button
                            variant="ghost"
                            size="icon"
                            onClick={handleClose}
                            disabled={loading}
                            className="h-8 w-8 rounded-full text-white/40"
                        >
                            <X className="h-4 w-4" />
                        </Button>
                    </div>

                    {success ? (
                        <div className="flex-1 flex flex-col items-center justify-center p-6">
                            <div className="w-20 h-20 rounded-full bg-green-500/20 flex items-center justify-center mb-4">
                                <Check className="h-10 w-10 text-green-400" />
                            </div>
                            <p className="text-white font-semibold text-lg">Contact Added!</p>
                            <p className="text-white/40 text-sm mt-1">AI extracted context successfully</p>
                        </div>
                    ) : (
                        <>
                            {/* Form */}
                            <div className="flex-1 overflow-y-auto p-6 space-y-5">
                                {/* Phone */}
                                <div className="space-y-2">
                                    <label className="text-xs font-bold uppercase tracking-widest text-white/30">Phone</label>
                                    <Input
                                        value={phone}
                                        onChange={(e) => setPhone(e.target.value)}
                                        placeholder="+33612345678"
                                        className="bg-white/5 border-white/10 rounded-xl text-white placeholder:text-white/20 h-12"
                                        disabled={loading}
                                    />
                                </div>

                                {/* Platform */}
                                <div className="space-y-2">
                                    <label className="text-xs font-bold uppercase tracking-widest text-white/30">Platform</label>
                                    <Input
                                        value={platform}
                                        onChange={(e) => setPlatform(e.target.value)}
                                        placeholder="Instagram, Telegram..."
                                        className="bg-white/5 border-white/10 rounded-xl text-white placeholder:text-white/20 h-12"
                                        disabled={loading}
                                    />
                                </div>

                                {/* Conversation */}
                                <div className="space-y-2">
                                    <label className="text-xs font-bold uppercase tracking-widest text-white/30">Conversation</label>
                                    <Textarea
                                        value={conversation}
                                        onChange={(e) => setConversation(e.target.value)}
                                        placeholder="Paste the chat here..."
                                        className="bg-white/5 border-white/10 rounded-xl text-white placeholder:text-white/20 min-h-[200px] text-sm"
                                        disabled={loading}
                                    />
                                </div>

                                {error && (
                                    <p className="text-red-400 text-sm text-center">{error}</p>
                                )}
                            </div>

                            {/* Submit Button (Sticky Bottom) */}
                            <div className="p-6 pt-0 pb-28">
                                <Button
                                    onClick={handleSubmit}
                                    disabled={loading || !phone || !platform || !conversation}
                                    className="w-full h-14 rounded-2xl bg-amber-500 hover:bg-amber-600 text-black font-semibold text-base disabled:opacity-40"
                                >
                                    {loading ? (
                                        <>
                                            <Loader2 className="h-5 w-5 mr-2 animate-spin" />
                                            Analyzing...
                                        </>
                                    ) : (
                                        <>
                                            <Sparkles className="h-5 w-5 mr-2" />
                                            Smart Add
                                        </>
                                    )}
                                </Button>
                            </div>
                        </>
                    )}
                </div>
            </SheetContent>
        </Sheet>
    )
}
