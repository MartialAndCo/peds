'use client'

import { useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'
import { BellRing } from 'lucide-react'
import { toast } from '@/components/ui/use-toast'

// Helper to sanitize base64 string for VAPID
function urlBase64ToUint8Array(base64String: string) {
    const padding = '='.repeat((4 - base64String.length % 4) % 4)
    const base64 = (base64String + padding)
        .replace(/\-/g, '+')
        .replace(/_/g, '/')

    const rawData = window.atob(base64)
    const outputArray = new Uint8Array(rawData.length)

    for (let i = 0; i < rawData.length; ++i) {
        outputArray[i] = rawData.charCodeAt(i)
    }
    return outputArray
}

export function NotificationManager() {
    const [isSubscribed, setIsSubscribed] = useState(false)
    const [isSupported, setIsSupported] = useState(false)
    const [isLoading, setIsLoading] = useState(true)

    useEffect(() => {
        if ('serviceWorker' in navigator && 'PushManager' in window) {
            setIsSupported(true)
            checkSubscription()
        } else {
            setIsLoading(false)
        }
    }, [])

    const checkSubscription = async () => {
        try {
            // Explicitly register service worker if not ready
            if ('serviceWorker' in navigator) {
                try {
                    await navigator.serviceWorker.register('/sw.js')
                } catch (err) {
                    console.error('SW registration failed', err)
                }
            }

            const registration = await navigator.serviceWorker.ready
            const subscription = await registration.pushManager.getSubscription()

            if (subscription) {
                setIsSubscribed(true)
            } else if (Notification.permission === 'granted') {
                console.log('Permission granted but no subscription found. Attempting to subscribe...')
                await subscribeToPush()
            }
        } catch (error) {
            console.error('Error checking subscription:', error)
        } finally {
            setIsLoading(false)
        }
    }

    const subscribeToPush = async () => {
        try {
            setIsLoading(true)
            console.log('Requesting notification permission...')
            const permission = await Notification.requestPermission()
            if (permission !== 'granted') {
                toast({ title: "Permission Denied", description: "You need to allow notifications in browser settings.", variant: "destructive" })
                return
            }

            console.log('Waiting for Service Worker...')
            const registration = await navigator.serviceWorker.ready

            const vapidKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY

            if (!vapidKey) {
                throw new Error('Missing VAPID key')
            }

            console.log('Subscribing to PushManager...')
            const subscription = await registration.pushManager.subscribe({
                userVisibleOnly: true,
                applicationServerKey: urlBase64ToUint8Array(vapidKey)
            })

            // Send to server
            await fetch('/api/notifications/subscribe', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(subscription)
            })

            setIsSubscribed(true)
            toast({ title: "Notifications Enabled", description: "You will receive alerts on this device." })

        } catch (error: any) {
            console.error('Subscription failed', error)
            toast({ title: "Error", description: error.message || "Failed to enable notifications.", variant: "destructive" })
        } finally {
            setIsLoading(false)
        }
    }

    if (!isSupported || isSubscribed || isLoading) return null

    return (
        <div className="mx-5 mb-6 glass rounded-2xl p-4 flex items-center justify-between">
            <div className="flex items-center gap-3">
                <div className="h-10 w-10 bg-blue-500/20 rounded-full flex items-center justify-center text-blue-400">
                    <BellRing className="h-5 w-5" />
                </div>
                <div>
                    <h3 className="text-white font-medium text-sm">Get Alerts</h3>
                    <p className="text-white/60 text-xs">Enable push notifications</p>
                </div>
            </div>
            <Button size="sm" onClick={subscribeToPush} className="bg-blue-600 hover:bg-blue-700">
                Enable
            </Button>
        </div>
    )
}
