import { promises as fs } from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { isKeychainSupported, readKeychainTokens } from './keychain.js'

export type ClaudeAiOAuth = {
  accessToken: string
  refreshToken: string
  expiresAt: number
  scopes?: string[]
  subscriptionType?: 'pro' | 'max' | 'team' | 'enterprise' | null
  rateLimitTier?: string | null
}

export class CredentialsMissingError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'CredentialsMissingError'
  }
}

const REFRESH_BUFFER_MS = 5 * 60 * 1000

export function getCredentialsPath(): string {
  const baseDir = process.env.CLAUDE_CONFIG_DIR || path.join(os.homedir(), '.claude')
  return path.join(baseDir, '.credentials.json')
}

type CredentialsFile = {
  claudeAiOauth?: ClaudeAiOAuth
  [key: string]: unknown
}

async function readFile(): Promise<CredentialsFile> {
  const filePath = getCredentialsPath()
  let raw: string
  try {
    raw = await fs.readFile(filePath, 'utf8')
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === 'ENOENT') {
      throw new CredentialsMissingError(
        `No credentials file at ${filePath}. Run \`claude\` and \`/login\` first.`,
      )
    }
    throw err
  }
  try {
    return JSON.parse(raw) as CredentialsFile
  } catch {
    throw new Error(`Credentials file at ${filePath} is not valid JSON.`)
  }
}

export async function readCredentialsFromFile(): Promise<ClaudeAiOAuth | null> {
  let file: CredentialsFile
  try {
    file = await readFile()
  } catch (err) {
    if (err instanceof CredentialsMissingError) return null
    throw err
  }
  return file.claudeAiOauth ?? null
}

export function isExpired(tokens: ClaudeAiOAuth, now: number = Date.now()): boolean {
  return now + REFRESH_BUFFER_MS >= tokens.expiresAt
}

export type CredentialSource = 'keychain' | 'file'

export async function readCredentialsAnywhere(): Promise<{
  tokens: ClaudeAiOAuth
  source: CredentialSource
}> {
  if (isKeychainSupported()) {
    const fromKeychain = await readKeychainTokens()
    if (fromKeychain) return { tokens: fromKeychain, source: 'keychain' }
  }
  const fromFile = await readCredentialsFromFile()
  if (fromFile) return { tokens: fromFile, source: 'file' }
  const where = isKeychainSupported()
    ? `the macOS Keychain (service "Claude Code-credentials") or ${getCredentialsPath()}`
    : getCredentialsPath()
  throw new CredentialsMissingError(
    `No Claude.ai credentials found in ${where}. Run \`claude\` and \`/login\` first.`,
  )
}
