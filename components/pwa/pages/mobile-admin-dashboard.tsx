'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Bell, TrendingUp, Users, MessageSquare, Bot, ArrowRight, Activity, DollarSign, Plus, UserPlus } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts'
import {
    DialogHeader,
    DialogTitle,
    DialogTrigger,
    DialogFooter,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"

interface MobileAdminDashboardProps {
    stats: any
    agentsCount: number
}

import { NotificationManager } from '@/components/notification-manager'
import { useToast } from '@/components/ui/use-toast'

export function MobileAdminDashboard({ stats, agentsCount }: MobileAdminDashboardProps) {
    const router = useRouter()
    const { toast } = useToast()
    const [unreadCount, setUnreadCount] = useState(0)
    const [lastNotifId, setLastNotifId] = useState<string | null>(null)

    // Quick Add State
    const [isAddOpen, setIsAddOpen] = useState(false)
    const [isAdding, setIsAdding] = useState(false)
    const [newContact, setNewContact] = useState({ phone: '', context: '', name: '' })

    // Quick greeting based on time
    const hour = new Date().getHours()
    const greeting = hour < 12 ? 'Good morning' : hour < 18 ? 'Good afternoon' : 'Good evening'

    // Format daily activity for chart - with safety check
    const chartData = Array.isArray(stats?.dailyActivity)
        ? stats.dailyActivity.map((d: any) => ({
            name: d.date || '',
            messages: d.count || 0
        }))
        : []

    const fetchUnread = () => {
        fetch('/api/notifications?limit=1')
            .then(res => res.json())
            .then(data => {
                if (data.unreadCount !== undefined) setUnreadCount(data.unreadCount)

                // Toast logic for new notifications
                if (data.notifications && data.notifications.length > 0) {
                    const latest = data.notifications[0]
                    // If we have a previous ID, and this one is different and unread, show toast
                    if (lastNotifId && latest.id !== lastNotifId && !latest.isRead) {
                        toast({
                            title: latest.type === 'PAYMENT_CLAIM' ? "💰 New Payment Claim" : latest.title,
                            description: latest.message || "New activity detected",
                            variant: "default",
                        })
                    }
                    setLastNotifId(latest.id)
                }
            })
            .catch(console.error)
    }

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
                    source: "manual_dashboard_quick_add"
                })
            })

            if (!res.ok) throw new Error('Failed to create contact')

            toast({
                title: "Lead Added 🚀",
                description: "System is waiting for their first message to apply context.",
                className: "bg-emerald-500 border-none text-white"
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

    useEffect(() => {
        fetchUnread()
        const interval = setInterval(fetchUnread, 10000) // Poll every 10s
        return () => clearInterval(interval)
    }, [])

    return (
        <div className="min-h-screen pb-24 space-y-8 relative">
            <NotificationManager />

            {/* Header Section */}
            <div className="pt-2 px-5 pwa-safe-area-top-margin flex justify-between items-start">
                <div>
                    <h1 className="text-3xl font-bold text-white tracking-tight">{greeting},<br /><span className="text-blue-500">Admin</span></h1>
                    <p className="text-white/40 text-sm mt-1 font-medium">Here's what's happening today.</p>
                </div>
                <div className="relative">
                    <Button
                        variant="ghost"
                        size="icon"
                        className="rounded-full bg-white/5 hover:bg-white/10 text-white relative"
                        onClick={() => router.push('/admin/notifications')}
                    >
                        <Bell className="h-5 w-5" />
                        {unreadCount > 0 && (
                            <span className="absolute top-2 right-2 h-2 w-2 rounded-full bg-red-500 box-shadow-glow-red animate-pulse" />
                        )}
                    </Button>
                </div>
            </div>

            {/* Stats Carousel (Horizontal Scroll) */}
            <div className="w-full overflow-x-auto pwa-hide-scrollbar px-5 pb-2">
                <div className="flex gap-4 w-max">
                    {/* Revenue Card */}
                    <div className="w-40 h-40 glass rounded-3xl p-5 flex flex-col justify-between relative overflow-hidden group">
                        <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
                            <DollarSign className="h-16 w-16 text-emerald-400" />
                        </div>
                        <div className="h-10 w-10 rounded-full bg-emerald-500/20 flex items-center justify-center">
                            <TrendingUp className="h-5 w-5 text-emerald-400" />
                        </div>
                        <div>
                            <span className="text-white/40 text-xs font-bold uppercase tracking-wider block mb-1">Revenue</span>
                            <span className="text-2xl font-bold text-white">{stats.revenue.toFixed(0)}€</span>
                        </div>
                    </div>

                    {/* Active Chats Card */}
                    <div className="w-40 h-40 glass rounded-3xl p-5 flex flex-col justify-between relative overflow-hidden group">
                        <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
                            <MessageSquare className="h-16 w-16 text-blue-400" />
                        </div>
                        <div className="h-10 w-10 rounded-full bg-blue-500/20 flex items-center justify-center">
                            <Activity className="h-5 w-5 text-blue-400" />
                        </div>
                        <div>
                            <span className="text-white/40 text-xs font-bold uppercase tracking-wider block mb-1">Active</span>
                            <span className="text-2xl font-bold text-white">{stats.activeContacts}</span>
                        </div>
                    </div>

                    {/* Agents Card */}
                    <div className="w-40 h-40 glass rounded-3xl p-5 flex flex-col justify-between relative overflow-hidden group">
                        <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
                            <Bot className="h-16 w-16 text-purple-400" />
                        </div>
                        <div className="h-10 w-10 rounded-full bg-purple-500/20 flex items-center justify-center">
                            <Bot className="h-5 w-5 text-purple-400" />
                        </div>
                        <div>
                            <span className="text-white/40 text-xs font-bold uppercase tracking-wider block mb-1">Agents</span>
                            <span className="text-2xl font-bold text-white">{agentsCount}</span>
                        </div>
                    </div>

                    {/* Total Users Card - REMOVED as per request */}

                </div>
            </div>

            {/* Quick Access Grid (5 items) */}
            <div className="px-5">
                <h3 className="text-white/40 font-bold uppercase text-xs tracking-widest mb-4 px-1">Menu</h3>
                <div className="grid grid-cols-2 gap-3">
                    {/* 1. Overview (Home) */}
                    <div onClick={() => window.location.reload()} className="glass rounded-2xl p-4 flex flex-col items-center justify-center gap-2 bg-white/5 border-white/20 transition-colors cursor-pointer text-center relative overflow-hidden">
                        <div className="absolute inset-0 bg-blue-500/10 opacity-50" />
                        <TrendingUp className="h-6 w-6 text-blue-400 relative z-10" />
                        <span className="text-white text-sm font-bold relative z-10">Overview</span>
                    </div>

                    {/* 2. Agents */}
                    <div onClick={() => router.push('/admin/agents')} className="glass rounded-2xl p-4 flex flex-col items-center justify-center gap-2 active:bg-white/5 transition-colors cursor-pointer text-center">
                        <Bot className="h-6 w-6 text-indigo-400" />
                        <span className="text-white text-sm font-medium">Agents</span>
                    </div>

                    {/* 3. Payments */}
                    <div onClick={() => router.push('/admin/payments')} className="glass rounded-2xl p-4 flex flex-col items-center justify-center gap-2 active:bg-white/5 transition-colors cursor-pointer text-center">
                        <DollarSign className="h-6 w-6 text-emerald-400" />
                        <span className="text-white text-sm font-medium">Payments</span>
                    </div>

                    {/* 4. Logs (System/Chats) */}
                    <div onClick={() => router.push('/admin/conversations')} className="glass rounded-2xl p-4 flex flex-col items-center justify-center gap-2 active:bg-white/5 transition-colors cursor-pointer text-center">
                        <Activity className="h-6 w-6 text-purple-400" />
                        <span className="text-white text-sm font-medium">Logs</span>
                    </div>

                    {/* 5. Settings */}
                    <div onClick={() => router.push('/admin/settings')} className="glass rounded-2xl p-4 flex flex-col items-center justify-center gap-2 active:bg-white/5 transition-colors cursor-pointer text-center col-span-2">
                        <Activity className="h-6 w-6 text-white/60" />
                        <span className="text-white text-sm font-medium">Settings</span>
                    </div>
                </div>
            </div>
        </div>
    )
}
