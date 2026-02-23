"use client"

import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table"
import { format } from "date-fns"
import { fr } from "date-fns/locale"
import { Trash2, Edit, Play } from "lucide-react"
import { Button } from "@/components/ui/button"
import { useToast } from "@/components/ui/use-toast"
import { deleteScenario } from "@/app/actions/scenarios"
import Link from "next/link"

interface Scenario {
    id: string
    title: string
    description: string
    createdAt: string
    _count?: {
        activeScenarios: number
        media: number
    }
}

interface ScenariosTableProps {
    scenarios: Scenario[]
}

export function ScenariosTable({ scenarios }: ScenariosTableProps) {
    const { toast } = useToast()

    const handleDelete = async (id: string) => {
        if (!confirm('Are you sure you want to delete this scenario? All related media and active sessions will be deleted.')) return

        const result = await deleteScenario(id)
        if (result.success) {
            toast({ title: "Scenario deleted" })
        } else {
            toast({ title: "Error", description: result.error, variant: "destructive" })
        }
    }

    if (scenarios.length === 0) {
        return (
            <div className="flex w-full flex-col items-center justify-center py-12 glass rounded-2xl">
                <p className="text-white/40">No scenarios found. Add one to get started.</p>
            </div>
        )
    }

    return (
        <div className="rounded-2xl border border-white/10 glass overflow-hidden">
            <Table>
                <TableHeader className="bg-white/5">
                    <TableRow className="border-white/10 hover:bg-white/5">
                        <TableHead className="text-white/60">Title</TableHead>
                        <TableHead className="text-white/60">Description</TableHead>
                        <TableHead className="text-white/60 text-center">Media</TableHead>
                        <TableHead className="text-white/60 text-center">Active</TableHead>
                        <TableHead className="text-white/60">Created</TableHead>
                        <TableHead className="text-white/60 text-right">Actions</TableHead>
                    </TableRow>
                </TableHeader>
                <TableBody>
                    {scenarios.map((scenario) => (
                        <TableRow key={scenario.id} className="border-white/10 hover:bg-white/5">
                            <TableCell className="font-medium text-white/80">
                                {scenario.title}
                            </TableCell>
                            <TableCell className="text-white/60 max-w-xs truncate">
                                {scenario.description}
                            </TableCell>
                            <TableCell className="text-center text-white/60">
                                {scenario._count?.media || 0}
                            </TableCell>
                            <TableCell className="text-center text-white/60">
                                {scenario._count?.activeScenarios || 0}
                            </TableCell>
                            <TableCell className="text-white/60">
                                {format(new Date(scenario.createdAt), "dd MMM yyyy", { locale: fr })}
                            </TableCell>
                            <TableCell className="text-right">
                                <div className="flex items-center justify-end gap-2">
                                    <Link href={`/admin/scenarios/${scenario.id}/launch`}>
                                        <Button variant="ghost" size="icon" className="h-8 w-8 text-emerald-400 hover:text-emerald-300 hover:bg-emerald-400/10">
                                            <Play className="h-4 w-4" />
                                        </Button>
                                    </Link>
                                    <Link href={`/admin/scenarios/${scenario.id}`}>
                                        <Button variant="ghost" size="icon" className="h-8 w-8 text-white/60 hover:text-white hover:bg-white/10">
                                            <Edit className="h-4 w-4" />
                                        </Button>
                                    </Link>
                                    <Button
                                        variant="ghost"
                                        size="icon"
                                        onClick={() => handleDelete(scenario.id)}
                                        className="h-8 w-8 text-white/40 hover:text-red-400 hover:bg-red-400/10"
                                    >
                                        <Trash2 className="h-4 w-4" />
                                    </Button>
                                </div>
                            </TableCell>
                        </TableRow>
                    ))}
                </TableBody>
            </Table>
        </div>
    )
}
