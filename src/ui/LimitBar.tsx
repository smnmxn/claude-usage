import { Box, Text } from 'ink'
import type { RateLimit } from '../api/types.js'
import { ProgressBar } from './progressBar.js'
import { formatRelative } from './formatReset.js'

type Props = {
  title: string
  limit: RateLimit
  width: number
  windowMs: number
  now: number
}

const PACE_EPSILON = 0.5

function colorFor(pct: number): string {
  if (pct >= 90) return 'red'
  if (pct >= 70) return 'yellow'
  return 'green'
}

function computeTargetPct(resetsAt: string | null, windowMs: number, now: number): number | null {
  if (!resetsAt) return null
  const end = Date.parse(resetsAt)
  if (Number.isNaN(end)) return null
  const start = end - windowMs
  const elapsed = now - start
  const pct = (elapsed / windowMs) * 100
  if (!Number.isFinite(pct)) return null
  return Math.min(100, Math.max(0, pct))
}

function markerColorFor(currentPct: number, targetPct: number): string {
  if (currentPct > targetPct + PACE_EPSILON) return 'red'
  if (currentPct < targetPct - PACE_EPSILON) return 'green'
  return 'white'
}

export function LimitBar({ title, limit, width, windowMs, now }: Props) {
  if (limit.utilization === null || limit.utilization === undefined) return null
  const pct = Math.floor(limit.utilization)
  const barWidth = Math.max(10, Math.min(50, width - 20))
  const subtext = limit.resets_at ? `Resets ${formatRelative(limit.resets_at, now)}` : null
  const targetPct = computeTargetPct(limit.resets_at, windowMs, now)
  const targetPctFloor = targetPct !== null ? Math.floor(targetPct) : null
  const markerRatio = targetPct !== null ? targetPct / 100 : undefined
  const markerColor =
    targetPct !== null ? markerColorFor(limit.utilization, targetPct) : undefined

  return (
    <Box flexDirection="column">
      <Text bold>{title}</Text>
      <Box flexDirection="row" gap={1}>
        <ProgressBar
          ratio={pct / 100}
          width={barWidth}
          fillColor={colorFor(pct)}
          markerRatio={markerRatio}
          markerColor={markerColor}
        />
        <Text>
          {pct}% used
          {targetPctFloor !== null ? ` (target ${targetPctFloor}%)` : ''}
        </Text>
      </Box>
      {subtext && <Text dimColor>{subtext}</Text>}
    </Box>
  )
}
