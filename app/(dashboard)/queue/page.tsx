'use client'

import { useEffect, useState } from 'react'
import { getQueueItems, deleteQueueItem, sendQueueItemNow } from '@/app/actions/queue'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { RefreshCcw, Trash2, Zap } from 'lucide-react'
import { format } from 'date-fns'
import { fr } from 'date-fns/locale'

export default function QueuePage() {
    const [items, setItems] = useState<any[]>([])
    const [loading, setLoading] = useState(true)

    const fetchItems = async () => {
        setLoading(true)
        const data = await getQueueItems()
        setItems(data)
        setLoading(false)
    }

    useEffect(() => {
        fetchItems()
        // Auto refresh every 10s
        const interval = setInterval(fetchItems, 10000)
        return () => clearInterval(interval)
    }, [])

    const handleDelete = async (id: string) => {
        if (!confirm('Are you sure you want to cancel this message?')) return
        await deleteQueueItem(id)
        fetchItems()
    }

    const handleSendNow = async (id: string) => {
        if (!confirm('Send this message immediately?')) return
        setLoading(true)
        const result = await sendQueueItemNow(id)
        if (!result.success) alert('Failed: ' + result.error)
        fetchItems()
    }

    return (
        <div className="space-y-4">
            <div className="flex justify-between items-center">
                <h2 className="text-3xl font-bold tracking-tight">Message Queue</h2>
                <Button onClick={fetchItems} variant="outline" size="sm">
                    <RefreshCcw className={`mr-2 h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
                    Refresh
                </Button>
            </div>

            <Card>
                <CardHeader>
                    <CardTitle>Pending Messages ({items.length})</CardTitle>
                </CardHeader>
                <CardContent>
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>Scheduled</TableHead>
                                <TableHead>Contact</TableHead>
                                <TableHead>Message</TableHead>
                                <TableHead>Status</TableHead>
                                <TableHead className="text-right">Actions</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {items.length === 0 ? (
                                <TableRow>
                                    <TableCell colSpan={5} className="text-center h-24 text-muted-foreground">
                                        No messages in queue
                                    </TableCell>
                                </TableRow>
                            ) : (
                                items.map((item) => (
                                    <TableRow key={item.id}>
                                        <TableCell>
                                            <div className="flex flex-col">
                                                <span className="font-medium">
                                                    {(() => {
                                                        // Force Paris Timezone Display
                                                        // Server sends ISO (UTC). We want to show what this time is in Paris.
                                                        const date = new Date(item.scheduledAt)
                                                        // Basic Intl formatting to handle timezone efficiently without heavy libs if possible, 
                                                        // or use toZonedTime if we import it.
                                                        // Let's use Intl for zero-dependency reliability on client
                                                        return new Intl.DateTimeFormat('fr-FR', {
                                                            timeZone: 'Europe/Paris',
                                                            hour: '2-digit',
                                                            minute: '2-digit',
                                                            second: '2-digit'
                                                        }).format(date)
                                                    })()}
                                                </span>
                                                <span className="text-xs text-muted-foreground">
                                                    {(() => {
                                                        const date = new Date(item.scheduledAt)
                                                        return new Intl.DateTimeFormat('fr-FR', {
                                                            timeZone: 'Europe/Paris',
                                                            day: '2-digit',
                                                            month: '2-digit',
                                                            year: 'numeric'
                                                        }).format(date)
                                                    })()}
                                                </span>
                                            </div>
                                        </TableCell>
                                        <TableCell>
                                            <div className="flex flex-col">
                                                <span className="font-medium">{item.contact.name || 'Unknown'}</span>
                                                <span className="text-xs text-muted-foreground">{item.contact.phone_whatsapp}</span>
                                            </div>
                                        </TableCell>
                                        <TableCell className="max-w-[300px]">
                                            <p className="truncate text-sm" title={item.content}>
                                                {item.content}
                                            </p>
                                        </TableCell>
                                        <TableCell>
                                            <Badge variant={item.status === 'PENDING' ? 'secondary' : 'default'}>
                                                {item.status}
                                            </Badge>
                                        </TableCell>
                                        <TableCell className="text-right space-x-2">
                                            {item.status === 'PENDING' && (
                                                <Button
                                                    variant="ghost"
                                                    size="icon"
                                                    className="text-yellow-600 hover:text-yellow-700 hover:bg-yellow-50"
                                                    title="Send Now"
                                                    onClick={() => handleSendNow(item.id)}
                                                >
                                                    <Zap className="h-4 w-4" />
                                                </Button>
                                            )}
                                            <Button
                                                variant="ghost"
                                                size="icon"
                                                className="text-red-500 hover:text-red-700 hover:bg-red-50"
                                                onClick={() => handleDelete(item.id)}
                                            >
                                                <Trash2 className="h-4 w-4" />
                                            </Button>
                                        </TableCell>
                                    </TableRow>
                                ))
                            )}
                        </TableBody>
                    </Table>
                </CardContent>
            </Card>
        </div>
    )
}
