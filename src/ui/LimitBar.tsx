import { Box, Text } from 'ink'
import type { RateLimit } from '../api/types.js'
import { ProgressBar } from './progressBar.js'
import { formatRelative } from './formatReset.js'

type Props = {
  title: string
  limit: RateLimit
  width: number
}

function colorFor(pct: number): string {
  if (pct >= 90) return 'red'
  if (pct >= 70) return 'yellow'
  return 'green'
}

export function LimitBar({ title, limit, width }: Props) {
  if (limit.utilization === null || limit.utilization === undefined) return null
  const pct = Math.floor(limit.utilization)
  const barWidth = Math.max(10, Math.min(50, width - 20))
  const subtext = limit.resets_at ? `Resets ${formatRelative(limit.resets_at)}` : null

  return (
    <Box flexDirection="column">
      <Text bold>{title}</Text>
      <Box flexDirection="row" gap={1}>
        <ProgressBar ratio={pct / 100} width={barWidth} fillColor={colorFor(pct)} />
        <Text>{pct}% used</Text>
      </Box>
      {subtext && <Text dimColor>{subtext}</Text>}
    </Box>
  )
}
