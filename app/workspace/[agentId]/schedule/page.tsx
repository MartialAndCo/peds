import { personaSchedule } from '@/lib/services/persona-schedule'
import { prisma } from '@/lib/prisma'
import { Clock, Moon, Sun, BookOpen, Tv, Utensils, Bus, Coffee, Music, Phone, BedDouble, Smartphone, CircleDot } from 'lucide-react'
import { toZonedTime } from 'date-fns-tz'

export const dynamic = 'force-dynamic'

// Map activity names to icons
function getActivityIcon(name: string) {
    const iconMap: Record<string, any> = {
        'Sommeil': Moon,
        'Sommeil Profond': Moon,
        'Grasse Matinée': BedDouble,
        'Réveil': Sun,
        'Pause Déj': Utensils,
        'Transport': Bus,
        'Goûter': Coffee,
        'Repas': Utensils,
        'Netflix': Tv,
        'TikTok': Smartphone,
        'Instagram': Smartphone,
        'Musique': Music,
        'Télé': Tv,
        'Lit': BedDouble,
        'Appel': Phone,
        'Devoirs Maths': BookOpen,
        'Devoirs Français': BookOpen,
        'Révisions': BookOpen,
        'Temps Libre': Smartphone,
        'Insomnie Tel': Smartphone,
    }

    // Check for "Cours de" prefix
    if (name.startsWith('Cours de')) {
        return BookOpen
    }

    return iconMap[name] || CircleDot
}

// Generate full week schedule
function generateWeeklySchedule(timezone: string) {
    const days = ['Dimanche', 'Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi']
    const schedule: Record<string, { hour: number, activity: ReturnType<typeof personaSchedule.getCurrentActivity> }[]> = {}

    // For each day
    for (let dayOffset = 0; dayOffset < 7; dayOffset++) {
        // Calculate the day index based on the *Agent's* current day in their timezone
        const nowZoned = toZonedTime(new Date(), timezone)
        const currentDayIndex = nowZoned.getDay()

        const dayIndex = (currentDayIndex + dayOffset) % 7
        const dayName = days[dayIndex]
        schedule[dayName] = []

        // For each hour (7h - 23h for display)
        for (let hour = 7; hour <= 23; hour++) {
            // Mock the day for the schedule generation logic 
            // Logic in generateWeeklySchedule needs to replicate persona-schedule.ts logic relative to that day
            // Since persona-schedule.ts uses `new Date()` internally and zones it, we need to trick it or replicate logic.
            // Actually, the `personaSchedule` service doesn't expose a "get schedule for day X" method, it calculates based on "now".
            // But we reproduced the logic in the previous file. I'll stick to the reproduced logic here for display.

            const isWeekend = dayIndex === 0 || dayIndex === 6
            let activity: ReturnType<typeof personaSchedule.getCurrentActivity>

            // Sleep
            if (hour >= 3 && hour < 7) {
                activity = { name: 'Sommeil Profond', description: 'en train de dormir', status: 'SLEEP' }
            } else if (hour >= 7 && hour < 8) {
                activity = isWeekend
                    ? { name: 'Sommeil', description: 'en train de dormir', status: 'SLEEP' }
                    : { name: 'Réveil', description: 'en train de me préparer', status: 'AVAILABLE' }
            } else if (isWeekend && hour >= 8 && hour < 11) {
                activity = { name: 'Grasse Matinée', description: 'grasse mat\'', status: 'SLEEP' }
            } else if (!isWeekend && hour >= 8 && hour < 15) {
                if (hour === 12) {
                    activity = { name: 'Pause Déj', description: 'à la cantine', status: 'AVAILABLE' }
                } else {
                    const subjects: Record<number, string[]> = {
                        1: ['Maths', 'Français', 'Histoire-Géo', 'Anglais', 'SVT'],
                        2: ['Physique-Chimie', 'Sport', 'Maths', 'Français', 'Musique'],
                        3: ['Anglais', 'Maths', 'Arts Plastiques', 'Histoire-Géo', 'Français'],
                        4: ['SVT', 'Français', 'Maths', 'Sport', 'Technologie'],
                        5: ['Histoire-Géo', 'Anglais', 'Physique-Chimie', 'Maths', 'Vie de Classe'],
                    }
                    const subjectList = subjects[dayIndex] || subjects[1]
                    const subjectIndex = Math.min(hour - 8, subjectList.length - 1)
                    activity = { name: `Cours de ${subjectList[subjectIndex]}`, description: `en cours`, status: 'BUSY' }
                }
            } else if (!isWeekend && hour === 15) {
                activity = { name: 'Transport', description: 'dans le bus', status: 'AVAILABLE' }
            } else if (hour === 16) {
                activity = { name: 'Goûter', description: 'goûter / chill', status: 'AVAILABLE' }
            } else if (hour >= 17 && hour < 19) {
                activity = hour % 2 === 0
                    ? { name: 'Devoirs', description: 'devoirs', status: 'AVAILABLE' }
                    : { name: 'TikTok', description: 'sur TikTok', status: 'AVAILABLE' }
            } else if (hour === 19) {
                activity = { name: 'Repas', description: 'manger avec ma famille', status: 'AVAILABLE' }
            } else if (hour >= 20 && hour < 23) {
                const activities = ['Netflix', 'TikTok', 'Instagram', 'Musique', 'Lit']
                activity = { name: activities[(hour + dayIndex) % activities.length], description: 'temps libre', status: 'AVAILABLE' }
            } else {
                activity = { name: 'Temps Libre', description: 'tranquille', status: 'AVAILABLE' }
            }

            schedule[dayName].push({ hour, activity })
        }
    }

    return schedule
}

// Status badge component
function StatusBadge({ status }: { status: string }) {
    const colors = {
        AVAILABLE: 'bg-green-500/20 text-green-400',
        BUSY: 'bg-yellow-500/20 text-yellow-400',
        SLEEP: 'bg-white/10 text-white/40'
    }
    const labels = {
        AVAILABLE: 'Dispo',
        BUSY: 'Occupée',
        SLEEP: 'Dort'
    }
    return (
        <span className={`text-xs px-2 py-0.5 rounded-full ${colors[status as keyof typeof colors]}`}>
            {labels[status as keyof typeof labels]}
        </span>
    )
}

export default async function SchedulePage({ params }: { params: Promise<{ agentId: string }> }) {
    const { agentId } = await params

    // Fetch Agent Profile
    const agentProfile = await prisma.agentProfile.findUnique({
        where: { agentId },
        include: { agent: true }
    })

    const timezone = agentProfile?.timezone || 'Europe/Paris'
    const currentActivity = personaSchedule.getCurrentActivity(timezone)
    const weeklySchedule = generateWeeklySchedule(timezone)
    const days = Object.keys(weeklySchedule)

    // Calculate current day/hour in Agent's Timezone
    const nowZoned = toZonedTime(new Date(), timezone)
    const currentDay = ['Dimanche', 'Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi'][nowZoned.getDay()]
    const currentHour = nowZoned.getHours()

    return (
        <div className="space-y-8">
            {/* Header */}
            <div className="mb-8">
                <h1 className="text-2xl font-semibold text-white">Life Schedule</h1>
                <p className="text-white/40 text-sm mt-1">
                    Simulation de vie pour <span className="text-white font-medium">{agentProfile?.agent?.name || 'l\'agent'}</span> (Timezone: {timezone})
                </p>
            </div>

            {/* Current Activity Card */}
            <div className="glass rounded-2xl p-6">
                <div className="flex items-center gap-4">
                    <div className="w-12 h-12 rounded-xl bg-white/10 flex items-center justify-center">
                        {(() => {
                            const Icon = getActivityIcon(currentActivity.name)
                            return <Icon className="w-6 h-6 text-white" />
                        })()}
                    </div>
                    <div className="flex-1">
                        <div className="flex items-center gap-2">
                            <span className="text-white font-medium">{currentActivity.name}</span>
                            <StatusBadge status={currentActivity.status} />
                        </div>
                        <p className="text-white/40 text-sm">{currentActivity.description}</p>
                    </div>
                    <div className="text-right">
                        <div className="flex items-center gap-2 text-white/60">
                            <Clock className="w-4 h-4" />
                            <span className="font-mono">
                                {nowZoned.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit', timeZone: timezone })}
                            </span>
                        </div>
                        <p className="text-white/20 text-xs mt-1">Heure locale agent</p>
                    </div>
                </div>
            </div>

            {/* Weekly Grid */}
            <div className="glass rounded-2xl p-6 overflow-x-auto">
                <table className="w-full min-w-[800px]">
                    <thead>
                        <tr>
                            <th className="text-left text-white/40 text-sm font-medium p-2 w-16">Heure</th>
                            {days.map(day => (
                                <th key={day} className={`text-center text-sm font-medium p-2 ${day === currentDay ? 'text-white' : 'text-white/40'}`}>
                                    {day === currentDay && <span className="inline-block w-2 h-2 bg-green-400 rounded-full mr-2"></span>}
                                    {day.substring(0, 3)}
                                </th>
                            ))}
                        </tr>
                    </thead>
                    <tbody>
                        {/* Hours 7-23 */}
                        {Array.from({ length: 17 }, (_, i) => i + 7).map(hour => (
                            <tr key={hour} className="border-t border-white/5">
                                <td className="text-white/40 text-sm p-2 font-mono">{hour}h</td>
                                {days.map(day => {
                                    const slot = weeklySchedule[day].find(s => s.hour === hour)
                                    if (!slot) return <td key={day} className="p-1"></td>

                                    const isCurrentSlot = day === currentDay && hour === currentHour
                                    const Icon = getActivityIcon(slot.activity.name)

                                    const bgColors = {
                                        AVAILABLE: isCurrentSlot ? 'bg-green-500/30' : 'bg-green-500/10',
                                        BUSY: isCurrentSlot ? 'bg-yellow-500/30' : 'bg-yellow-500/10',
                                        SLEEP: isCurrentSlot ? 'bg-white/20' : 'bg-white/5'
                                    }

                                    return (
                                        <td key={day} className="p-1">
                                            <div className={`rounded-lg p-2 ${bgColors[slot.activity.status]} ${isCurrentSlot ? 'ring-1 ring-white/30' : ''} cursor-pointer hover:bg-white/10 transition-colors`} title={slot.activity.name}>
                                                <div className="flex items-center justify-center gap-1">
                                                    <Icon className="w-3 h-3 text-white/60" />
                                                    <span className="text-xs text-white/60 truncate max-w-[60px]">
                                                        {slot.activity.name.replace('Cours de ', '')}
                                                    </span>
                                                </div>
                                            </div>
                                        </td>
                                    )
                                })}
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>

            {/* Legend */}
            <div className="flex items-center gap-6 text-sm text-white/40">
                <div className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded bg-green-500/30"></div>
                    <span>Disponible</span>
                </div>
                <div className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded bg-yellow-500/30"></div>
                    <span>En cours (25-45min delay)</span>
                </div>
                <div className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded bg-white/10"></div>
                    <span>Dort (Ghost)</span>
                </div>
            </div>
        </div>
    )
}
