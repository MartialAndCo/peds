
'use client'

import React, { createContext, useContext, useState, useEffect } from 'react'
import axios from 'axios'
import { useRouter } from 'next/navigation'

interface Agent {
    id: number
    name: string
    color: string
    phone: string
}

interface AgentContextType {
    agents: Agent[]
    selectedAgent: Agent | null
    setSelectedAgent: (agent: Agent) => void
    isLoading: boolean
}

const AgentContext = createContext<AgentContextType>({
    agents: [],
    selectedAgent: null,
    setSelectedAgent: () => { },
    isLoading: true
})

export const useAgent = () => useContext(AgentContext)

export function AgentProvider({ children }: { children: React.ReactNode }) {
    const [agents, setAgents] = useState<Agent[]>([])
    const [selectedAgent, setSelectedAgentState] = useState<Agent | null>(null)
    const [isLoading, setIsLoading] = useState(true)
    const router = useRouter()

    useEffect(() => {
        fetchAgents()
    }, [])

    const fetchAgents = async () => {
        try {
            const res = await axios.get('/api/agents')
            const fetchedAgents = res.data

            setAgents(fetchedAgents)

            // Restore selection or default to first
            const storedId = localStorage.getItem('selectedAgentId')
            let toSelect = null

            if (storedId) {
                toSelect = fetchedAgents.find((a: Agent) => a.id === parseInt(storedId))
            }

            if (toSelect) {
                setSelectedAgentState(toSelect)
            }
        } catch (error) {
            console.error('Failed to fetch agents', error)
        } finally {
            setIsLoading(false)
        }
    }

    const setSelectedAgent = (agent: Agent) => {
        setSelectedAgentState(agent)
        localStorage.setItem('selectedAgentId', agent.id.toString())
        document.cookie = `activeAgentId=${agent.id}; path=/; max-age=31536000`
        router.refresh()
    }

    return (
        <AgentContext.Provider value={{ agents, selectedAgent, setSelectedAgent, isLoading }}>
            {children}
        </AgentContext.Provider>
    )
}
