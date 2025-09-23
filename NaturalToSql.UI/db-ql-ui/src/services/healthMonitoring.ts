// Background health monitoring service
import { HealthStatus } from '@/types/health'
import apiService from '@/services/api'

class HealthMonitoringService {
  private static instance: HealthMonitoringService | null = null
  private healthStatus: HealthStatus | null = null
  private listeners: Array<(status: HealthStatus) => void> = []
  private initialized = false
  private currentMode: 'groq' | 'local' | 'basic' | null = null
  private currentUserId: string | null = null

  static getInstance(): HealthMonitoringService {
    if (!HealthMonitoringService.instance) {
      HealthMonitoringService.instance = new HealthMonitoringService()
    }
    return HealthMonitoringService.instance
  }

  // Update current mode
  setCurrentMode(mode: 'groq' | 'local' | 'basic' | null): void {
    console.log('Health monitoring: Mode changed to', mode)
    const previousMode = this.currentMode
    this.currentMode = mode
    
    // If we're switching to local mode and the service is initialized, check Local LLM health immediately
    if (mode === 'local' && previousMode !== 'local' && this.initialized) {
      console.log('Mode switched to local, checking Local LLM health immediately...')
      this.checkLocalLLMHealth()
    }
  }

  // Update current user ID
  setCurrentUserId(userId: string | null): void {
    console.log('Health monitoring: User ID changed to', userId)
    this.currentUserId = userId
  }

  // Subscribe to health status updates
  subscribe(callback: (status: HealthStatus) => void): () => void {
    console.log('New subscription added. Current status:', this.healthStatus)
    this.listeners.push(callback)
    
    // If we already have health status, immediately call the callback
    if (this.healthStatus) {
      console.log('Immediately calling callback with existing status:', this.healthStatus)
      callback(this.healthStatus)
    }
    
    // Return unsubscribe function
    return () => {
      this.listeners = this.listeners.filter(listener => listener !== callback)
    }
  }

  // Get current health status
  getCurrentStatus(): HealthStatus | null {
    return this.healthStatus
  }

  // Initialize the health monitoring
  async initialize(): Promise<void> {
    if (this.initialized) return
    
    console.log('Initializing health monitoring service...')
    this.initialized = true
    
    // Wait a bit for the API to be ready
    await new Promise(resolve => setTimeout(resolve, 1000))
    
    // Run initial health check
    await this.checkHealth()
    
    // Set up periodic API health checks (every 30 seconds)
    setInterval(() => {
      this.checkApiHealth()
    }, 30000)
    
    // Set up periodic LLM health checks for local mode (every 60 seconds)
    setInterval(() => {
      if (this.currentMode === 'local') {
        this.checkLocalLLMHealth()
      }
    }, 60000)
    
    console.log('Health monitoring service initialized')
  }

  // Check API health only
  private async checkApiHealth(): Promise<void> {
    try {
      // First check if API process is running
      let apiProcessRunning = false
      try {
        if (window.electronAPI && window.electronAPI.getApiProcessStatus) {
          const processStatus = await window.electronAPI.getApiProcessStatus()
          apiProcessRunning = processStatus.isRunning
        }
      } catch (error) {
        console.log('Could not check API process status:', error)
      }

      if (!apiProcessRunning) {
        // API process not started yet - don't try to connect
        const newStatus: HealthStatus = {
          ...this.healthStatus!,
          api: {
            status: 'not_started',
            lastChecked: new Date().toISOString()
          }
        }
        this.updateHealthStatus(newStatus)
        return
      }

      const startTime = Date.now()
      const apiHealthy = await apiService.checkHealth()
      const responseTime = Date.now() - startTime

      const newStatus: HealthStatus = {
        ...this.healthStatus!,
        api: {
          status: apiHealthy ? 'healthy' : 'down',
          responseTime,
          lastChecked: new Date().toISOString()
        }
      }

      this.updateHealthStatus(newStatus)
    } catch (error) {
      console.error('API health check failed:', error)
      
      const newStatus: HealthStatus = {
        ...this.healthStatus!,
        api: {
          status: 'down',
          lastChecked: new Date().toISOString()
        }
      }

      this.updateHealthStatus(newStatus)
    }
  }

  // Check Local LLM health only (for periodic checks in local mode)
  private async checkLocalLLMHealth(): Promise<void> {
    if (!this.healthStatus) return
    
    try {
      console.log('Checking Local LLM health with comprehensive check...')
      
      // Always use the new comprehensive health check that verifies both API and model
      if (window.electronAPI?.checkLocalLLMHealth) {
        const localLLMHealth = await window.electronAPI.checkLocalLLMHealth()
        
        // Get current model information from API if available
        let currentModel: string | undefined
        try {
          const modelInfo = await apiService.getLocalLLMModel()
          currentModel = modelInfo.model
        } catch (error) {
          console.warn('Failed to get Local LLM model info from API:', error)
          // If API call fails, use qwen3:8b if model is available
          if (localLLMHealth.checks.modelAvailable) {
            currentModel = 'qwen3:8b'
          }
        }
        
        const newStatus: HealthStatus = {
          ...this.healthStatus,
          llm: {
            status: localLLMHealth.healthy ? 'healthy' : 'error',
            lastError: !localLLMHealth.healthy ? localLLMHealth.message : undefined,
            lastChecked: new Date().toISOString(),
            localModel: currentModel,
            details: {
              ollamaInstalled: localLLMHealth.checks.ollamaInstalled,
              ollamaApiRunning: localLLMHealth.checks.ollamaApiRunning,
              modelAvailable: localLLMHealth.checks.modelAvailable,
              modelRunning: localLLMHealth.checks.modelRunning
            }
          }
        }
        
        this.updateHealthStatus(newStatus)
      } else {
        // Fallback to old API method if Electron API is not available
        console.log('Electron API not available, falling back to API health check...')
        const localLLMHealth = await apiService.checkLocalLLMHealth()
        
        // Get current model information
        let currentModel: string | undefined
        try {
          const modelInfo = await apiService.getLocalLLMModel()
          currentModel = modelInfo.model
        } catch (error) {
          console.warn('Failed to get Local LLM model info:', error)
        }
        
        const newStatus: HealthStatus = {
          ...this.healthStatus,
          llm: {
            status: localLLMHealth.status.toLowerCase() === 'healthy' ? 'healthy' 
                   : localLLMHealth.status.toLowerCase() === 'warning' ? 'warning' 
                   : 'error',
            lastError: localLLMHealth.status.toLowerCase() !== 'healthy' ? (localLLMHealth.message || 'Local LLM is not operational') : undefined,
            lastChecked: new Date().toISOString(),
            localModel: currentModel,
            details: localLLMHealth.checks ? {
              ollamaInstalled: localLLMHealth.checks.ollamaInstalled,
              ollamaApiRunning: localLLMHealth.checks.ollamaApiRunning,
              modelAvailable: localLLMHealth.checks.modelAvailable,
              modelRunning: localLLMHealth.checks.modelRunning
            } : undefined
          }
        }
        
        this.updateHealthStatus(newStatus)
      }
    } catch (error: any) {
      console.error('Local LLM health check failed:', error)
      
      const newStatus: HealthStatus = {
        ...this.healthStatus,
        llm: {
          status: 'error',
          lastError: error.message || 'Failed to check Local LLM health',
          lastChecked: new Date().toISOString()
        }
      }
      
      this.updateHealthStatus(newStatus)
    }
  }

  // Full health check (including LLM)
  private async checkHealth(): Promise<void> {
    try {
      // First check if API process is running
      let apiProcessRunning = false
      try {
        if (window.electronAPI && window.electronAPI.getApiProcessStatus) {
          const processStatus = await window.electronAPI.getApiProcessStatus()
          apiProcessRunning = processStatus.isRunning
        }
      } catch (error) {
        console.log('Could not check API process status:', error)
      }

      if (!apiProcessRunning) {
        // API process not started yet
        const newStatus: HealthStatus = {
          api: {
            status: 'not_started',
            lastChecked: new Date().toISOString()
          },
          llm: {
            status: 'not_initialized',
            lastChecked: new Date().toISOString()
          }
        }
        this.updateHealthStatus(newStatus)
        return
      }

      // Check API health
      const startTime = Date.now()
      const apiHealthy = await apiService.checkHealth()
      const responseTime = Date.now() - startTime

      const newStatus: HealthStatus = {
        api: {
          status: apiHealthy ? 'healthy' : 'down',
          responseTime,
          lastChecked: new Date().toISOString()
        },
        llm: {
          status: 'healthy',
          lastChecked: new Date().toISOString()
        }
      }

      // Check LLM health based on current mode
      if (this.currentMode === 'basic') {
        // Basic mode - no LLM functionality
        newStatus.llm = {
          status: 'not_initialized',
          lastChecked: new Date().toISOString()
        }
      } else if (this.currentMode === 'local') {
        // Local LLM mode - use comprehensive health check that verifies both API and model presence
        try {
          console.log('Checking Local LLM health with comprehensive check...')
          
          // Always use the new comprehensive health check that verifies both API and model
          if (window.electronAPI?.checkLocalLLMHealth) {
            const localLLMHealth = await window.electronAPI.checkLocalLLMHealth()
            
            // Get current model information from API if available
            let currentModel: string | undefined
            try {
              const modelInfo = await apiService.getLocalLLMModel()
              currentModel = modelInfo.model
            } catch (error) {
              console.warn('Failed to get Local LLM model info from API:', error)
              // If API call fails, use qwen3:8b if model is available
              if (localLLMHealth.checks.modelAvailable) {
                currentModel = 'qwen3:8b'
              }
            }
            
            newStatus.llm = {
              status: localLLMHealth.healthy ? 'healthy' : 'error',
              lastError: !localLLMHealth.healthy ? localLLMHealth.message : undefined,
              lastChecked: new Date().toISOString(),
              localModel: currentModel,
              details: {
                ollamaInstalled: localLLMHealth.checks.ollamaInstalled,
                ollamaApiRunning: localLLMHealth.checks.ollamaApiRunning,
                modelAvailable: localLLMHealth.checks.modelAvailable,
                modelRunning: localLLMHealth.checks.modelRunning
              }
            }
          } else {
            // Fallback to old API method if Electron API is not available
            console.log('Electron API not available, falling back to API health check...')
            const localLLMHealth = await apiService.checkLocalLLMHealth()
            
            // Get current model information
            let currentModel: string | undefined
            try {
              const modelInfo = await apiService.getLocalLLMModel()
              currentModel = modelInfo.model
            } catch (error) {
              console.warn('Failed to get Local LLM model info:', error)
            }
            
            newStatus.llm = {
              status: localLLMHealth.status.toLowerCase() === 'healthy' ? 'healthy' 
                     : localLLMHealth.status.toLowerCase() === 'warning' ? 'warning' 
                     : 'error',
              lastError: localLLMHealth.status.toLowerCase() !== 'healthy' ? (localLLMHealth.message || 'Local LLM is not operational') : undefined,
              lastChecked: new Date().toISOString(),
              localModel: currentModel,
              details: localLLMHealth.checks ? {
                ollamaInstalled: localLLMHealth.checks.ollamaInstalled,
                ollamaApiRunning: localLLMHealth.checks.ollamaApiRunning,
                modelAvailable: localLLMHealth.checks.modelAvailable,
                modelRunning: localLLMHealth.checks.modelRunning
              } : undefined
            }
          }
        } catch (error: any) {
          console.error('Local LLM health check failed:', error)
          newStatus.llm = {
            status: 'error',
            lastError: error.message || 'Failed to check Local LLM health',
            lastChecked: new Date().toISOString()
          }
        }
      } else if (this.currentMode === 'groq') {
        // Groq mode - check Groq API health via conversion test
        try {
          const profiles = await apiService.getExistingProfiles()
          const testProfileId = profiles.length > 0 ? profiles[0].id : 'health-check-profile'
          
          await apiService.convertQuery({
            UserId: this.currentUserId || 'health-check-user', // Use current user ID or fallback
            profileId: testProfileId,
            query: 'SELECT 1 as health_check',
            allowWriteOperations: false
          })
          
          // Groq LLM is healthy
          newStatus.llm = {
            status: 'healthy',
            lastChecked: new Date().toISOString()
          }
        } catch (error: any) {
          console.log('Groq LLM health check completed with status:', error?.statusCode || 'unknown')
          
          // Check if it's a rate limit error
          if (error?.statusCode === 429 && error?.errors) {
            const rateLimitError = error.errors.find((err: string) => 
              err.includes('Rate limit reached') || err.includes('rate_limit_exceeded')
            )
            
            if (rateLimitError) {
              // Parse rate limit information
              const limitMatch = rateLimitError.match(/Limit (\d+)/)
              const usedMatch = rateLimitError.match(/Used (\d+)/)
              const requestedMatch = rateLimitError.match(/Requested (\d+)/)
              const timeMatch = rateLimitError.match(/Please try again in ([^.]+)/)
              
              newStatus.llm = {
                status: 'rate_limited',
                rateLimitInfo: {
                  limit: limitMatch ? parseInt(limitMatch[1]) : 0,
                  used: usedMatch ? parseInt(usedMatch[1]) : 0,
                  requested: requestedMatch ? parseInt(requestedMatch[1]) : 0,
                  resetTime: new Date(Date.now() + (timeMatch ? this.parseTimeToMs(timeMatch[1]) : 0)).toISOString(),
                  timeRemaining: timeMatch ? timeMatch[1] : '0s'
                },
                lastError: rateLimitError,
                lastChecked: new Date().toISOString()
              }
            } else {
              newStatus.llm = {
                status: 'error',
                lastError: error.errors?.join('; ') || error.message || 'Unknown error',
                lastChecked: new Date().toISOString()
              }
            }
          } else {
            newStatus.llm = {
              status: 'error',
              lastError: error.message || 'Unknown error',
              lastChecked: new Date().toISOString()
            }
          }
        }
      } else {
        // Mode not set or unknown - use fallback logic
        // Check LLM setup type by checking if Groq API key exists
        let hasGroqApiKey = false
        try {
          if (window.electronAPI && window.electronAPI.getGroqApiKeyStatus) {
            const keyStatus = await window.electronAPI.getGroqApiKeyStatus()
            hasGroqApiKey = keyStatus.hasApiKey
          } else {
            // Fallback for development
            const keyStatus = await apiService.getGroqApiKeyStatus()
            hasGroqApiKey = keyStatus.hasApiKey
          }
        } catch (error) {
          console.log('Could not check Groq API key status:', error)
        }

        if (!hasGroqApiKey) {
          // No Groq API key - assume basic mode
          newStatus.llm = {
            status: 'not_initialized',
            lastChecked: new Date().toISOString()
          }
        } else {
          // Has Groq API key - test it
          try {
            const profiles = await apiService.getExistingProfiles()
            const testProfileId = profiles.length > 0 ? profiles[0].id : 'health-check-profile'
            
            await apiService.convertQuery({
              UserId: this.currentUserId || 'health-check-user', // Use current user ID or fallback
              profileId: testProfileId,
              query: 'SELECT 1 as health_check',
              allowWriteOperations: false
            })
            
            // LLM is healthy
            newStatus.llm = {
              status: 'healthy',
              lastChecked: new Date().toISOString()
            }
          } catch (error: any) {
            console.log('LLM health check completed with status:', error?.statusCode || 'unknown')
            
            // Check if it's a rate limit error
            if (error?.statusCode === 429 && error?.errors) {
              const rateLimitError = error.errors.find((err: string) => 
                err.includes('Rate limit reached') || err.includes('rate_limit_exceeded')
              )
              
              if (rateLimitError) {
                // Parse rate limit information
                const limitMatch = rateLimitError.match(/Limit (\d+)/)
                const usedMatch = rateLimitError.match(/Used (\d+)/)
                const requestedMatch = rateLimitError.match(/Requested (\d+)/)
                const timeMatch = rateLimitError.match(/Please try again in ([^.]+)/)
                
                newStatus.llm = {
                  status: 'rate_limited',
                  rateLimitInfo: {
                    limit: limitMatch ? parseInt(limitMatch[1]) : 0,
                    used: usedMatch ? parseInt(usedMatch[1]) : 0,
                    requested: requestedMatch ? parseInt(requestedMatch[1]) : 0,
                    resetTime: new Date(Date.now() + (timeMatch ? this.parseTimeToMs(timeMatch[1]) : 0)).toISOString(),
                    timeRemaining: timeMatch ? timeMatch[1] : '0s'
                  },
                  lastError: rateLimitError,
                  lastChecked: new Date().toISOString()
                }
              } else {
                newStatus.llm = {
                  status: 'error',
                  lastError: error.errors?.join('; ') || error.message || 'Unknown error',
                  lastChecked: new Date().toISOString()
                }
              }
            } else {
              newStatus.llm = {
                status: 'error',
                lastError: error.message || 'Unknown error',
                lastChecked: new Date().toISOString()
              }
            }
          }
        }
      }

      this.updateHealthStatus(newStatus)
    } catch (error: any) {
      console.error('Full health check failed:', error)
      
      // Fallback status
      const fallbackStatus: HealthStatus = {
        api: {
          status: 'down',
          lastChecked: new Date().toISOString()
        },
        llm: {
          status: 'error',
          lastError: 'Health check failed',
          lastChecked: new Date().toISOString()
        }
      }

      this.updateHealthStatus(fallbackStatus)
    }
  }

  // Manual refresh functionality for UI components
  async refreshHealth(includeLlm: boolean = false): Promise<void> {
    console.log('Manual health refresh requested, includeLlm:', includeLlm)
    
    if (includeLlm || this.currentMode === 'local') {
      // For local mode or when LLM refresh is explicitly requested, 
      // do comprehensive check including both API and Local LLM
      if (this.currentMode === 'local') {
        // Use comprehensive local LLM health check that verifies both Ollama API and model presence
        await Promise.all([
          this.checkApiHealth(),
          this.checkLocalLLMHealth()
        ])
      } else {
        // Do full health check for non-local modes
        await this.checkHealth()
      }
    } else {
      // Do API-only health check
      await this.checkApiHealth()
    }
  }

  // Update health status and notify all listeners
  private updateHealthStatus(status: HealthStatus): void {
    console.log('Updating health status:', status)
    console.log('Number of listeners:', this.listeners.length)
    this.healthStatus = status
    this.listeners.forEach(callback => {
      console.log('Notifying listener with status:', status)
      callback(status)
    })
  }

  // Parse time string to milliseconds
  private parseTimeToMs(timeStr: string): number {
    const matches = timeStr.match(/(?:(\d+)h)?(?:(\d+)m)?(?:(\d+(?:\.\d+)?)s)?/)
    if (!matches) return 0
    
    const hours = parseInt(matches[1] || '0')
    const minutes = parseInt(matches[2] || '0')
    const seconds = parseFloat(matches[3] || '0')
    
    return ((hours * 3600) + (minutes * 60) + seconds) * 1000
  }

  // Handle external rate limit errors
  handleRateLimitError(error: any): void {
    if (!this.healthStatus || error?.statusCode !== 429 || !error?.errors) return
    
    const rateLimitError = error.errors.find((err: string) => 
      err.includes('Rate limit reached') || err.includes('rate_limit_exceeded')
    )
    
    if (rateLimitError) {
      // Parse rate limit information
      const limitMatch = rateLimitError.match(/Limit (\d+)/)
      const usedMatch = rateLimitError.match(/Used (\d+)/)
      const requestedMatch = rateLimitError.match(/Requested (\d+)/)
      const timeMatch = rateLimitError.match(/Please try again in ([^.]+)/)
      
      const newStatus: HealthStatus = {
        ...this.healthStatus,
        llm: {
          status: 'rate_limited',
          rateLimitInfo: {
            limit: limitMatch ? parseInt(limitMatch[1]) : 0,
            used: usedMatch ? parseInt(usedMatch[1]) : 0,
            requested: requestedMatch ? parseInt(requestedMatch[1]) : 0,
            resetTime: new Date(Date.now() + (timeMatch ? this.parseTimeToMs(timeMatch[1]) : 0)).toISOString(),
            timeRemaining: timeMatch ? timeMatch[1] : '0s'
          },
          lastError: rateLimitError,
          lastChecked: new Date().toISOString()
        }
      }

      this.updateHealthStatus(newStatus)
    }
  }
}

// Export singleton instance
export const healthMonitoringService = HealthMonitoringService.getInstance()
