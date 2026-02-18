import { NextResponse } from 'next/server';
import { personaSchedule } from '@/lib/services/persona-schedule';

export const dynamic = 'force-dynamic';

export async function GET() {
    try {
        const activity = personaSchedule.getCurrentActivity();
        return NextResponse.json({
            status: activity.status, // 'AVAILABLE', 'BUSY', 'SLEEP'
            activity: activity.name,
            description: activity.description
        });
    } catch (error) {
        console.error('Error fetching persona schedule:', error);
        return NextResponse.json(
            { status: 'AVAILABLE', error: 'Failed to fetch schedule' },
            { status: 500 }
        );
    }
}
