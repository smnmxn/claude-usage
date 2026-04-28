# claude-usage

Live terminal view of your Claude.ai plan usage limits. Reuses the OAuth credentials that Claude Code already has, so there's no separate login.

## Requirements

- Node.js 18+
- A logged-in Claude Code install. The CLI looks for credentials in this order:
  1. **macOS Keychain** — service `Claude Code-credentials`, account `$USER` (the default on macOS).
  2. **`~/.claude/.credentials.json`** — the file fallback used on Linux/Windows or when keychain is disabled.

  If you've never run Claude Code, do `claude` and `/login` first so the credentials exist.

  On macOS, the **first run** of `claude-usage` will surface a Keychain Access prompt asking whether `node` (or `claude-usage`) may read the `Claude Code-credentials` item — click **Always Allow** to avoid the prompt on every launch.

  Credentials are read-only: refreshed access tokens stay in memory only, so the keychain entry is never modified.

## Install

```sh
npm install               # install dependencies
npm run install:global    # build + install `claude-usage` on your PATH
claude-usage              # run from anywhere
```

`npm run install:global` is equivalent to `npm install -g .`. It copies a built snapshot, so editing `src/` afterwards won't affect the installed CLI — re-run the install to update.

To uninstall:

```sh
npm run uninstall:global
```

If you'd rather develop against the source (live edits reflected after each rebuild), use `npm link` instead of the global install:

```sh
npm link            # symlinks claude-usage to your working directory
claude-usage
npm unlink -g claude-usage   # to undo
```

## Usage

```sh
claude-usage                       # live TUI, polls every 5 min (with ±15% jitter)
claude-usage --interval 600        # poll every 10 min instead (min 10s)
claude-usage --once                # print once and exit
claude-usage --once --json         # machine-readable output
claude-usage --once --all          # plain summary plus full JSON of every field
claude-usage --all                 # TUI with the raw-JSON panel open
claude-usage --debug               # on errors, capture response status/headers/body
```

### TUI keybindings

| Key | Action |
| --- | --- |
| `r` | Refresh now (resets rate-limit backoff counter) |
| `a` | Toggle the raw "All fields" panel |
| `q` / `Esc` / `Ctrl+C` | Quit |

### What it shows

For each rate limit returned by `/api/oauth/usage`, a colored progress bar (green / yellow ≥70% / red ≥90%) plus percent used and a relative reset time:

- **Current session (5h)**
- **Current week (all models)**
- **Current week (Sonnet only)** — Max/Team plans
- **Current week (Opus only)** — when present
- **Extra usage (this month)** — credits used vs monthly limit, when enabled

Each rate-limit bar also shows a vertical **pace marker** (`│`) at the position usage would be at if it were spread evenly across the window. The marker is **red** when current usage is past it (over-pace), **green** when behind (headroom remaining), and white when within ±0.5%. The percent text reads e.g. `60% used (target 50%)`. The extra-usage bar has no pace marker (no window-end timestamp is returned for it).

A footer shows when the data was last fetched and how many seconds until the next refresh.

### Rate limiting

The `/api/oauth/usage` endpoint will return **HTTP 429** if polled too aggressively. The CLI handles this:

- Default poll interval is 5 minutes with ±15% jitter so consecutive polls don't fall on the same offset.
- On 429, an exponential backoff kicks in (1m → 2m → 4m → 8m, capped at 10m) and overrides the configured interval until a successful fetch resets the counter.
- The server's `Retry-After` header is honored when present (we wait at least that long, but never less than the configured `--interval`).
- The previous successful data stays on screen in a "stale" state — only the banner turns yellow.
- Press `r` to reset the backoff counter and try immediately.

### Debugging

`--debug` captures the raw HTTP response on errors:

- In the TUI, a yellow-bordered panel below the bars shows status, headers, and body of the most recent error.
- With `--once --debug`, the same is printed to stderr after the error message.

Useful for understanding what the server is telling us when it returns a 429 or anything unexpected.

## Environment variables

The CLI honors the same OAuth env vars as Claude Code:

- `CLAUDE_CONFIG_DIR` — overrides `~/.claude` for the credentials file path.
- `CLAUDE_CODE_OAUTH_CLIENT_ID` — overrides the OAuth client ID.
- `CLAUDE_CODE_CUSTOM_OAUTH_URL` — overrides `https://api.anthropic.com` (FedStart / staging).
