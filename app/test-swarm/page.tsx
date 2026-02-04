'use client'

import { useState } from 'react'

interface TestResult {
  phase: string
  message: string
  response: string
  duration: number
  styleValid: boolean
  styleIssues?: string[]
}

export default function TestSwarmPage() {
  const [results, setResults] = useState<TestResult[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  
  async function runTest() {
    setLoading(true)
    setError('')
    
    try {
      const res = await fetch('/api/test-swarm')
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      
      const data = await res.json()
      setResults(data.results)
    } catch (e: any) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }
  
  return (
    <div style={{ padding: 20, fontFamily: 'monospace' }}>
      <h1>🧪 Test Système Swarm</h1>
      
      <button 
        onClick={runTest} 
        disabled={loading}
        style={{ padding: '10px 20px', fontSize: 16, cursor: 'pointer' }}
      >
        {loading ? 'Test en cours...' : 'Lancer le test'}
      </button>
      
      {error && <div style={{ color: 'red', marginTop: 20 }}>❌ {error}</div>}
      
      {results.length > 0 && (
        <div style={{ marginTop: 30 }}>
          <h2>Résultats:</h2>
          
          {results.map((r, i) => (
            <div key={i} style={{ 
              margin: '15px 0', 
              padding: 15, 
              border: '1px solid #ccc',
              borderRadius: 8,
              background: r.styleValid ? '#f0fff0' : '#fff8f0'
            }}>
              <div><strong>Phase:</strong> {r.phase}</div>
              <div><strong>Message:</strong> "{r.message}"</div>
              <div style={{ margin: '10px 0', padding: 10, background: '#f5f5f5', borderRadius: 4 }}>
                <strong>Réponse:</strong> "{r.response}"
              </div>
              <div><strong>Temps:</strong> {r.duration}ms</div>
              <div>
                <strong>Style:</strong> {r.styleValid ? '✅ OK' : '⚠️ ' + r.styleIssues?.join(', ')}
              </div>
            </div>
          ))}
          
          <div style={{ marginTop: 20, padding: 15, background: '#e3f2fd', borderRadius: 8 }}>
            <strong>Stats:</strong><br/>
            Total: {results.length} messages<br/>
            Style OK: {results.filter(r => r.styleValid).length}/{results.length}<br/>
            Temps moyen: {(results.reduce((a, r) => a + r.duration, 0) / results.length).toFixed(0)}ms
          </div>
        </div>
      )}
    </div>
  )
}
