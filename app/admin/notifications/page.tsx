'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Bell, Check, X, Clock, DollarSign, ArrowLeft, Loader2 } from 'lucide-react'
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
            // "Wait" just marks read (optional) and goes home/dashboard
            // Or maybe keep unread? User said "Wait (Check later)".
            // Let's just go back to dashboard.
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
                    description: action === 'confirm' ? "AI will thank the user." : "AI will deny receipt.",
                    variant: action === 'confirm' ? "default" : "destructive"
                })

                // Remove from list or mark as processed
                // Since this is "Payment Claim", once processed it's practically "Read"/Done.
                fetchNotifications() // Refresh to see updated state if we track status, or just filter out locally
                // Ideally API marks notification read.
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
        await fetch('/api/notifications', {
            method: 'PATCH',
            body: JSON.stringify({ markAllRead: true })
        })
        fetchNotifications()
    }

    return (
        <div className="min-h-screen bg-[#0f172a] pb-20">
            {/* Header */}
            <div className="sticky top-0 z-10 bg-[#0f172a]/80 backdrop-blur-xl border-b border-white/10 px-4 h-14 flex items-center justify-between">
                <div className="flex items-center gap-3">
                    <Button variant="ghost" size="icon" onClick={() => router.back()} className="text-white/60">
                        <ArrowLeft className="h-5 w-5" />
                    </Button>
                    <h1 className="text-lg font-bold text-white">Notifications</h1>
                </div>
                <Button variant="ghost" size="sm" onClick={markAllRead} className="text-xs text-blue-400">
                    Mark all read
                </Button>
            </div>

            {/* List */}
            <div className="p-4 space-y-4">
                {loading ? (
                    <div className="flex justify-center py-10">
                        <Loader2 className="h-8 w-8 text-white/20 animate-spin" />
                    </div>
                ) : notifications.length === 0 ? (
                    <div className="text-center py-10 text-white/30">
                        <Bell className="h-12 w-12 mx-auto mb-3 opacity-20" />
                        <p>No new notifications</p>
                    </div>
                ) : (
                    notifications.map(n => (
                        <div key={n.id} className={cn(
                            "rounded-2xl p-4 border transition-all",
                            n.isRead ? "bg-white/5 border-white/5 opacity-60" : "bg-white/10 border-white/10"
                        )}>
                            <div className="flex items-start gap-3 mb-3">
                                <div className={cn("h-10 w-10 rounded-full flex items-center justify-center shrink-0",
                                    n.type === 'PAYMENT_CLAIM' ? "bg-emerald-500/20 text-emerald-400" : "bg-blue-500/20 text-blue-400"
                                )}>
                                    {n.type === 'PAYMENT_CLAIM' ? <DollarSign className="h-5 w-5" /> : <Bell className="h-5 w-5" />}
                                </div>
                                <div className="flex-1">
                                    <h3 className="text-white font-medium text-sm">{n.title}</h3>
                                    <p className="text-white/60 text-xs mt-1 leading-relaxed">{n.message}</p>
                                    <span className="text-white/20 text-[10px] mt-2 block">
                                        {new Date(n.createdAt).toLocaleString()}
                                    </span>
                                </div>
                            </div>

                            {/* Actions for Payment Claims */}
                            {n.type === 'PAYMENT_CLAIM' && !n.isRead && (
                                <div className="grid grid-cols-3 gap-2 mt-2">
                                    <Button
                                        variant="default"
                                        className="bg-emerald-600 hover:bg-emerald-700 h-9"
                                        onClick={() => handleAction(n, 'confirm')}
                                        disabled={!!processingId}
                                    >
                                        {processingId === n.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4 mr-1" />}
                                        Yes
                                    </Button>

                                    <Button
                                        variant="destructive"
                                        className="h-9"
                                        onClick={() => handleAction(n, 'reject')}
                                        disabled={!!processingId}
                                    >
                                        <X className="h-4 w-4 mr-1" />
                                        No
                                    </Button>

                                    <Button
                                        variant="secondary"
                                        className="bg-white/10 hover:bg-white/20 text-white border border-white/10 h-9"
                                        onClick={() => handleAction(n, 'wait')}
                                        disabled={!!processingId}
                                    >
                                        <Clock className="h-4 w-4 mr-1" />
                                        Wait
                                    </Button>
                                </div>
                            )}
                        </div>
                    ))
                )}
            </div>
        </div>
    )
}
