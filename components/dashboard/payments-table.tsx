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

interface Payment {
    id: string
    amount: number
    currency: string
    status: string
    method?: string | null
    createdAt: Date | string
    contact?: {
        name: string | null
        phone_whatsapp: string
    } | null
    payerName?: string | null
}

interface PaymentsTableProps {
    payments: Payment[]
}

export function PaymentsTable({ payments }: PaymentsTableProps) {
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
                    </TableRow>
                </TableHeader>
                <TableBody>
                    {payments.map((payment) => (
                        <TableRow key={payment.id} className="border-white/10 hover:bg-white/5">
                            <TableCell className="font-medium text-white/80">
                                {format(new Date(payment.createdAt), "dd MMM yyyy HH:mm", { locale: fr })}
                            </TableCell>
                            <TableCell>
                                <div className="flex flex-col">
                                    <span className="text-white font-medium">
                                        {payment.contact?.name || payment.payerName || "Unknown"}
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
                        </TableRow>
                    ))}
                </TableBody>
            </Table>
        </div>
    )
}
