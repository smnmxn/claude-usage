import { Box, Text } from 'ink'
import type { ExtraUsage } from '../api/types.js'
import { ProgressBar } from './progressBar.js'

type Props = {
  extraUsage: ExtraUsage
  width: number
}

function formatCents(cents: number): string {
  return `$${(cents / 100).toFixed(2)}`
}

export function ExtraUsageBar({ extraUsage, width }: Props) {
  if (!extraUsage.is_enabled) return null
  if (extraUsage.monthly_limit === null) return null
  if (typeof extraUsage.used_credits !== 'number' || typeof extraUsage.utilization !== 'number') {
    return null
  }
  const pct = Math.floor(extraUsage.utilization)
  const barWidth = Math.max(10, Math.min(50, width - 20))
  const used = formatCents(extraUsage.used_credits)
  const total = formatCents(extraUsage.monthly_limit)

  return (
    <Box flexDirection="column">
      <Text bold>Extra usage (this month)</Text>
      <Box flexDirection="row" gap={1}>
        <ProgressBar ratio={pct / 100} width={barWidth} fillColor="cyan" />
        <Text>{pct}% used</Text>
      </Box>
      <Text dimColor>
        {used} of {total}
      </Text>
    </Box>
  )
}
