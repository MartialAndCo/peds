import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function DELETE(
    request: Request,
    { params }: { params: Promise<{ id: string }> } // Params are now a Promise in Next.js 15+
) {
    try {
        const resolvedParams = await params; // Await the promise
        const id = parseInt(resolvedParams.id);

        await prisma.blacklistRule.delete({
            where: { id }
        });

        return NextResponse.json({ success: true });
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
