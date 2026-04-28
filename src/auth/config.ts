export type OAuthConfig = {
  baseApiUrl: string
  tokenUrl: string
  clientId: string
  scopes: string[]
}

const DEFAULT_SCOPES = [
  'user:profile',
  'user:inference',
  'user:sessions:claude_code',
  'user:mcp_servers',
  'user:file_upload',
]

export function getOAuthConfig(): OAuthConfig {
  const customApi = process.env.CLAUDE_CODE_CUSTOM_OAUTH_URL?.trim()
  const baseApiUrl = customApi || 'https://api.anthropic.com'
  const tokenUrl = customApi
    ? `${customApi}/v1/oauth/token`
    : 'https://platform.claude.com/v1/oauth/token'
  const clientId =
    process.env.CLAUDE_CODE_OAUTH_CLIENT_ID?.trim() ||
    '9d1c250a-e61b-44d9-88ed-5944d1962f5e'

  return { baseApiUrl, tokenUrl, clientId, scopes: DEFAULT_SCOPES }
}
