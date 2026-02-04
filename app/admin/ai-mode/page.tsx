'use client'

import { useState, useEffect } from 'react'

export default function AIModePage() {
  const [mode, setMode] = useState<string>('CLASSIC')
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState('')

  useEffect(() => {
    fetch('/api/ai-mode')
      .then(r => r.json())
      .then(data => setMode(data.mode))
  }, [])

  async function switchMode(newMode: string) {
    setLoading(true)
    setMessage('')
    
    try {
      const res = await fetch('/api/ai-mode', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mode: newMode })
      })
      
      const data = await res.json()
      if (res.ok) {
        setMode(newMode)
        setMessage(`✅ Mode changé: ${newMode}`)
      } else {
        setMessage(`❌ Erreur: ${data.error}`)
      }
    } catch (e: any) {
      setMessage(`❌ Erreur: ${e.message}`)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="p-8">
      <h1 className="text-2xl font-bold mb-6">🤖 Mode IA</h1>
      
      <div className="bg-white rounded-lg shadow p-6 max-w-md">
        <div className="mb-4">
          <span className="text-gray-600">Mode actuel:</span>
          <span className={`ml-2 font-bold ${mode === 'SWARM' ? 'text-green-600' : 'text-blue-600'}`}>
            {mode}
          </span>
        </div>
        
        <div className="space-y-3">
          <button
            onClick={() => switchMode('CLASSIC')}
            disabled={loading || mode === 'CLASSIC'}
            className={`w-full p-4 rounded-lg border-2 transition ${
              mode === 'CLASSIC' 
                ? 'border-blue-500 bg-blue-50' 
                : 'border-gray-200 hover:border-blue-300'
            }`}
          >
            <div className="font-bold">CLASSIC</div>
            <div className="text-sm text-gray-600">Mode traditionnel (1 prompt)</div>
          </button>
          
          <button
            onClick={() => switchMode('SWARM')}
            disabled={loading || mode === 'SWARM'}
            className={`w-full p-4 rounded-lg border-2 transition ${
              mode === 'SWARM' 
                ? 'border-green-500 bg-green-50' 
                : 'border-gray-200 hover:border-green-300'
            }`}
          >
            <div className="font-bold">SWARM 🐝</div>
            <div className="text-sm text-gray-600">Multi-agents (10 agents)</div>
          </button>
        </div>
        
        {loading && (
          <div className="mt-4 text-center text-gray-600">Changement en cours...</div>
        )}
        
        {message && (
          <div className={`mt-4 p-3 rounded ${message.startsWith('✅') ? 'bg-green-100' : 'bg-red-100'}`}>
            {message}
          </div>
        )}
        
        <div className="mt-6 text-sm text-gray-500">
          <p><strong>CLASSIC:</strong> Un seul appel API avec tout le contexte</p>
          <p className="mt-1"><strong>SWARM:</strong> 10 agents spécialisés (intention, timing, persona, style, phase, mémoire, paiement, média, vocal, response)</p>
        </div>
      </div>
    </div>
  )
}
