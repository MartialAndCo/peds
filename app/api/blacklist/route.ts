import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET() {
    try {
        const rules = await prisma.blacklistRule.findMany({
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
        const { term, mediaType } = body;

        if (!term) return NextResponse.json({ error: 'Term is required' }, { status: 400 });

        const rule = await prisma.blacklistRule.create({
            data: {
                term,
                mediaType: mediaType || 'all'
            }
        });

        return NextResponse.json(rule);
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
