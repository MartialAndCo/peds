'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import axios from 'axios'
import { Button } from '@/components/ui/button'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Plus, Pencil, Trash } from 'lucide-react'
import { useRouter } from 'next/navigation'

export default function PromptsPage() {
    const router = useRouter()
    const [prompts, setPrompts] = useState<any[]>([])
    const [loading, setLoading] = useState(true)

    useEffect(() => {
        fetchPrompts()
    }, [])

    const fetchPrompts = async () => {
        try {
            const res = await axios.get('/api/prompts')
            setPrompts(res.data)
        } catch (error) {
            console.error(error)
        } finally {
            setLoading(false)
        }
    }

    const handleDelete = async (id: number) => {
        if (!confirm('Are you sure?')) return
        try {
            await axios.delete(`/api/prompts/${id}`)
            fetchPrompts()
        } catch (error) {
            console.error(error)
        }
    }

    return (
        <div className="space-y-4">
            <div className="flex items-center justify-between">
                <h2 className="text-3xl font-bold tracking-tight">Prompts</h2>
                <Link href="/prompts/new">
                    <Button>
                        <Plus className="mr-2 h-4 w-4" />
                        New Prompt
                    </Button>
                </Link>
            </div>

            <div className="border rounded-md">
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead>Name</TableHead>
                            <TableHead>Model</TableHead>
                            <TableHead>Temp</TableHead>
                            <TableHead>Created</TableHead>
                            <TableHead className="text-right">Actions</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {loading ? (
                            <TableRow>
                                <TableCell colSpan={5} className="text-center py-4">Loading...</TableCell>
                            </TableRow>
                        ) : prompts.length === 0 ? (
                            <TableRow>
                                <TableCell colSpan={5} className="text-center py-4">No prompts found</TableCell>
                            </TableRow>
                        ) : (
                            prompts.map((prompt) => (
                                <TableRow key={prompt.id}>
                                    <TableCell className="font-medium">{prompt.name}</TableCell>
                                    <TableCell>{prompt.model}</TableCell>
                                    <TableCell>{prompt.temperature}</TableCell>
                                    <TableCell>{new Date(prompt.createdAt).toLocaleDateString()}</TableCell>
                                    <TableCell className="text-right space-x-2">
                                        <Button variant="ghost" size="icon" onClick={() => router.push(`/prompts/${prompt.id}`)}>
                                            <Pencil className="h-4 w-4" />
                                        </Button>
                                        <Button variant="ghost" size="icon" className="text-red-500" onClick={() => handleDelete(prompt.id)}>
                                            <Trash className="h-4 w-4" />
                                        </Button>
                                    </TableCell>
                                </TableRow>
                            ))
                        )}
                    </TableBody>
                </Table>
            </div>
        </div>
    )
}
