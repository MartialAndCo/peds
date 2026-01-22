'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Bell, Check, X, Clock, DollarSign, ArrowLeft, Loader2, RefreshCw } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'
import { useToast } from "@/components/ui/use-toast"

interface Notification {
    id: string
    title: string
    message: string
    type: string
    entityId: string
    metadata: any
    isRead: boolean
    createdAt: string
}

export default function NotificationsPage() {
    const router = useRouter()
    const { toast } = useToast()
    const [notifications, setNotifications] = useState<Notification[]>([])
    const [loading, setLoading] = useState(true)
    const [processingId, setProcessingId] = useState<string | null>(null)

    useEffect(() => {
        fetchNotifications()
    }, [])

    const fetchNotifications = async () => {
        try {
            const res = await fetch('/api/notifications?limit=50')
            const data = await res.json()
            if (data.notifications) {
                setNotifications(data.notifications)
            }
        } catch (error) {
            console.error('Failed to fetch notifications', error)
        } finally {
            setLoading(false)
        }
    }

    const handleAction = async (notification: Notification, action: 'confirm' | 'reject' | 'wait') => {
        if (action === 'wait') {
            router.push('/admin')
            return
        }

        setProcessingId(notification.id)
        try {
            const res = await fetch(`/api/claims/${notification.entityId}/action`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ action })
            })

            const result = await res.json()

            if (res.ok && result.success) {
                toast({
                    title: action === 'confirm' ? "Payment Confirmed" : "Payment Rejected",
                    description: action === 'confirm' ? "AI has been notified to thank the user." : "AI will tell user money was not received.",
                    variant: action === 'confirm' ? "default" : "destructive"
                })

                fetchNotifications()
                setNotifications(prev => prev.map(n => n.id === notification.id ? { ...n, isRead: true } : n))
            } else {
                throw new Error(result.error || 'Failed')
            }
        } catch (error) {
            toast({
                title: "Error",
                description: "Failed to process action. Try again.",
                variant: "destructive"
            })
        } finally {
            setProcessingId(null)
        }
    }

    const markAllRead = async () => {
        await fetch('/api/notifications', { method: 'PATCH', body: JSON.stringify({ markAllRead: true }) })
        fetchNotifications()
    }

    return (
        <div className="min-h-screen bg-[#0f172a] pb-20">
            {/* Header */}
            <div className="sticky top-0 z-10 bg-[#0f172a]/95 backdrop-blur-xl border-b border-white/10 px-4 h-16 flex items-center justify-between">
                <div className="flex items-center gap-3">
                    <Button variant="ghost" size="icon" onClick={() => router.back()} className="text-white/60 hover:text-white hover:bg-white/10 -ml-2">
                        <ArrowLeft className="h-6 w-6" />
                    </Button>
                    <h1 className="text-xl font-bold text-white tracking-tight">Notification Center</h1>
                </div>
                <Button variant="ghost" size="icon" onClick={fetchNotifications} className="text-white/40 hover:text-white">
                    <RefreshCw className="h-5 w-5" />
                </Button>
            </div>

            {/* List */}
            <div className="p-4 space-y-4 max-w-2xl mx-auto">
                {loading ? (
                    <div className="flex justify-center py-20">
                        <Loader2 className="h-8 w-8 text-white/20 animate-spin" />
                    </div>
                ) : notifications.length === 0 ? (
                    <div className="text-center py-20 text-white/30 flex flex-col items-center">
                        <div className="h-16 w-16 bg-white/5 rounded-full flex items-center justify-center mb-4">
                            <Bell className="h-8 w-8 opacity-40" />
                        </div>
                        <p className="font-medium">All caught up!</p>
                        <p className="text-sm opacity-60 mt-1">No new alerts.</p>
                    </div>
                ) : (
                    notifications.map(n => {
                        const isPayment = n.type === 'PAYMENT_CLAIM';
                        // Construct better message for Payment
                        // Metadata: amount, method, contactName
                        const amount = n.metadata?.amount || '?'
                        const method = n.metadata?.method || 'unknown method'
                        const sender = n.metadata?.contactName || 'Someone'

                        // Clean up "AI_DETECTED" if present
                        const cleanMethod = method === 'AI_DETECTED' ? 'AI' : method;

                        return (
                            <div key={n.id} className={cn(
                                "rounded-3xl p-5 border transition-all relative overflow-hidden group",
                                n.isRead ? "bg-white/5 border-white/5 opacity-60" : "bg-[#1e293b] border-white/10 shadow-lg shadow-black/20"
                            )}>
                                {!n.isRead && <div className="absolute top-4 right-4 h-2 w-2 rounded-full bg-blue-500 shadow-[0_0_10px_rgba(59,130,246,0.5)]" />}

                                <div className="flex items-start gap-4">
                                    <div className={cn(
                                        "h-12 w-12 rounded-2xl flex items-center justify-center shrink-0 shadow-inner",
                                        isPayment ? "bg-emerald-500/10 text-emerald-400" : "bg-blue-500/10 text-blue-400"
                                    )}>
                                        {isPayment ? <DollarSign className="h-6 w-6" /> : <Bell className="h-6 w-6" />}
                                    </div>

                                    <div className="flex-1 space-y-1">
                                        <div className="flex justify-between items-start pr-4">
                                            <h3 className="text-white font-bold text-base tracking-tight">
                                                {isPayment ? "Payment Claim" : n.title}
                                            </h3>
                                        </div>

                                        {isPayment ? (
                                            <div className="text-white/80 text-sm leading-relaxed">
                                                <span className="font-semibold text-white">{sender}</span> claims to have sent <span className="font-bold text-emerald-400">{amount === '?' ? 'money' : amount}</span>
                                                {cleanMethod && cleanMethod !== 'unknown method' && cleanMethod !== 'AI' && (
                                                    <> via <Badge variant="outline" className="text-[10px] h-5 px-1.5 border-white/10 text-white/60">{cleanMethod}</Badge></>
                                                )}
                                                .
                                            </div>
                                        ) : (
                                            <p className="text-white/60 text-sm">{n.message}</p>
                                        )}

                                        <p className="text-white/20 text-xs font-mono pt-1">
                                            {new Date(n.createdAt).toLocaleString()}
                                        </p>
                                    </div>
                                </div>

                                {/* Actions for Payment Claims */}
                                {isPayment && !n.isRead && (
                                    <div className="mt-5 grid grid-cols-2 gap-3">
                                        <Button
                                            className="bg-emerald-600 hover:bg-emerald-500 text-white font-semibold h-11 rounded-xl shadow-lg shadow-emerald-900/20 active:scale-[0.98] transition-all"
                                            onClick={() => handleAction(n, 'confirm')}
                                            disabled={!!processingId}
                                        >
                                            {processingId === n.id ? <Loader2 className="h-5 w-5 animate-spin" /> : <Check className="h-5 w-5 mr-2" />}
                                            Confirm Receipt
                                        </Button>

                                        <div className="grid grid-cols-2 gap-2">
                                            <Button
                                                variant="outline"
                                                className="bg-red-500/10 hover:bg-red-500/20 text-red-400 border-red-500/20 h-11 rounded-xl"
                                                onClick={() => handleAction(n, 'reject')}
                                                disabled={!!processingId}
                                            >
                                                <X className="h-5 w-5 mr-1" />
                                                No
                                            </Button>

                                            <Button
                                                variant="ghost"
                                                className="text-white/40 hover:text-white hover:bg-white/5 h-11 rounded-xl"
                                                onClick={() => handleAction(n, 'wait')}
                                                disabled={!!processingId}
                                            >
                                                Wait
                                            </Button>
                                        </div>
                                    </div>
                                )}
                            </div>
                        )
                    })
                )}
            </div>

            {!loading && notifications.length > 0 && (
                <div className="fixed bottom-6 left-0 right-0 flex justify-center pointer-events-none">
                    <Button
                        variant="secondary"
                        size="sm"
                        onClick={markAllRead}
                        className="pointer-events-auto shadow-xl bg-[#1e293b] border border-white/10 text-white/60 hover:text-white rounded-full px-6"
                    >
                        Mark all as read
                    </Button>
                </div>
            )}
        </div>
    )
}
