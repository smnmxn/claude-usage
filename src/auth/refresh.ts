import axios, { AxiosError } from 'axios'
import { getOAuthConfig } from './config.js'
import type { ClaudeAiOAuth } from './credentials.js'

export class TokenRefreshError extends Error {
  constructor(message: string, readonly cause?: unknown) {
    super(message)
    this.name = 'TokenRefreshError'
  }
}

type RefreshResponse = {
  access_token: string
  refresh_token?: string
  expires_in: number
  scope?: string
}

export async function refreshAccessToken(
  current: ClaudeAiOAuth,
): Promise<ClaudeAiOAuth> {
  const config = getOAuthConfig()
  const body = {
    grant_type: 'refresh_token',
    refresh_token: current.refreshToken,
    client_id: config.clientId,
    scope: config.scopes.join(' '),
  }

  let data: RefreshResponse
  try {
    const res = await axios.post<RefreshResponse>(config.tokenUrl, body, {
      headers: { 'Content-Type': 'application/json' },
      timeout: 15000,
    })
    data = res.data
  } catch (err) {
    const status = (err as AxiosError).response?.status
    const detail = (err as AxiosError).response?.data
    throw new TokenRefreshError(
      `Token refresh failed${status ? ` (HTTP ${status})` : ''}. Re-run \`claude\` and \`/login\`.${
        detail ? ` Detail: ${JSON.stringify(detail)}` : ''
      }`,
      err,
    )
  }

  return {
    ...current,
    accessToken: data.access_token,
    refreshToken: data.refresh_token ?? current.refreshToken,
    expiresAt: Date.now() + data.expires_in * 1000,
    scopes: data.scope ? data.scope.split(' ') : current.scopes,
  }
}
