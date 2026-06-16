'use client'

import { scoreLabel, scoreColor } from '@/lib/assertiva/client'

interface Props {
  score?: number
  size?: number
}

export function ScoreGauge({ score, size = 180 }: Props) {
  const r  = 70
  const cx = size / 2
  const cy = size / 2 + 10
  const sw = 14

  const zones = [
    { from: 0,   to: 300,  color: '#dc2626' },
    { from: 300, to: 500,  color: '#ef4444' },
    { from: 500, to: 650,  color: '#f59e0b' },
    { from: 650, to: 800,  color: '#22c55e' },
    { from: 800, to: 1000, color: '#10b981' },
  ]

  const toRad = (deg: number) => (deg * Math.PI) / 180
  const toAngle = (v: number) => -180 + (Math.max(0, Math.min(v, 1000)) / 1000) * 180

  function arcPath(startA: number, endA: number) {
    const x1 = cx + r * Math.cos(toRad(startA))
    const y1 = cy + r * Math.sin(toRad(startA))
    const x2 = cx + r * Math.cos(toRad(endA))
    const y2 = cy + r * Math.sin(toRad(endA))
    return `M ${x1} ${y1} A ${r} ${r} 0 0 1 ${x2} ${y2}`
  }

  const angle  = score != null ? toAngle(score) : null
  const color  = scoreColor(score)
  const label  = scoreLabel(score)

  const needle = angle != null ? {
    x: cx + (r - 4) * Math.cos(toRad(angle)),
    y: cy + (r - 4) * Math.sin(toRad(angle)),
  } : null

  return (
    <div className="flex flex-col items-center gap-2 select-none">
      <svg width={size} height={size * 0.65} viewBox={`0 0 ${size} ${size * 0.65}`}>
        {/* Background */}
        <path
          d={`M ${cx - r} ${cy} A ${r} ${r} 0 0 1 ${cx + r} ${cy}`}
          fill="none" stroke="currentColor" strokeWidth={sw} strokeLinecap="round"
          className="text-muted/30"
        />
        {/* Zones */}
        {zones.map(z => {
          const sa = -180 + (z.from / 1000) * 180
          const ea = -180 + (z.to   / 1000) * 180
          return (
            <path
              key={z.from}
              d={arcPath(sa, ea)}
              fill="none"
              stroke={z.color}
              strokeWidth={sw}
              strokeLinecap="round"
            />
          )
        })}
        {/* Needle */}
        {needle && (
          <>
            <line
              x1={cx} y1={cy} x2={needle.x} y2={needle.y}
              stroke={color} strokeWidth={3} strokeLinecap="round"
              style={{ transition: 'all 0.8s ease-out' }}
            />
            <circle cx={cx} cy={cy} r={6} fill={color} />
            <circle cx={cx} cy={cy} r={3} fill="white" />
          </>
        )}
        {/* Score */}
        <text x={cx} y={cy - 8} textAnchor="middle"
          fontSize={size * 0.18} fontWeight="800" fill={color} fontFamily="inherit">
          {score ?? '—'}
        </text>
        <text x={cx} y={cy + 12} textAnchor="middle"
          fontSize={size * 0.07} fill="currentColor" opacity="0.5" fontFamily="inherit">
          de 1000
        </text>
        <text x={cx - r - 4} y={cy + 18} fontSize={9} textAnchor="end" fill="#9CA3AF">0</text>
        <text x={cx + r + 4} y={cy + 18} fontSize={9} textAnchor="start" fill="#9CA3AF">1000</text>
      </svg>
      <span
        className="px-4 py-1 rounded-full text-xs font-bold tracking-wide"
        style={{ backgroundColor: `${color}20`, color }}
      >
        {label}
      </span>
    </div>
  )
}
