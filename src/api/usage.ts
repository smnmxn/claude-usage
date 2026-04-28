import axios, { AxiosError } from 'axios'
import { getOAuthConfig } from '../auth/config.js'
import {
  type ClaudeAiOAuth,
  isExpired,
  readCredentialsAnywhere,
} from '../auth/credentials.js'
import { refreshAccessToken } from '../auth/refresh.js'
import type { Utilization } from './types.js'

const VERSION = '0.1.0'
const USER_AGENT = `claude-usage/${VERSION} (node)`
const ANTHROPIC_BETA = 'oauth-2025-04-20'

let cachedTokens: ClaudeAiOAuth | null = null

async function getUsableTokens(): Promise<ClaudeAiOAuth> {
  let tokens = cachedTokens
  if (!tokens) {
    const loaded = await readCredentialsAnywhere()
    tokens = loaded.tokens
  }
  if (isExpired(tokens)) {
    tokens = await refreshAccessToken(tokens)
  }
  cachedTokens = tokens
  return tokens
}

async function get(tokens: ClaudeAiOAuth): Promise<Utilization> {
  const url = `${getOAuthConfig().baseApiUrl}/api/oauth/usage`
  const res = await axios.get<Utilization>(url, {
    headers: {
      Authorization: `Bearer ${tokens.accessToken}`,
      'anthropic-beta': ANTHROPIC_BETA,
      'Content-Type': 'application/json',
      'User-Agent': USER_AGENT,
    },
    timeout: 5000,
  })
  return res.data
}

export async function fetchUtilization(): Promise<Utilization> {
  let tokens = await getUsableTokens()
  try {
    return await get(tokens)
  } catch (err) {
    const status = (err as AxiosError).response?.status
    if (status === 401) {
      tokens = await refreshAccessToken(tokens)
      cachedTokens = tokens
      return get(tokens)
    }
    throw err
  }
}
