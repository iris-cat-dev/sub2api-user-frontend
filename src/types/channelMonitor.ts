export type Provider =
  | 'openai'
  | 'anthropic'
  | 'gemini'
  | 'grok'
  | 'antigravity'
  | 'kimi'
  | 'zhipu'
  | 'deepseek'
  | 'minimax'
  | 'opencode_go'

export type MonitorStatus = 'operational' | 'degraded' | 'failed' | 'error'
export type APIMode = 'chat_completions' | 'responses'
export type CheckMode = 'probe' | 'quota' | 'quota_probe'

export interface MonitorQuotaTier {
  window: string
  label?: string
  used_percent: number
  used?: number
  limit?: number
  reset_at?: string
}

export interface MonitorBalance {
  currency: string
  balance: number
}

export interface MonitorQuotaSnapshot {
  source: string
  success: boolean
  tiers?: MonitorQuotaTier[]
  balance?: number | null
  balances?: MonitorBalance[]
  currency?: string
  plan_level?: string
  credential_invalid?: boolean
  error?: string
  fetched_at: string
}
