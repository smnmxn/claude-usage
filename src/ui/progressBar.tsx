import { Text } from 'ink'

const BLOCKS = [' ', '▏', '▎', '▍', '▌', '▋', '▊', '▉', '█']

type Props = {
  ratio: number
  width: number
  fillColor?: string
  emptyColor?: string
}

export function ProgressBar({ ratio: input, width, fillColor, emptyColor }: Props) {
  const ratio = Math.min(1, Math.max(0, input))
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
  return (
    <Text color={fillColor} backgroundColor={emptyColor}>
      {segments.join('')}
    </Text>
  )
}
