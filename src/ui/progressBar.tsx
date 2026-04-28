import { Box, Text } from 'ink'

const BLOCKS = [' ', '▏', '▎', '▍', '▌', '▋', '▊', '▉', '█']

type Props = {
  ratio: number
  width: number
  fillColor?: string
  emptyColor?: string
  markerRatio?: number
  markerColor?: string
  markerChar?: string
}

function buildBar(ratio: number, width: number): string {
  const whole = Math.floor(ratio * width)
  const last = BLOCKS[BLOCKS.length - 1] ?? '█'
  const segments: string[] = [last.repeat(whole)]
  if (whole < width) {
    const remainder = ratio * width - whole
    const middle = Math.min(BLOCKS.length - 1, Math.floor(remainder * BLOCKS.length))
    segments.push(BLOCKS[middle] ?? ' ')
    const empty = width - whole - 1
    if (empty > 0) segments.push((BLOCKS[0] ?? ' ').repeat(empty))
  }
  return segments.join('')
}

export function ProgressBar({
  ratio: input,
  width,
  fillColor,
  emptyColor,
  markerRatio,
  markerColor,
  markerChar = '│',
}: Props) {
  const ratio = Math.min(1, Math.max(0, input))
  const bar = buildBar(ratio, width)

  if (markerRatio === undefined || !Number.isFinite(markerRatio)) {
    return (
      <Text color={fillColor} backgroundColor={emptyColor}>
        {bar}
      </Text>
    )
  }

  const clampedMarker = Math.min(1, Math.max(0, markerRatio))
  const markerCol = Math.min(width - 1, Math.max(0, Math.round(clampedMarker * width)))
  const pre = bar.slice(0, markerCol)
  const post = bar.slice(markerCol + 1)

  return (
    <Box flexDirection="row">
      {pre.length > 0 && (
        <Text color={fillColor} backgroundColor={emptyColor}>
          {pre}
        </Text>
      )}
      <Text color={markerColor} backgroundColor={emptyColor} bold>
        {markerChar}
      </Text>
      {post.length > 0 && (
        <Text color={fillColor} backgroundColor={emptyColor}>
          {post}
        </Text>
      )}
    </Box>
  )
}
