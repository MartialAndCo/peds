'use client'

import { useState } from 'react'

export default function TestSwarmPage() {
  const [result, setResult] = useState<any>(null)
  const [loading, setLoading] = useState(false)
  
  async function runTest() {
    setLoading(true)
    
    try {
      const res = await fetch('/api/test-swarm')
      const data = await res.json()
      setResult(data)
    } catch (e: any) {
      setResult({ error: e.message })
    } finally {
      setLoading(false)
    }
  }
  
  return (
    <div style={{ padding: 20 }}>
      <h1>🧪 Test Swarm</h1>
      <button onClick={runTest} disabled={loading}>
        {loading ? 'Test...' : 'Lancer'}
      </button>
      
      {result && (
        <pre style={{ marginTop: 20, padding: 10, background: '#f5f5f5' }}>
          {JSON.stringify(result, null, 2)}
        </pre>
      )}
    </div>
  )
}
