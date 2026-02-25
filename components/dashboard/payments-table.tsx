"use client"

import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { format } from "date-fns"
import { fr } from "date-fns/locale"
import { getContactDisplayName } from "@/lib/contact-display"

interface Payment {
    id: string
    amount: number
    currency: string
    status: string
    method?: string | null
    createdAt: Date | string
    contact?: {
        name: string | null
        profile?: { name?: string | null } | null
        phone_whatsapp: string | null
    } | null
    payerName?: string | null
}

interface PaymentsTableProps {
    payments: Payment[]
}

import { Trash2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { useToast } from "@/components/ui/use-toast"
import { deletePayment } from "@/app/actions/payments"

export function PaymentsTable({ payments }: PaymentsTableProps) {
    const { toast } = useToast()

    const handleDelete = async (id: string) => {
        if (!confirm('Are you sure you want to delete this payment?')) return

        const result = await deletePayment(id)
        if (result.success) {
            toast({ title: "Payment deleted" })
        } else {
            toast({ title: "Error", description: result.error, variant: "destructive" })
        }
    }

    if (payments.length === 0) {
        return (
            <div className="flex w-full flex-col items-center justify-center py-12 glass rounded-2xl">
                <p className="text-white/40">No payments found</p>
            </div>
        )
    }

    return (
        <div className="rounded-2xl border border-white/10 glass overflow-hidden">
            <Table>
                <TableHeader className="bg-white/5">
                    <TableRow className="border-white/10 hover:bg-white/5">
                        <TableHead className="text-white/60">Date</TableHead>
                        <TableHead className="text-white/60">Payer</TableHead>
                        <TableHead className="text-white/60">Method</TableHead>
                        <TableHead className="text-white/60">Amount</TableHead>
                        <TableHead className="text-white/60 text-right">Status</TableHead>
                        <TableHead className="text-white/60 w-[50px]"></TableHead>
                    </TableRow>
                </TableHeader>
                <TableBody>
                    {payments.map((payment) => {
                        const displayName = getContactDisplayName(payment.contact, payment.payerName || "Unknown")
                        return (
                        <TableRow key={payment.id} className="border-white/10 hover:bg-white/5">
                            <TableCell className="font-medium text-white/80">
                                {format(new Date(payment.createdAt), "dd MMM yyyy HH:mm", { locale: fr })}
                            </TableCell>
                            <TableCell>
                                <div className="flex flex-col">
                                    <span className="text-white font-medium">
                                        {displayName}
                                    </span>
                                    <span className="text-xs text-white/40 font-mono">
                                        {payment.contact?.phone_whatsapp || ""}
                                    </span>
                                </div>
                            </TableCell>
                            <TableCell>
                                <Badge variant="outline" className="border-white/10 bg-white/5 text-white/70">
                                    {payment.method || "Manual"}
                                </Badge>
                            </TableCell>
                            <TableCell className="text-emerald-400 font-bold">
                                {Number(payment.amount).toFixed(2)} {payment.currency}
                            </TableCell>
                            <TableCell className="text-right">
                                <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${payment.status === 'COMPLETED'
                                    ? 'bg-emerald-500/10 text-emerald-400'
                                    : 'bg-amber-500/10 text-amber-400'
                                    }`}>
                                    {payment.status}
                                </span>
                            </TableCell>
                            <TableCell>
                                <Button
                                    variant="ghost"
                                    size="icon"
                                    onClick={() => handleDelete(payment.id)}
                                    className="h-8 w-8 text-white/40 hover:text-red-400 hover:bg-red-400/10"
                                >
                                    <Trash2 className="h-4 w-4" />
                                </Button>
                            </TableCell>
                        </TableRow>
                        )
                    })}
                </TableBody>
            </Table>
        </div>
    )
}
