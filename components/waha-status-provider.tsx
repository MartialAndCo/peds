'use client'

import React, { createContext, useContext, useEffect, useState } from 'react'
import axios from 'axios'

type WahaStatus = 'WORKING' | 'SCAN_QR' | 'STOPPED' | 'UNREACHABLE' | 'STARTING'

interface StatusContextType {
    status: WahaStatus
    isDisconnected: boolean
    checkStatus: () => Promise<void>
}

const StatusContext = createContext<StatusContextType>({
    status: 'STARTING',
    isDisconnected: false,
    checkStatus: async () => { }
})

export const useWahaStatus = () => useContext(StatusContext)

export function StatusProvider({ children }: { children: React.ReactNode }) {
    const [status, setStatus] = useState<WahaStatus>('STARTING')

    const checkStatus = async () => {
        try {
            const res = await axios.get('/api/waha/status', { timeout: 3000 })
            const rawStatus = res.data.status // e.g., 'WORKING', 'SCAN_QR_CODE', 'STOPPED'

            // Normalize
            let newStatus: WahaStatus = 'STOPPED'
            if (rawStatus === 'WORKING') newStatus = 'WORKING'
            else if (rawStatus === 'SCAN_QR_CODE') newStatus = 'SCAN_QR'
            else if (rawStatus === 'STOPPED') newStatus = 'STOPPED'
            else if (rawStatus === 'STARTING') newStatus = 'STARTING'
            else newStatus = 'STOPPED'

            setStatus(newStatus)
        } catch (error) {
            setStatus('UNREACHABLE')
        }
    }

    useEffect(() => {
        checkStatus()
        const interval = setInterval(checkStatus, 10000) // Poll every 10s
        return () => clearInterval(interval)
    }, [])

    const isDisconnected = status !== 'WORKING' && status !== 'STARTING'

    return (
        <StatusContext.Provider value={{ status, isDisconnected, checkStatus }}>
            {children}
        </StatusContext.Provider>
    )
}
