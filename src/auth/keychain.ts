import { execFile } from 'node:child_process'
import { promisify } from 'node:util'
import os from 'node:os'
import type { ClaudeAiOAuth } from './credentials.js'

const execFileAsync = promisify(execFile)

const SERVICE_NAME = 'Claude Code-credentials'

function username(): string {
  return process.env.USER || os.userInfo().username
}

export function isKeychainSupported(): boolean {
  return process.platform === 'darwin'
}

type KeychainPayload = {
  claudeAiOauth?: ClaudeAiOAuth
  [key: string]: unknown
}

export async function readKeychainTokens(): Promise<ClaudeAiOAuth | null> {
  if (!isKeychainSupported()) return null
  let stdout: string
  try {
    const result = await execFileAsync(
      'security',
      ['find-generic-password', '-a', username(), '-w', '-s', SERVICE_NAME],
      { timeout: 5000 },
    )
    stdout = result.stdout
  } catch {
    return null
  }
  const trimmed = stdout.trim()
  if (!trimmed) return null
  let parsed: KeychainPayload
  try {
    parsed = JSON.parse(trimmed) as KeychainPayload
  } catch {
    return null
  }
  return parsed.claudeAiOauth ?? null
}
