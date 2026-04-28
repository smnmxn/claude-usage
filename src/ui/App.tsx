import React, { useCallback, useEffect, useRef, useState } from 'react'
import { Box, Text, useApp, useInput, useStdout } from 'ink'
import type { AxiosError } from 'axios'
import { fetchUtilization } from '../api/usage.js'
import type { Utilization } from '../api/types.js'
import { CredentialsMissingError } from '../auth/credentials.js'
import { TokenRefreshError } from '../auth/refresh.js'
import { LimitBar } from './LimitBar.js'
import { ExtraUsageBar } from './ExtraUsageBar.js'
import { formatAgo } from './formatReset.js'

type Props = {
  intervalSeconds: number
  initialShowAll?: boolean
  debug?: boolean
}

type DebugDetails = {
  status: number | null
  headers: Record<string, string> | null
  body: unknown
  at: number
}

type ErrorInfo = { message: string; fatal: boolean; rateLimited: boolean }

type State = {
  data: Utilization | null
  fetchedAt: number | null
  error: ErrorInfo | null
  debug: DebugDetails | null
}

const MAX_BACKOFF_MS = 10 * 60 * 1000

function parseRetryAfter(header: unknown): number | null {
  if (typeof header !== 'string') return null
  const seconds = Number(header)
  if (Number.isFinite(seconds) && seconds >= 0) return seconds * 1000
  const dateMs = Date.parse(header)
  if (!Number.isNaN(dateMs)) return Math.max(0, dateMs - Date.now())
  return null
}

function jitter(ms: number): number {
  return Math.round(ms * (0.85 + Math.random() * 0.3))
}

function normalizeHeaders(raw: unknown): Record<string, string> | null {
  if (!raw || typeof raw !== 'object') return null
  const out: Record<string, string> = {}
  for (const [k, v] of Object.entries(raw as Record<string, unknown>)) {
    if (v == null) continue
    out[k] = Array.isArray(v) ? v.join(', ') : String(v)
  }
  return out
}

export function App({ intervalSeconds, initialShowAll = false, debug = false }: Props) {
  const { exit } = useApp()
  const { stdout } = useStdout()
  const [state, setState] = useState<State>({ data: null, fetchedAt: null, error: null, debug: null })
  const [now, setNow] = useState(Date.now())
  const [nextFetchAt, setNextFetchAt] = useState(Date.now() + intervalSeconds * 1000)
  const [showAll, setShowAll] = useState(initialShowAll)
  const columns = stdout?.columns ?? 80

  const timerRef = useRef<NodeJS.Timeout | null>(null)
  const consecutiveRateLimitsRef = useRef(0)
  const cancelledRef = useRef(false)

  const clearTimer = () => {
    if (timerRef.current) {
      clearTimeout(timerRef.current)
      timerRef.current = null
    }
  }

  const schedule = useCallback((delayMs: number) => {
    clearTimer()
    setNextFetchAt(Date.now() + delayMs)
    timerRef.current = setTimeout(() => {
      void load()
    }, delayMs)
    // load is defined below; this works because schedule is called from inside load.
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const load = useCallback(async () => {
    if (cancelledRef.current) return
    try {
      const data = await fetchUtilization()
      if (cancelledRef.current) return
      consecutiveRateLimitsRef.current = 0
      setState((prev) => ({ ...prev, data, fetchedAt: Date.now(), error: null }))
      schedule(jitter(intervalSeconds * 1000))
    } catch (err) {
      if (cancelledRef.current) return
      const axiosErr = err as AxiosError
      const status = axiosErr.response?.status
      const fatal = err instanceof CredentialsMissingError
      const rateLimited = status === 429
      let nextDelayMs = intervalSeconds * 1000
      if (rateLimited) {
        consecutiveRateLimitsRef.current += 1
        const retryAfter = parseRetryAfter(axiosErr.response?.headers?.['retry-after'])
        const backoff = Math.min(
          MAX_BACKOFF_MS,
          60_000 * 2 ** (consecutiveRateLimitsRef.current - 1),
        )
        nextDelayMs = Math.max(retryAfter ?? 0, backoff, intervalSeconds * 1000)
      }
      nextDelayMs = jitter(nextDelayMs)
      const baseMessage =
        err instanceof CredentialsMissingError
          ? err.message
          : err instanceof TokenRefreshError
            ? err.message
            : err instanceof Error
              ? err.message
              : String(err)
      const message = rateLimited
        ? `Rate limited (HTTP 429). Backing off ${Math.round(nextDelayMs / 1000)}s.`
        : baseMessage
      const debugDetails: DebugDetails | null = debug
        ? {
            status: status ?? null,
            headers: normalizeHeaders(axiosErr.response?.headers),
            body: axiosErr.response?.data ?? null,
            at: Date.now(),
          }
        : null
      setState((prev) => ({
        ...prev,
        error: { message, fatal, rateLimited },
        debug: debugDetails ?? prev.debug,
      }))
      if (!fatal) schedule(nextDelayMs)
    }
  }, [debug, intervalSeconds, schedule])

  useEffect(() => {
    cancelledRef.current = false
    void load()
    return () => {
      cancelledRef.current = true
      clearTimer()
    }
  }, [load])

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(id)
  }, [])

  useEffect(() => {
    if (process.stdout.isTTY) {
      process.stdout.write('\x1B[2J\x1B[3J\x1B[H')
    }
  }, [showAll])

  useInput((input, key) => {
    if (input === 'q' || key.escape || (key.ctrl && input === 'c')) {
      exit()
      return
    }
    if (input === 'r') {
      consecutiveRateLimitsRef.current = 0
      void load()
      return
    }
    if (input === 'a') {
      setShowAll((prev) => !prev)
    }
  })

  const width = Math.min(columns - 2, 80)

  const { data, error, fetchedAt, debug: debugDetails } = state
  const stale = data !== null && error !== null

  return (
    <Box flexDirection="column" gap={1} width="100%">
      <Text bold color="magenta">claude-usage</Text>

      {error && (
        <Box flexDirection="column">
          <Text color={error.rateLimited ? 'yellow' : 'red'}>
            {stale ? 'Stale: ' : 'Error: '}
            {error.message}
          </Text>
          {error.fatal ? (
            <Text dimColor>Press q to quit.</Text>
          ) : (
            <Text dimColor>Showing last successful data. Press r to retry, q to quit.</Text>
          )}
        </Box>
      )}

      {data !== null && <Bars data={data} width={width} now={now} />}

      {data === null && !error && <Text dimColor>Loading usage data…</Text>}

      {data !== null && showAll && <RawDetails data={data} />}

      {debug && debugDetails && <DebugPanel details={debugDetails} />}

      <Footer fetchedAt={fetchedAt} now={now} nextFetchAt={nextFetchAt} showAll={showAll} />
    </Box>
  )
}

function RawDetails({ data }: { data: Utilization }) {
  return (
    <Box flexDirection="column" borderStyle="single" borderColor="gray" paddingX={1}>
      <Text bold>All fields</Text>
      <Text>{JSON.stringify(data, null, 2)}</Text>
    </Box>
  )
}

function DebugPanel({ details }: { details: DebugDetails }) {
  const headerLines = details.headers
    ? Object.entries(details.headers).map(([k, v]) => `  ${k}: ${v}`)
    : ['  (no headers)']
  const bodyText =
    details.body == null
      ? '(empty)'
      : typeof details.body === 'string'
        ? details.body
        : JSON.stringify(details.body, null, 2)
  const ago = formatAgo(details.at)
  return (
    <Box flexDirection="column" borderStyle="single" borderColor="yellow" paddingX={1}>
      <Text bold color="yellow">Last error response ({ago})</Text>
      <Text>Status: {details.status ?? 'no response'}</Text>
      <Text>Headers:</Text>
      <Text>{headerLines.join('\n')}</Text>
      <Text>Body:</Text>
      <Text>{bodyText}</Text>
    </Box>
  )
}

const FIVE_HOURS_MS = 5 * 60 * 60 * 1000
const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000

function Bars({ data, width, now }: { data: Utilization; width: number; now: number }) {
  const bars: React.ReactNode[] = []
  if (data.five_hour) {
    bars.push(
      <LimitBar
        key="5h"
        title="Current session (5h)"
        limit={data.five_hour}
        width={width}
        windowMs={FIVE_HOURS_MS}
        now={now}
      />,
    )
  }
  if (data.seven_day) {
    bars.push(
      <LimitBar
        key="7d"
        title="Current week (all models)"
        limit={data.seven_day}
        width={width}
        windowMs={SEVEN_DAYS_MS}
        now={now}
      />,
    )
  }
  if (data.seven_day_sonnet) {
    bars.push(
      <LimitBar
        key="7ds"
        title="Current week (Sonnet only)"
        limit={data.seven_day_sonnet}
        width={width}
        windowMs={SEVEN_DAYS_MS}
        now={now}
      />,
    )
  }
  if (data.seven_day_opus) {
    bars.push(
      <LimitBar
        key="7do"
        title="Current week (Opus only)"
        limit={data.seven_day_opus}
        width={width}
        windowMs={SEVEN_DAYS_MS}
        now={now}
      />,
    )
  }
  if (data.extra_usage) {
    bars.push(<ExtraUsageBar key="extra" extraUsage={data.extra_usage} width={width} />)
  }
  if (bars.length === 0) {
    return <Text dimColor>No usage data available. /usage requires a Claude.ai subscription.</Text>
  }
  return <Box flexDirection="column" gap={1}>{bars}</Box>
}

function Footer({
  fetchedAt,
  now,
  nextFetchAt,
  showAll,
}: {
  fetchedAt: number | null
  now: number
  nextFetchAt: number
  showAll: boolean
}) {
  const secondsToNext = Math.max(0, Math.ceil((nextFetchAt - now) / 1000))
  const ago = fetchedAt ? formatAgo(fetchedAt, now) : '—'
  return (
    <Text dimColor>
      Updated {ago} · next refresh in {secondsToNext}s · r refresh · a {showAll ? 'hide' : 'show'} raw · q quit
    </Text>
  )
}
