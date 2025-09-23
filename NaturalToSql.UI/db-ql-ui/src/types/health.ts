// Shared health status types
export interface HealthStatus {
  api: {
    status: 'healthy' | 'degraded' | 'down' | 'not_started' | 'loading' | 'error'
    responseTime?: number
    lastChecked: string
  }
  llm: {
    status: 'healthy' | 'rate_limited' | 'error' | 'not_initialized' | 'loading' | 'initializing' | 'warning'
    rateLimitInfo?: {
      limit: number
      used: number
      requested: number
      resetTime: string
      timeRemaining: string
    }
    lastError?: string
    lastChecked: string
    localModel?: string // Current Local LLM model when in local mode
    details?: {
      ollamaInstalled: boolean
      ollamaApiRunning: boolean
      modelAvailable: boolean
      modelRunning: boolean
    }
  }
}

export interface RateLimitError {
  statusCode: 429
  errors: string[]
  source?: string
}
