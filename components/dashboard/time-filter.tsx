'use client'

import { useRouter, useSearchParams } from 'next/navigation'
import { useCallback } from 'react'
import { CalendarDays } from 'lucide-react'

export function TimeFilter() {
    const router = useRouter()
    const searchParams = useSearchParams()
    const currentRange = searchParams.get('range') || '7d'

    const createQueryString = useCallback(
        (name: string, value: string) => {
            const params = new URLSearchParams(searchParams.toString())
            params.set(name, value)
            return params.toString()
        },
        [searchParams]
    )

    const setRange = (range: string) => {
        router.push(`?${createQueryString('range', range)}`)
    }

    return (
        <div className="flex items-center gap-2 bg-white/[0.04] p-1 rounded-lg border border-white/[0.08]">
            <CalendarDays className="h-4 w-4 text-white/40 ml-2" />
            <div className="flex bg-black/20 rounded-md p-1">
                <button
                    onClick={() => setRange('7d')}
                    className={`px-3 py-1 text-sm rounded-md transition-all ${currentRange === '7d'
                            ? 'bg-white/10 text-white shadow-sm'
                            : 'text-white/40 hover:text-white hover:bg-white/5'
                        }`}
                >
                    7 Days
                </button>
                <button
                    onClick={() => setRange('30d')}
                    className={`px-3 py-1 text-sm rounded-md transition-all ${currentRange === '30d'
                            ? 'bg-white/10 text-white shadow-sm'
                            : 'text-white/40 hover:text-white hover:bg-white/5'
                        }`}
                >
                    30 Days
                </button>
            </div>
        </div>
    )
}
