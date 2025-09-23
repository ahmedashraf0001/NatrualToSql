// Utility to handle rate limit errors and sync with HealthManager
import { RateLimitError } from '@/types/health'
import { healthMonitoringService } from '@/services/healthMonitoring'

export const notifyHealthManagerOfRateLimit = (error: RateLimitError) => {
  // Notify the background health monitoring service
  healthMonitoringService.handleRateLimitError(error)
}

// Helper to check if an error is a rate limit error
export const isRateLimitError = (error: any): error is RateLimitError => {
  return error?.statusCode === 429 && 
         error?.errors && 
         Array.isArray(error.errors) &&
         error.errors.some((err: string) => 
           err.includes('Rate limit reached') || 
           err.includes('rate_limit_exceeded')
         )
}
