import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET() {
    try {
        const prompt = await prisma.prompt.findFirst({
            where: { isActive: true }
        });
        return NextResponse.json(prompt || {});
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}

export async function PUT(req: Request) {
    try {
        const body = await req.json();
        const { system_prompt, name } = body;

        // Update active prompt or create one
        const active = await prisma.prompt.findFirst({ where: { isActive: true } });

        if (active) {
            const updated = await prisma.prompt.update({
                where: { id: active.id },
                data: { system_prompt, name }
            });
            return NextResponse.json(updated);
        } else {
            const newPrompt = await prisma.prompt.create({
                data: {
                    name: name || 'Default Persona',
                    system_prompt,
                    isActive: true,
                    model: 'google-gemma-3-27b-it'
                }
            });
            return NextResponse.json(newPrompt);
        }
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
