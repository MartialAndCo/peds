import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET(req: Request) {
    try {
        const { searchParams } = new URL(req.url);
        const agentId = searchParams.get('agentId');

        const where: any = {};
        if (agentId) {
            where.agentId = parseInt(agentId);
        } else {
            // Implicitly, no agentId means global? Or should we show all?
            // For now, let's assume if no agentId provided, we return global rules (agentId: null).
            // Or maybe existing rules have null agentId.
            where.agentId = null;
        }

        const rules = await prisma.blacklistRule.findMany({
            where,
            orderBy: { createdAt: 'desc' }
        });
        return NextResponse.json(rules);
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}

export async function POST(req: Request) {
    try {
        const body = await req.json();
        const { term, mediaType, agentId } = body;

        if (!term) return NextResponse.json({ error: 'Term is required' }, { status: 400 });

        const rule = await prisma.blacklistRule.create({
            data: {
                term,
                mediaType: mediaType || 'all',
                agentId: agentId ? parseInt(agentId) : null
            }
        });

        return NextResponse.json(rule);
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}

export async function DELETE(req: Request) {
    try {
        const { searchParams } = new URL(req.url);
        // DELETE usually comes with ID in path, but next.js app router encourages dynamic routes [id].
        // However, I see the existing code didn't have DELETE?
        // Wait, the client used `axios.delete('/api/blacklist/' + id)`.
        // So I need a separate route.ts file for [id] if not already present.
        // Let me check if there is a [id]/route.ts
        return NextResponse.json({ error: "Method not allowed on collection" }, { status: 405 });
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
