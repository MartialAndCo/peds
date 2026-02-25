/**
 * Credit Monitor Service
 * 
 * Monitors AI provider credits and alerts when depleted.
 * Stores alerts in memory for dashboard display.
 */

export type CreditAlert = {
    provider: 'venice' | 'runpod'
    status: 'depleted' | 'low' | 'ok'
    timestamp: Date
    message: string
    agentId?: string
}

// In-memory storage for credit alerts (last 100)
const alerts: CreditAlert[] = []
const MAX_ALERTS = 100

export const creditMonitor = {
    /**
     * Add a credit alert
     */
    addAlert(alert: Omit<CreditAlert, 'timestamp'>) {
        alerts.unshift({
            ...alert,
            timestamp: new Date()
        })
        
        // Keep only last 100
        if (alerts.length > MAX_ALERTS) {
            alerts.pop()
        }
        
        // Log prominently
        console.error(`🚨 CREDIT ALERT [${alert.provider.toUpperCase()}]: ${alert.status}`)
        console.error(`   Message: ${alert.message}`)
        console.error(`   Agent: ${alert.agentId || 'N/A'}`)
        console.error(`   Time: ${new Date().toISOString()}`)
    },
    
    /**
     * Get all alerts
     */
    getAlerts(): CreditAlert[] {
        return [...alerts]
    },
    
    /**
     * Get latest alert for a provider
     */
    getLatestAlert(provider: string): CreditAlert | undefined {
        return alerts.find(a => a.provider === provider)
    },
    
    /**
     * Clear all alerts
     */
    clearAlerts() {
        alerts.length = 0
    },
    
    /**
     * Check if credits are depleted for a provider
     */
    isDepleted(provider: string): boolean {
        const latest = this.getLatestAlert(provider)
        if (!latest) return false
        // Consider depleted if alert is less than 1 hour old
        const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000)
        return latest.status === 'depleted' && latest.timestamp > oneHourAgo
    }
}
