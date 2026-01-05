
'use client'

import { useAgent } from '@/components/agent-provider'
import { Plus, Users } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import { Separator } from '@/components/ui/separator'

export function AgentSwitcher() {
    const { agents, selectedAgent, setSelectedAgent } = useAgent()

    return (
        <div className="space-y-4 flex flex-col items-center h-full text-primary w-full dark:bg-[#1E1F22] bg-[#E3E5E8] py-3">
            <TooltipProvider>
                {/* Agency Home / Global View (Future) */}
                <div className="relative group flex items-center justify-center mx-3 h-[48px] w-[48px] overflow-hidden rounded-[24px] group-hover:rounded-[16px] transition-all bg-zinc-700 group-hover:bg-emerald-500 cursor-pointer">
                    <Users className="text-emerald-500 group-hover:text-white transition" size={25} />
                </div>

                <Separator className="h-[2px] w-10 bg-zinc-300 dark:bg-zinc-700 rounded-md mx-auto" />

                {/* Agents List */}
                <div className="flex-1 w-full space-y-4 overflow-y-auto no-scrollbar pb-4">
                    {agents.map((agent) => (
                        <div key={agent.id} className="mb-4">
                            <Tooltip delayDuration={50}>
                                <TooltipTrigger className="w-full flex items-center justify-center">
                                    <div
                                        onClick={() => setSelectedAgent(agent)}
                                        className={cn(
                                            "relative group flex items-center justify-center mx-3 h-[48px] w-[48px] rounded-[24px] group-hover:rounded-[16px] transition-all overflow-hidden cursor-pointer",
                                            selectedAgent?.id === agent.id
                                                ? "bg-primary text-primary-foreground rounded-[16px]"
                                                : "bg-background dark:bg-[#313338] group-hover:bg-primary/90"
                                        )}
                                    >


                                        {/* Avatar Placeholder: First letter of name */}
                                        <span
                                            className={cn("text-lg font-semibold transition",
                                                selectedAgent?.id === agent.id ? "text-white" : "text-zinc-500 group-hover:text-white"
                                            )}
                                        >
                                            {agent.name.substring(0, 2).toUpperCase()}
                                        </span>
                                    </div>

                                    {/* Selection Pill Indicator */}
                                    <div className={cn(
                                        "absolute left-0 bg-primary rounded-r-full transition-all w-[4px]",
                                        selectedAgent?.id === agent.id ? "h-[36px]" : "h-[8px] opacity-0 group-hover:opacity-100 group-hover:h-[20px]"
                                    )} />
                                </TooltipTrigger>
                                <TooltipContent side="right">
                                    <p className="font-semibold">{agent.name}</p>
                                    <p className="text-xs text-muted-foreground">{agent.phone}</p>
                                </TooltipContent>
                            </Tooltip>
                        </div>
                    ))}

                    {/* Add Agent Button */}
                    <div className="relative group flex items-center justify-center mx-3 h-[48px] w-[48px] overflow-hidden rounded-[24px] group-hover:rounded-[16px] transition-all bg-background dark:bg-[#313338] group-hover:bg-green-500 cursor-pointer">
                        <Plus className="text-green-500 group-hover:text-white transition" size={25} />
                    </div>
                </div>
            </TooltipProvider>
        </div>
    )
}
