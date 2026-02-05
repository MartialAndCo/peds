'use client'

import { useEffect, useState } from 'react'
import axios from 'axios'
import { Brain, Zap } from 'lucide-react'
import { cn } from '@/lib/utils'

export function AIModeIndicator({ className }: { className?: string }) {
    const [mode, setMode] = useState<string>('CLASSIC')
    const [loading, setLoading] = useState(true)

    useEffect(() => {
        axios.get('/api/ai-mode')
            .then(res => {
                setMode(res.data.mode || 'CLASSIC')
            })
            .catch(() => {
                // Fallback sur les settings
                axios.get('/api/settings')
                    .then(res => setMode(res.data.ai_mode || 'CLASSIC'))
                    .catch(() => setMode('CLASSIC'))
            })
            .finally(() => setLoading(false))
    }, [])

    const isSwarm = mode === 'SWARM'

    return (
        <div 
            className={cn(
                "flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-medium transition-colors",
                isSwarm 
                    ? "bg-purple-500/20 text-purple-400 border border-purple-500/30" 
                    : "bg-blue-500/20 text-blue-400 border border-blue-500/30",
                className
            )}
            title={isSwarm ? "Mode SWARM: 10 agents spécialisés" : "Mode CLASSIC: 1 prompt unique"}
        >
            {isSwarm ? (
                <>
                    <Brain className="w-3.5 h-3.5" />
                    <span>SWARM</span>
                </>
            ) : (
                <>
                    <Zap className="w-3.5 h-3.5" />
                    <span>CLASSIC</span>
                </>
            )}
        </div>
    )
}
