'use client'

import { useEffect, useState } from 'react'

interface ScoreGaugeProps {
  score: number
  size?: 'sm' | 'md' | 'lg'
  showLabel?: boolean
  showDescription?: boolean
  animated?: boolean
}

const SIZE_CONFIG = {
  sm:  { px: 80,  strokeWidth: 7,  fontSize: 18, labelSize: 8,  descSize: 6 },
  md:  { px: 140, strokeWidth: 10, fontSize: 28, labelSize: 11, descSize: 9 },
  lg:  { px: 200, strokeWidth: 14, fontSize: 40, labelSize: 14, descSize: 11 },
}

const SCORE_ZONES = [
  { min: 0,  max: 30,  color: '#EA4335', label: 'Crítico',     desc: 'Negar crédito' },
  { min: 30, max: 50,  color: '#FA903E', label: 'Alto Risco',  desc: 'Analisar com cautela' },
  { min: 50, max: 70,  color: '#FBBC04', label: 'Médio Risco', desc: 'Analisar caso' },
  { min: 70, max: 101, color: '#34A853', label: 'Baixo Risco', desc: 'Aprovar crédito' },
]

function getZone(score: number) {
  return SCORE_ZONES.find(z => score >= z.min && score < z.max) ?? SCORE_ZONES[0]
}

const START_DEG = 215
const SWEEP_DEG = 250

function polarToXY(cx: number, cy: number, r: number, deg: number) {
  const rad = (deg * Math.PI) / 180
  return {
    x: cx + r * Math.cos(rad),
    y: cy + r * Math.sin(rad),
  }
}

function describeArc(cx: number, cy: number, r: number, startDeg: number, sweepDeg: number) {
  const start = polarToXY(cx, cy, r, startDeg)
  const end = polarToXY(cx, cy, r, startDeg + sweepDeg)
  const largeArc = sweepDeg > 180 ? 1 : 0
  return `M ${start.x} ${start.y} A ${r} ${r} 0 ${largeArc} 1 ${end.x} ${end.y}`
}

function buildZoneSegments(cx: number, cy: number, r: number, strokeWidth: number) {
  const segments = [
    { color: '#EA4335', from: 0,  to: 30 },
    { color: '#FA903E', from: 30, to: 50 },
    { color: '#FBBC04', from: 50, to: 70 },
    { color: '#34A853', from: 70, to: 100 },
  ]

  return segments.map(seg => {
    const startDeg = START_DEG + (seg.from / 100) * SWEEP_DEG
    const endDeg   = START_DEG + (seg.to   / 100) * SWEEP_DEG
    const sweep    = endDeg - startDeg
    const start    = polarToXY(cx, cy, r, startDeg)
    const end      = polarToXY(cx, cy, r, endDeg)
    const largeArc = sweep > 180 ? 1 : 0
    const d = `M ${start.x} ${start.y} A ${r} ${r} 0 ${largeArc} 1 ${end.x} ${end.y}`
    return { d, color: seg.color }
  })
}

export function ScoreGauge({
  score,
  size = 'md',
  showLabel = true,
  showDescription = false,
  animated = true,
}: ScoreGaugeProps) {
  const cfg = SIZE_CONFIG[size]
  const px = cfg.px
  const cx = px / 2
  const cy = px * 0.52
  const sw = cfg.strokeWidth
  const r  = cx - sw / 2 - 4

  const clampedScore = Math.max(0, Math.min(100, Math.round(score)))
  const zone = getZone(clampedScore)

  const circumference = 2 * Math.PI * r
  const arcFraction = SWEEP_DEG / 360
  const arcLength = circumference * arcFraction
  const fillLength = arcLength * (clampedScore / 100)
  const targetOffset = arcLength - fillLength

  const [offset, setOffset] = useState(arcLength)
  const [transition, setTransition] = useState('none')

  useEffect(() => {
    const prefersReduced =
      typeof window !== 'undefined' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches

    if (animated && !prefersReduced) {
      setTransition('stroke-dashoffset 1.2s cubic-bezier(0.22, 1, 0.36, 1)')
    } else {
      setTransition('none')
    }

    if (!animated || prefersReduced) {
      setOffset(targetOffset)
      return
    }

    setOffset(arcLength)
    const raf = requestAnimationFrame(() => {
      const timeout = setTimeout(() => {
        setOffset(targetOffset)
      }, 50)
      return () => clearTimeout(timeout)
    })
    return () => cancelAnimationFrame(raf)
  }, [clampedScore, arcLength, targetOffset, animated])

  const trackPath = describeArc(cx, cy, r, START_DEG, SWEEP_DEG)
  const fillPath = describeArc(cx, cy, r, START_DEG, SWEEP_DEG)
  const zoneSegs = buildZoneSegments(cx, cy, r, sw)

  const scoreY = cy + (size === 'sm' ? 4 : size === 'md' ? 6 : 8)
  const labelY = cy + (size === 'sm' ? 16 : size === 'md' ? 24 : 34)
  const descY  = cy + (size === 'sm' ? 24 : size === 'md' ? 36 : 50)

  return (
    <svg
      width={px}
      height={px}
      viewBox={`0 0 ${px} ${px}`}
      aria-label={`Score ${clampedScore} — ${zone.label}`}
      role="img"
      style={{ overflow: 'visible' }}
    >
      {/* Drop shadow filter for the fill arc */}
      <defs>
        <filter id={`gauge-glow-${size}`} x="-20%" y="-20%" width="140%" height="140%">
          <feGaussianBlur in="SourceGraphic" stdDeviation="2" />
        </filter>
        <linearGradient id={`gauge-grad-${size}`} x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor={zone.color} stopOpacity="1" />
          <stop offset="100%" stopColor={zone.color} stopOpacity="0.7" />
        </linearGradient>
      </defs>

      {/* Zone segments (subtle color bands as track) */}
      {zoneSegs.map((seg, i) => (
        <path
          key={i}
          d={seg.d}
          fill="none"
          stroke={seg.color}
          strokeWidth={sw}
          strokeLinecap="butt"
          opacity={0.12}
        />
      ))}

      {/* Gray track */}
      <path
        d={trackPath}
        fill="none"
        stroke="var(--border)"
        strokeWidth={sw}
        strokeLinecap="round"
        opacity={0.5}
      />

      {/* Glow effect behind fill */}
      <path
        d={fillPath}
        fill="none"
        stroke={zone.color}
        strokeWidth={sw + 4}
        strokeLinecap="round"
        strokeDasharray={`${arcLength} ${circumference}`}
        strokeDashoffset={offset}
        style={{ transition }}
        opacity={0.15}
        filter={`url(#gauge-glow-${size})`}
      />

      {/* Colored fill arc */}
      <path
        d={fillPath}
        fill="none"
        stroke={`url(#gauge-grad-${size})`}
        strokeWidth={sw}
        strokeLinecap="round"
        strokeDasharray={`${arcLength} ${circumference}`}
        strokeDashoffset={offset}
        style={{ transition }}
      />

      {/* Score number */}
      <text
        x={cx}
        y={scoreY}
        textAnchor="middle"
        dominantBaseline="middle"
        fontSize={cfg.fontSize}
        fontWeight="800"
        fill={zone.color}
        fontFamily="inherit"
        letterSpacing="-0.02em"
      >
        {clampedScore}
      </text>

      {/* Risk label */}
      {showLabel && (
        <text
          x={cx}
          y={labelY}
          textAnchor="middle"
          dominantBaseline="middle"
          fontSize={cfg.labelSize}
          fontWeight="600"
          fill="var(--muted-foreground)"
          fontFamily="inherit"
        >
          {zone.label}
        </text>
      )}

      {/* Description */}
      {showDescription && (
        <text
          x={cx}
          y={descY}
          textAnchor="middle"
          dominantBaseline="middle"
          fontSize={cfg.descSize}
          fontWeight="400"
          fill="var(--muted-foreground)"
          fontFamily="inherit"
          opacity="0.7"
        >
          {zone.desc}
        </text>
      )}
    </svg>
  )
}
