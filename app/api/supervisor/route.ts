/**
 * Supervisor API Routes
 * GET: Récupère les alertes avec filtres
 * PATCH: Met à jour le statut d'une alerte
 */

import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { supervisorOrchestrator } from '@/lib/services/supervisor';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

// GET /api/supervisor - Récupère les alertes
export async function GET(req: Request) {
    const session = await getServerSession(authOptions);
    if (!session) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    try {
        const { searchParams } = new URL(req.url);

        const status = searchParams.get('status') as any;
        const severity = searchParams.get('severity') as any;
        const agentId = searchParams.get('agentId') || undefined;
        const limit = parseInt(searchParams.get('limit') || '50');
        const offset = parseInt(searchParams.get('offset') || '0');

        const result = await supervisorOrchestrator.getAlerts({
            status,
            severity,
            agentId,
            limit,
            offset
        });

        return NextResponse.json(result);
    } catch (error: any) {
        console.error('[Supervisor API] GET failed:', error);
        return NextResponse.json(
            { error: 'Failed to fetch alerts', details: error.message },
            { status: 500 }
        );
    }
}

// PATCH /api/supervisor - Met à jour une alerte
export async function PATCH(req: Request) {
    const session = await getServerSession(authOptions);
    if (!session) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    try {
        const body = await req.json();
        const { alertId, status, adminNotes } = body;

        if (!alertId || !status) {
            return NextResponse.json(
                { error: 'alertId and status are required' },
                { status: 400 }
            );
        }

        await supervisorOrchestrator.updateAlertStatus(alertId, status, adminNotes);

        return NextResponse.json({ success: true });
    } catch (error: any) {
        console.error('[Supervisor API] PATCH failed:', error);
        return NextResponse.json(
            { error: 'Failed to update alert', details: error.message },
            { status: 500 }
        );
    }
}

// POST /api/supervisor/flush - Force le traitement du batch
export async function POST(req: Request) {
    const session = await getServerSession(authOptions);
    if (!session) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    try {
        const { action } = await req.json();

        if (action === 'flush') {
            await supervisorOrchestrator.flushBatch();
            return NextResponse.json({ success: true, message: 'Batch flushed' });
        }

        return NextResponse.json({ error: 'Unknown action' }, { status: 400 });
    } catch (error: any) {
        console.error('[Supervisor API] POST failed:', error);
        return NextResponse.json(
            { error: 'Failed to process action', details: error.message },
            { status: 500 }
        );
    }
}
