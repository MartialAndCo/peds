import { NextResponse } from 'next/server'
import { aiConfig } from '@/lib/config/ai-mode'

export async function GET() {
  // S'assurer que la config est initialisée
  await aiConfig.init()
  return NextResponse.json({ mode: aiConfig.mode })
}

export async function POST(request: Request) {
  try {
    const { mode } = await request.json()
    
    if (mode !== 'CLASSIC' && mode !== 'SWARM') {
      return NextResponse.json({ error: 'Mode invalide' }, { status: 400 })
    }
    
    // Sauvegarder en DB
    await aiConfig.setMode(mode)
    
    return NextResponse.json({ mode: aiConfig.mode, success: true })
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
