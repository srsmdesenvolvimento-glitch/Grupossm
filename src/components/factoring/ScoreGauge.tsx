'use client'

import { useEffect, useRef, useState } from 'react'

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
  { min: 0,  max: 30,  color: '#EF4444', label: 'Crítico',     desc: 'Negar crédito' },
  { min: 30, max: 50,  color: '#F97316', label: 'Alto Risco',  desc: 'Analisar com cautela' },
  { min: 50, max: 70,  color: '#D4A528', label: 'Médio Risco', desc: 'Analisar caso' },
  { min: 70, max: 101, color: '#16A34A', label: 'Baixo Risco', desc: 'Aprovar crédito' },
]

function getZone(score: number) {
  return SCORE_ZONES.find(z => score >= z.min && score < z.max) ?? SCORE_ZONES[0]
}

// Arc math: 240° gauge from 210° to -30° (clockwise)
// In SVG coords: angle 0 = right, increases clockwise
// startAngle = 210° (lower-left), endAngle = 210° + 240° = 450° = 90° (bottom)
// But we want the gauge top-arc style: from lower-left, sweeping through top, to lower-right
// Using polar: startAngle=210°, sweep=240° clockwise to 210°+240°=450°=90° → that's bottom
// Classic speedometer: start 225°, end -45° (going clockwise through 0/top)
// Let's use: startAngle=215°, sweep=250° → endAngle=215°+250°=465°=105°

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

// Zone segments — each zone covers proportional degrees of the 250° arc
function buildZoneSegments(cx: number, cy: number, r: number, strokeWidth: number) {
  // zones: 0-30 (30%), 30-50 (20%), 50-70 (20%), 70-100 (30%)
  const segments = [
    { color: '#EF4444', from: 0,  to: 30 },
    { color: '#F97316', from: 30, to: 50 },
    { color: '#D4A528', from: 50, to: 70 },
    { color: '#16A34A', from: 70, to: 100 },
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
  // Shift center down slightly so arc top clears the viewbox
  const cy = px * 0.52
  const sw = cfg.strokeWidth
  const r  = cx - sw / 2 - 4

  const clampedScore = Math.max(0, Math.min(100, Math.round(score)))
  const zone = getZone(clampedScore)

  // Full arc circumference via strokeDasharray on a circle
  const circumference = 2 * Math.PI * r
  const arcFraction = SWEEP_DEG / 360
  const arcLength = circumference * arcFraction
  const fillLength = arcLength * (clampedScore / 100)
  const targetOffset = arcLength - fillLength

  // Animation
  const [offset, setOffset] = useState(arcLength) // start empty
  const prefersReducedMotion = useRef(false)

  useEffect(() => {
    prefersReducedMotion.current =
      typeof window !== 'undefined' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches

    if (!animated || prefersReducedMotion.current) {
      setOffset(targetOffset)
      return
    }

    // Start from empty, animate to fill
    setOffset(arcLength)
    const raf = requestAnimationFrame(() => {
      const timeout = setTimeout(() => {
        setOffset(targetOffset)
      }, 50)
      return () => clearTimeout(timeout)
    })
    return () => cancelAnimationFrame(raf)
  }, [clampedScore, arcLength, targetOffset, animated])

  // Track path (full arc, gray)
  const trackPath = describeArc(cx, cy, r, START_DEG, SWEEP_DEG)

  // Score fill path — full arc path, but controlled via strokeDashoffset
  // We draw the full arc as a single path and use dash trick
  const fillPath = describeArc(cx, cy, r, START_DEG, SWEEP_DEG)

  // Zone segments (decorative background zones)
  const zoneSegs = buildZoneSegments(cx, cy, r, sw)

  // Text positions
  const scoreY = cy + (size === 'sm' ? 4 : size === 'md' ? 6 : 8)
  const labelY = cy + (size === 'sm' ? 16 : size === 'md' ? 24 : 34)
  const descY  = cy + (size === 'sm' ? 24 : size === 'md' ? 36 : 50)

  const transition = animated && !prefersReducedMotion.current
    ? 'stroke-dashoffset 1.2s ease-out'
    : 'none'

  return (
    <svg
      width={px}
      height={px}
      viewBox={`0 0 ${px} ${px}`}
      aria-label={`Score ${clampedScore} — ${zone.label}`}
      role="img"
      style={{ overflow: 'visible' }}
    >
      {/* Zone segments (subtle color bands as track) */}
      {zoneSegs.map((seg, i) => (
        <path
          key={i}
          d={seg.d}
          fill="none"
          stroke={seg.color}
          strokeWidth={sw}
          strokeLinecap="butt"
          opacity={0.18}
        />
      ))}

      {/* Gray track */}
      <path
        d={trackPath}
        fill="none"
        stroke="#E2E8F0"
        strokeWidth={sw}
        strokeLinecap="round"
        opacity={0.6}
      />

      {/* Colored fill arc via dashoffset animation */}
      <path
        d={fillPath}
        fill="none"
        stroke={zone.color}
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
          fill="#475569"
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
          fill="#94A3B8"
          fontFamily="inherit"
        >
          {zone.desc}
        </text>
      )}
    </svg>
  )
}
