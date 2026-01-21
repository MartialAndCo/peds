import React from 'react'

interface ChartDataPoint {
    name: string | number
    [key: string]: any
}

interface NativeChartProps {
    data: ChartDataPoint[]
    dataKey: string
    categoryKey?: string
    height?: number
    color?: string
    showXAxis?: boolean
    className?: string
}

export function NativeAreaChart({
    data,
    dataKey,
    categoryKey = 'name',
    height = 200,
    color = '#3b82f6',
    showXAxis = true,
    className = ''
}: NativeChartProps) {
    if (!data || data.length === 0) return null

    // precise calculations
    const values = data.map(d => Number(d[dataKey]) || 0)
    const max = Math.max(...values, 1)
    const min = 0 // always start at 0 for area charts

    // dimensions (viewBox)
    const width = 100
    const chartHeight = 100

    // generate path
    const stepX = width / (data.length - 1 || 1)

    const points = values.map((val, i) => {
        const x = i * stepX
        const y = chartHeight - ((val - min) / (max - min)) * chartHeight
        return `${x},${y}`
    })

    const strokePath = points.join(' L ')
    const fillPath = `0,${chartHeight} L ${strokePath} L ${width},${chartHeight} Z`

    return (
        <div className={`w-full flex flex-col ${className}`} style={{ height: `${height}px` }}>
            <div className="flex-1 w-full relative overflow-hidden">
                <svg
                    viewBox={`0 0 ${width} ${chartHeight}`}
                    preserveAspectRatio="none"
                    className="w-full h-full block"
                >
                    <defs>
                        <linearGradient id={`gradient-${dataKey}`} x1="0" x2="0" y1="0" y2="1">
                            <stop offset="0%" stopColor={color} stopOpacity="0.3" />
                            <stop offset="100%" stopColor={color} stopOpacity="0" />
                        </linearGradient>
                        <mask id={`mask-${dataKey}`}>
                            <path d={`M ${fillPath}`} fill="white" />
                        </mask>
                    </defs>

                    {/* Area Fill */}
                    <path
                        d={`M ${fillPath}`}
                        fill={`url(#gradient-${dataKey})`}
                        strokeWidth="0"
                    />

                    {/* Stroke Line */}
                    <path
                        d={`M ${strokePath}`}
                        fill="none"
                        stroke={color}
                        strokeWidth="2"
                        vectorEffect="non-scaling-stroke"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                    />
                </svg>
            </div>

            {showXAxis && (
                <div className="flex justify-between px-1 mt-2 text-[10px] text-white/40 font-mono">
                    {/* Show only first, middle, last to avoid crowding */}
                    <span>{data[0]?.[categoryKey]}</span>
                    {data.length > 2 && <span>{data[Math.floor(data.length / 2)]?.[categoryKey]}</span>}
                    {data.length > 1 && <span>{data[data.length - 1]?.[categoryKey]}</span>}
                </div>
            )}
        </div>
    )
}

export function NativeBarChart({
    data,
    dataKey,
    categoryKey = 'name',
    height = 200,
    color = '#ffffff',
    showXAxis = true,
    className = ''
}: NativeChartProps) {
    if (!data || data.length === 0) return null

    const values = data.map(d => Number(d[dataKey]) || 0)
    const max = Math.max(...values, 1)

    return (
        <div className={`w-full flex flex-col ${className}`} style={{ height: `${height}px` }}>
            <div className="flex-1 w-full flex items-end justify-between gap-1">
                {data.map((d, i) => {
                    const val = Number(d[dataKey]) || 0
                    const percentage = (val / max) * 100
                    return (
                        <div key={i} className="flex flex-col items-center flex-1 h-full justify-end group">
                            {/* Tooltip emulation */}
                            <div className="hidden group-hover:block absolute bottom-full mb-2 bg-slate-800 border border-white/10 text-white text-xs px-2 py-1 rounded shadow-xl z-50 whitespace-nowrap">
                                {d[categoryKey]}: {val}
                            </div>

                            <div
                                className="w-full rounded-t-sm transition-all duration-500 ease-out hover:opacity-80 relative"
                                style={{
                                    height: `${percentage}%`,
                                    backgroundColor: color,
                                    opacity: 0.8
                                }}
                            >
                            </div>
                        </div>
                    )
                })}
            </div>
            {showXAxis && (
                <div className="flex justify-between px-1 mt-2 text-[10px] text-white/40 font-mono">
                    {/* Simplified Axis */}
                    <span>{data[0]?.[categoryKey]}</span>
                    <span>{data[data.length - 1]?.[categoryKey]}</span>
                </div>
            )}
        </div>
    )
}
