import type { NodeFunction, NodeMetric, SwarmState } from './types'

interface NodeInfo {
    id: string
    fn: NodeFunction
    dependencies: string[]
    isLLM: boolean
}

interface AddNodeOptions {
    isLLM?: boolean
}

interface ExecutedNodeResult {
    node: NodeInfo
    result: Partial<SwarmState>
    success: boolean
    metric: NodeMetric
}

const MAX_ITERATIONS = 100
const LLM_NODE_DELAY_MS = 120

export class SwarmGraph {
    private nodes: Map<string, NodeInfo> = new Map()

    addNode(name: string, fn: NodeFunction, dependencies: string[] = [], options: AddNodeOptions = {}) {
        this.nodes.set(name, {
            id: name,
            fn,
            dependencies,
            isLLM: options.isLLM ?? false
        })
    }

    private computeAllowedExecutionSet(startNode: string): Set<string> {
        const allowed = new Set<string>()

        if (!this.nodes.has(startNode)) {
            return allowed
        }

        // Initial reachable pass from start node.
        const queue: string[] = [startNode]
        allowed.add(startNode)

        while (queue.length > 0) {
            const current = queue.shift()!

            for (const node of this.nodes.values()) {
                if (allowed.has(node.id)) continue
                if (!node.dependencies.includes(current)) continue

                allowed.add(node.id)
                queue.push(node.id)
            }
        }

        // Prune nodes whose dependencies are outside the boundary.
        let changed = true
        while (changed) {
            changed = false
            for (const nodeId of Array.from(allowed)) {
                if (nodeId === startNode) continue
                const node = this.nodes.get(nodeId)
                if (!node) continue

                const hasMissingDependency = node.dependencies.some((dep) => !allowed.has(dep))
                if (hasMissingDependency) {
                    allowed.delete(nodeId)
                    changed = true
                }
            }
        }

        return allowed
    }

    private createInitialState(initialState: SwarmState): SwarmState {
        return {
            ...initialState,
            contexts: initialState.contexts || {},
            messages: initialState.messages || initialState.history || [],
            history: initialState.history || initialState.messages || [],
            metadata: {
                ...(initialState.metadata || {}),
                nodeMetrics: {
                    ...(initialState.metadata?.nodeMetrics || {})
                },
                executionOrder: [...(initialState.metadata?.executionOrder || [])]
            }
        }
    }

    private async runNode(node: NodeInfo, state: SwarmState): Promise<ExecutedNodeResult> {
        const startedAt = Date.now()

        try {
            console.log(`[Swarm] -> Starting ${node.id}...`)
            const result = await node.fn(state)
            const finishedAt = Date.now()
            const durationMs = finishedAt - startedAt
            console.log(`[Swarm] OK ${node.id} (${durationMs}ms)`)

            return {
                node,
                result,
                success: true,
                metric: {
                    startedAt,
                    finishedAt,
                    durationMs
                }
            }
        } catch (error: any) {
            const finishedAt = Date.now()
            const durationMs = finishedAt - startedAt
            console.error(`[Swarm] FAIL ${node.id}:`, error?.message || error)

            return {
                node,
                result: { error: `Error in ${node.id}: ${error?.message || String(error)}` },
                success: false,
                metric: {
                    startedAt,
                    finishedAt,
                    durationMs
                }
            }
        }
    }

    private applyNodeResults(
        baseState: SwarmState,
        results: ExecutedNodeResult[],
        executed: Set<string>
    ): SwarmState {
        let state = baseState
        const nextContexts = { ...state.contexts }

        for (const item of results) {
            const nodeId = item.node.id
            executed.add(nodeId)

            state.metadata.nodeMetrics = {
                ...(state.metadata.nodeMetrics || {}),
                [nodeId]: item.metric
            }
            state.metadata.executionOrder = [...(state.metadata.executionOrder || []), nodeId]

            const resultContexts = item.result.contexts
            if (resultContexts) {
                for (const [key, value] of Object.entries(resultContexts)) {
                    if (value !== undefined) {
                        nextContexts[key as keyof typeof nextContexts] = value as any
                    }
                }
            }
        }

        for (const item of results) {
            const { contexts, metadata, ...rest } = item.result
            state = {
                ...state,
                ...rest,
                metadata: {
                    ...state.metadata,
                    ...(metadata || {}),
                    nodeMetrics: {
                        ...(state.metadata.nodeMetrics || {}),
                        ...((metadata && (metadata as any).nodeMetrics) || {})
                    },
                    executionOrder: state.metadata.executionOrder
                }
            }
        }

        return {
            ...state,
            contexts: nextContexts
        }
    }

    async execute(startNode: string, initialState: SwarmState): Promise<SwarmState> {
        if (!this.nodes.has(startNode)) {
            throw new Error(`Start node not found: ${startNode}`)
        }

        let state = this.createInitialState(initialState)
        const executed = new Set<string>()
        const allowedNodes = this.computeAllowedExecutionSet(startNode)
        let iterations = 0

        console.log(`[Swarm] Starting execution from: ${startNode}`)
        console.log(`[Swarm] Allowed nodes from boundary: ${Array.from(allowedNodes).sort().join(', ')}`)

        while (iterations < MAX_ITERATIONS) {
            iterations += 1

            const readyNodes: NodeInfo[] = []
            for (const nodeId of allowedNodes) {
                if (executed.has(nodeId)) continue
                const info = this.nodes.get(nodeId)
                if (!info) continue

                const depsSatisfied = info.dependencies.every((dep) => executed.has(dep))
                if (depsSatisfied) {
                    readyNodes.push(info)
                }
            }

            readyNodes.sort((a, b) => a.id.localeCompare(b.id))

            if (readyNodes.length === 0) {
                const remaining = Array.from(allowedNodes).filter((nodeId) => !executed.has(nodeId))
                if (remaining.length === 0) {
                    console.log('[Swarm] All allowed nodes executed')
                    break
                }

                console.warn('[Swarm] Deadlock detected in allowed boundary. Remaining:', remaining)
                state.error = `Deadlock detected: ${remaining.join(', ')}`
                break
            }

            console.log(`[Swarm] [${iterations}] Ready nodes: ${readyNodes.map((n) => n.id).join(', ')}`)

            const nonLLMNodes = readyNodes.filter((node) => !node.isLLM)
            const llmNodes = readyNodes.filter((node) => node.isLLM)

            const nonLLMResults =
                nonLLMNodes.length > 0
                    ? await Promise.all(nonLLMNodes.map((node) => this.runNode(node, state)))
                    : []

            if (nonLLMResults.length > 0) {
                state = this.applyNodeResults(state, nonLLMResults, executed)
            }

            const llmResults: ExecutedNodeResult[] = []
            for (const node of llmNodes) {
                const result = await this.runNode(node, state)
                llmResults.push(result)

                if (LLM_NODE_DELAY_MS > 0 && llmNodes.length > 1) {
                    await new Promise((resolve) => setTimeout(resolve, LLM_NODE_DELAY_MS))
                }
            }

            if (llmResults.length > 0) {
                state = this.applyNodeResults(state, llmResults, executed)
            }

            if (executed.size === allowedNodes.size) {
                console.log('[Swarm] Boundary execution complete')
                break
            }
        }

        if (iterations >= MAX_ITERATIONS) {
            console.warn('[Swarm] Max iterations reached')
            state.error = 'Max iterations reached'
        }

        console.log(`[Swarm] Completed: ${executed.size}/${allowedNodes.size} allowed nodes, ${iterations} iterations`)
        return state
    }
}
