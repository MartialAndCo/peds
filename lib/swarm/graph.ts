// Moteur d'exécution du graph multi-agent (inspiré LangGraph)
import type { SwarmState, NodeFunction, EdgeConfig } from './types'

export class SwarmGraph {
    private nodes: Map<string, NodeFunction> = new Map()
    private edges: Map<string, EdgeConfig[]> = new Map()

    addNode(name: string, fn: NodeFunction) {
        this.nodes.set(name, fn)
        if (!this.edges.has(name)) {
            this.edges.set(name, [])
        }
    }

    addEdge(from: string, to: string, condition?: (state: SwarmState) => boolean) {
        if (!this.edges.has(from)) {
            this.edges.set(from, [])
        }
        this.edges.get(from)!.push({ from, to, condition })
    }

    addConditionalEdges(
        from: string,
        conditionFn: (state: SwarmState) => string,
        targets: Record<string, string>
    ) {
        // Pour les edges conditionnels complexes
        this.edges.set(from, Object.entries(targets).map(([key, to]) => ({
            from,
            to,
            condition: (state: SwarmState) => conditionFn(state) === key
        })))
    }

    async execute(startNode: string, initialState: SwarmState): Promise<SwarmState> {
        let currentNode = startNode
        let state: SwarmState = initialState
        const visited = new Set<string>()
        let iterations = 0
        const MAX_ITERATIONS = 20

        console.log(`[Swarm] Starting execution from node: ${currentNode}`)

        while (currentNode !== 'END' && iterations < MAX_ITERATIONS) {
            iterations++

            // Exécuter le node actuel
            const node = this.nodes.get(currentNode)
            if (!node) {
                throw new Error(`[Swarm] Node "${currentNode}" not found`)
            }

            console.log(`[Swarm] [${iterations}] Executing: ${currentNode}`)
            const startTime = Date.now()

            try {
                const result = await node(state)
                state = { ...state, ...result }

                const duration = Date.now() - startTime
                console.log(`[Swarm] [${iterations}] ${currentNode} completed in ${duration}ms`)

                // Déterminer le prochain node
                const nextNode = this.getNextNode(currentNode, state)

                if (nextNode === currentNode) {
                    console.warn(`[Swarm] Loop detected at ${currentNode}, breaking`)
                    break
                }

                currentNode = nextNode

            } catch (error) {
                console.error(`[Swarm] Error in node ${currentNode}:`, error)
                state.error = `Error in ${currentNode}: ${error}`
                break
            }
        }

        if (iterations >= MAX_ITERATIONS) {
            console.warn('[Swarm] Max iterations reached')
            state.error = 'Max iterations reached'
        }

        console.log(`[Swarm] Execution completed in ${iterations} iterations`)
        return state
    }

    private getNextNode(currentNode: string, state: SwarmState): string {
        const edges = this.edges.get(currentNode) || []

        // Trouver une edge avec condition satisfaite
        for (const edge of edges) {
            if (!edge.condition || edge.condition(state)) {
                return edge.to
            }
        }

        // Si pas d'edge valide, chercher une edge sans condition
        const defaultEdge = edges.find(e => !e.condition)
        if (defaultEdge) {
            return defaultEdge.to
        }

        // Sinon, END
        return 'END'
    }

    // Exécution parallèle de plusieurs nodes
    async executeParallel(nodeNames: string[], state: SwarmState): Promise<Partial<SwarmState>[]> {
        console.log(`[Swarm] Parallel execution: ${nodeNames.join(', ')}`)

        const results = await Promise.all(
            nodeNames.map(async (name) => {
                const node = this.nodes.get(name)
                if (!node) {
                    console.warn(`[Swarm] Node ${name} not found`)
                    return {}
                }
                return node(state)
            })
        )

        return results
    }
}
