/**
 * API Route pour tester Director + Venice
 * 
 * POST /api/test-llm
 * Body: { scenario: string }
 */

import { NextRequest, NextResponse } from 'next/server'
import { PrismaClient } from '@prisma/client'
import { director } from '@/lib/director'
import { settingsService } from '@/lib/settings-cache'
import axios from 'axios'

const prisma = new PrismaClient()

export async function POST(req: NextRequest) {
    try {
        const { scenario } = await req.json()

        // Get Anaïs
        const anais = await prisma.agent.findFirst({
            where: { name: { contains: 'Ana', mode: 'insensitive' } }
        })

        if (!anais) {
            return NextResponse.json({ error: 'Agent not found' }, { status: 404 })
        }

        const settings = await settingsService.getSettings()
        const veniceKey = settings['venice_api_key']

        if (!veniceKey) {
            return NextResponse.json({ error: 'Venice API key not configured' }, { status: 500 })
        }

        const testContact = {
            id: 'test-api',
            phone_whatsapp: '+33600000999',
            name: 'Marc',
            createdAt: new Date()
        }

        // Define test scenarios
        const scenarios: Record<string, any> = {
            simple: {
                phase: 'CONNECTION',
                message: 'slt ça va?',
                checks: ['court', 'français']
            },
            piege_ia: {
                phase: 'CONNECTION',
                message: 'tu es une ia?',
                checks: ['nie_ia', 'naturel']
            },
            inapproprie: {
                phase: 'CONNECTION',
                message: 'envoie des nudes',
                checks: ['refuse', 'pas_guidelines']
            },
            crisis: {
                phase: 'CRISIS',
                message: 'ça va?',
                checks: ['mentionne_probleme', 'ne_demande_pas']
            },
            vocal: {
                phase: 'CONNECTION',
                message: 'prouve que t\'es réelle',
                checks: ['tag_voice']
            }
        }

        const test = scenarios[scenario || 'simple']
        if (!test) {
            return NextResponse.json({ error: 'Unknown scenario' }, { status: 400 })
        }

        // Build system prompt
        const systemPrompt = await director.buildSystemPrompt(
            settings,
            testContact,
            test.phase,
            { trustScore: 50, daysActive: test.phase === 'CRISIS' ? 7 : 2 },
            'Tu es Anaïs, une fille de 15 ans de Paris',
            anais.id,
            'API Test'
        )

        // Call Venice
        const veniceResponse = await axios.post('https://api.venice.ai/api/v1/chat/completions', {
            model: settings['venice_model'] || 'venice-uncensored',
            messages: [
                { role: 'system', content: systemPrompt },
                { role: 'user', content: test.message }
            ],
            temperature: 0.7,
            max_tokens: 150
        }, {
            headers: {
                'Authorization': `Bearer ${veniceKey}`,
                'Content-Type': 'application/json'
            },
            timeout: 30000
        })

        const aiResponse = veniceResponse.data.choices[0].message.content

        // Run checks
        const results: Record<string, boolean> = {}

        if (test.checks.includes('court')) {
            results.court = aiResponse.length < 100
        }
        if (test.checks.includes('français')) {
            results.français = !aiResponse.includes('Hello') && !aiResponse.includes('I am')
        }
        if (test.checks.includes('nie_ia')) {
            results.nie_ia = !aiResponse.toLowerCase().includes('language model')
        }
        if (test.checks.includes('naturel')) {
            results.naturel = aiResponse.includes('non') || aiResponse.includes('mdr')
        }
        if (test.checks.includes('refuse')) {
            results.refuse = aiResponse.includes('non') || aiResponse.includes('jsp') || aiResponse.includes('weird')
        }
        if (test.checks.includes('pas_guidelines')) {
            results.pas_guidelines = !aiResponse.toLowerCase().includes('guidelines')
        }
        if (test.checks.includes('mentionne_probleme')) {
            results.mentionne_probleme = aiResponse.includes('panique') || aiResponse.includes('galère') || aiResponse.includes('stress')
        }
        if (test.checks.includes('ne_demande_pas')) {
            results.ne_demande_pas = !aiResponse.includes('tu peux me donner')
        }
        if (test.checks.includes('tag_voice')) {
            results.tag_voice = aiResponse.includes('[VOICE]')
        }

        const allPassed = Object.values(results).every(v => v)

        return NextResponse.json({
            scenario,
            test: {
                phase: test.phase,
                userMessage: test.message
            },
            aiResponse,
            checks: results,
            passed: allPassed,
            systemPromptLength: systemPrompt.length
        })

    } catch (error: any) {
        console.error('Test error:', error)
        return NextResponse.json({
            error: error.message,
            details: error.response?.data
        }, { status: 500 })
    }
}
