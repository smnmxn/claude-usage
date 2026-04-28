import { render } from 'ink'
import meow from 'meow'
import type { AxiosError } from 'axios'
import { App } from './ui/App.js'
import { fetchUtilization } from './api/usage.js'
import { CredentialsMissingError } from './auth/credentials.js'
import { TokenRefreshError } from './auth/refresh.js'
import { formatRelative } from './ui/formatReset.js'
import type { Utilization } from './api/types.js'

const cli = meow(
  `
  Usage
    $ claude-usage [options]

  Options
    --once             Print once and exit (no TUI)
    --json             With --once, print JSON instead of text
    --all              Show all fields from the API response
    --debug            On errors, capture status, headers, and body
    --interval <sec>   Polling interval for the TUI (default 300, min 10)
    --version          Show version
    --help             Show help

  Examples
    $ claude-usage
    $ claude-usage --interval 600
    $ claude-usage --once --json
    $ claude-usage --debug
`,
  {
    importMeta: import.meta,
    flags: {
      once: { type: 'boolean', default: false },
      json: { type: 'boolean', default: false },
      all: { type: 'boolean', default: false },
      debug: { type: 'boolean', default: false },
      interval: { type: 'number', default: 300 },
    },
  },
)

async function runOnce(asJson: boolean, showAll: boolean): Promise<void> {
  const data = await fetchUtilization()
  if (asJson) {
    process.stdout.write(JSON.stringify(data, null, 2) + '\n')
    return
  }
  process.stdout.write(formatPlain(data) + '\n')
  if (showAll) {
    process.stdout.write('\nAll fields:\n')
    process.stdout.write(JSON.stringify(data, null, 2) + '\n')
  }
}

function formatPlain(data: Utilization): string {
  const lines: string[] = []
  const push = (label: string, limit: { utilization: number | null; resets_at: string | null } | null | undefined) => {
    if (!limit || limit.utilization === null) return
    const pct = Math.floor(limit.utilization)
    const reset = limit.resets_at ? ` (resets ${formatRelative(limit.resets_at)})` : ''
    lines.push(`${label}: ${pct}% used${reset}`)
  }
  push('Current session (5h)', data.five_hour)
  push('Current week (all models)', data.seven_day)
  push('Current week (Sonnet only)', data.seven_day_sonnet)
  push('Current week (Opus only)', data.seven_day_opus)
  if (data.extra_usage?.is_enabled && data.extra_usage.utilization !== null && data.extra_usage.monthly_limit) {
    const pct = Math.floor(data.extra_usage.utilization ?? 0)
    const used = ((data.extra_usage.used_credits ?? 0) / 100).toFixed(2)
    const cap = (data.extra_usage.monthly_limit / 100).toFixed(2)
    lines.push(`Extra usage: ${pct}% used ($${used} of $${cap})`)
  }
  if (lines.length === 0) {
    return 'No usage data available. /usage requires a Claude.ai subscription.'
  }
  return lines.join('\n')
}

function printDebugError(err: unknown): void {
  const axiosErr = err as AxiosError
  const res = axiosErr.response
  process.stderr.write('--- debug ---\n')
  process.stderr.write(`Status: ${res?.status ?? 'no response'}\n`)
  if (res?.headers) {
    process.stderr.write('Headers:\n')
    for (const [k, v] of Object.entries(res.headers)) {
      if (v == null) continue
      process.stderr.write(`  ${k}: ${Array.isArray(v) ? v.join(', ') : String(v)}\n`)
    }
  }
  if (res?.data !== undefined) {
    const body = typeof res.data === 'string' ? res.data : JSON.stringify(res.data, null, 2)
    process.stderr.write(`Body:\n${body}\n`)
  }
}

async function main(): Promise<void> {
  if (cli.flags.once) {
    try {
      await runOnce(cli.flags.json, cli.flags.all)
      process.exit(0)
    } catch (err) {
      const msg =
        err instanceof CredentialsMissingError || err instanceof TokenRefreshError
          ? err.message
          : err instanceof Error
            ? err.message
            : String(err)
      process.stderr.write(`Error: ${msg}\n`)
      if (cli.flags.debug) printDebugError(err)
      process.exit(1)
    }
  }

  const interval = Math.max(10, Math.floor(cli.flags.interval || 300))
  if (process.stdout.isTTY) {
    process.stdout.write('\x1B[2J\x1B[3J\x1B[H')
  }
  render(
    <App
      intervalSeconds={interval}
      initialShowAll={cli.flags.all}
      debug={cli.flags.debug}
    />,
  )
}

void main()
