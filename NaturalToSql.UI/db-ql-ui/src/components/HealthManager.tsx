import React, { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { 
  AlertTriangle, 
  CheckCircle, 
  XCircle, 
  Clock, 
  RefreshCw, 
  Activity,
  Zap,
  TrendingUp,
  Loader2,
  Download
} from 'lucide-react'
import { healthMonitoringService } from '@/services/healthMonitoring'
import { NotificationMessage } from '@/types'
import { HealthStatus } from '@/types/health'
import OllamaInstallModal from '@/components/OllamaInstallModal'

interface HealthManagerProps {
  onNotification: (notification: Omit<NotificationMessage, 'id'>) => void
  onHealthStatusUpdate?: (status: HealthStatus) => void
  setupType?: 'groq' | 'local' | 'basic' | null
}

const HealthManager: React.FC<HealthManagerProps> = ({ onNotification, onHealthStatusUpdate, setupType }) => {
  // Initialize with current status from service or fallback to healthy
  const [healthStatus, setHealthStatus] = useState<HealthStatus>(() => {
    const currentStatus = healthMonitoringService.getCurrentStatus()
    console.log('HealthManager initializing with status:', currentStatus)
    return currentStatus || {
      api: {
        status: 'healthy',
        lastChecked: new Date().toISOString()
      },
      llm: {
        status: 'healthy',
        lastChecked: new Date().toISOString()
      }
    }
  })
  const [isLoading, setIsLoading] = useState(false)
  const [countdown, setCountdown] = useState<number | null>(null)
  
  // State for model download functionality
  const [isDownloadModalOpen, setIsDownloadModalOpen] = useState(false)
  const [downloadProgress, setDownloadProgress] = useState(0)
  const [downloadStep, setDownloadStep] = useState('')
  const [downloadMessage, setDownloadMessage] = useState('')
  const [downloadError, setDownloadError] = useState<string | undefined>()
  const [downloadSubProgress, setDownloadSubProgress] = useState<number | undefined>()
  const [downloadTotalSize, setDownloadTotalSize] = useState<string | undefined>()
  const [downloadCancellable, setDownloadCancellable] = useState(false)
  const [downloadTimeEstimate, setDownloadTimeEstimate] = useState<string | undefined>()
  const [downloadSpeed, setDownloadSpeed] = useState<string | undefined>()

  // Subscribe to background health monitoring service
  useEffect(() => {
    console.log('HealthManager subscribing to health service')
    // Subscribe to updates
    const unsubscribe = healthMonitoringService.subscribe((status: HealthStatus) => {
      console.log('HealthManager received status update:', status)
      setHealthStatus(status)
    })

    return unsubscribe
  }, [])

  // Notify parent component when health status changes
  useEffect(() => {
    onHealthStatusUpdate?.(healthStatus)
  }, [healthStatus, onHealthStatusUpdate])

  // Auto-refresh health status every 30 seconds when HealthManager is open
  useEffect(() => {
    console.log('HealthManager setting up auto-refresh')
    
    // Initial health check when component mounts
    const performInitialCheck = async () => {
      await checkHealth(true)
    }
    performInitialCheck()

    // Set up auto-refresh interval
    const autoRefreshInterval = setInterval(() => {
      console.log('HealthManager auto-refresh triggered')
      checkHealth(true) // Include LLM in auto-refresh
    }, 30000) // Refresh every 30 seconds

    // Cleanup interval on unmount
    return () => {
      console.log('HealthManager cleaning up auto-refresh')
      clearInterval(autoRefreshInterval)
    }
  }, []) // Empty dependency array means this runs once on mount

  // Animation variants
  const containerVariants = {
    hidden: { opacity: 0, y: 20 },
    visible: { 
      opacity: 1, 
      y: 0,
      transition: { 
        duration: 0.5,
        staggerChildren: 0.1
      }
    }
  }

  const itemVariants = {
    hidden: { opacity: 0, y: 20 },
    visible: { 
      opacity: 1, 
      y: 0,
      transition: { duration: 0.4 }
    }
  }

  // Parse rate limit reset time and start countdown
  useEffect(() => {
    if (healthStatus.llm.rateLimitInfo?.timeRemaining) {
      const parseTimeString = (timeStr: string): number => {
        // Parse formats like "25m11.438999999s" or "1h30m45s"
        const matches = timeStr.match(/(?:(\d+)h)?(?:(\d+)m)?(?:(\d+(?:\.\d+)?)s)?/)
        if (!matches) return 0
        
        const hours = parseInt(matches[1] || '0')
        const minutes = parseInt(matches[2] || '0')
        const seconds = parseFloat(matches[3] || '0')
        
        return (hours * 3600) + (minutes * 60) + seconds
      }

      const totalSeconds = parseTimeString(healthStatus.llm.rateLimitInfo.timeRemaining)
      setCountdown(totalSeconds)
    }
  }, [healthStatus.llm.rateLimitInfo?.timeRemaining])

  // Countdown timer
  useEffect(() => {
    if (countdown === null || countdown <= 0) return

    const timer = setInterval(() => {
      setCountdown(prev => {
        if (prev === null || prev <= 1) {
          // Time's up, check LLM health to see if rate limit is lifted
          checkLlmHealth()
          return null
        }
        return prev - 1
      })
    }, 1000)

    return () => clearInterval(timer)
  }, [countdown])

  const formatCountdown = (seconds: number): string => {
    const hours = Math.floor(seconds / 3600)
    const minutes = Math.floor((seconds % 3600) / 60)
    const secs = Math.floor(seconds % 60)
    
    if (hours > 0) {
      return `${hours}h ${minutes}m ${secs}s`
    } else if (minutes > 0) {
      return `${minutes}m ${secs}s`
    } else {
      return `${secs}s`
    }
  }

  const checkLlmHealth = async () => {
    // Use the background service for consistency  
    await healthMonitoringService.refreshHealth(true)
  }

  const restartLocalLLM = async () => {
    setIsLoading(true)
    try {
      onNotification({
        type: 'info',
        title: 'Restarting Local LLM',
        message: 'Attempting to restart the local LLM model...',
        duration: 3000
      })

      // Use the Electron API to restart the local model
      if (window.electronAPI) {
        const result = await window.electronAPI.startOllamaModel()
        
        if (result.success) {
          onNotification({
            type: 'success',
            title: 'LLM Restart Successful',
            message: result.message || 'Local LLM model has been restarted',
            duration: 5000
          })
          
          // Wait a moment then refresh health status
          setTimeout(() => {
            checkLlmHealth()
          }, 2000)
        } else {
          onNotification({
            type: 'error',
            title: 'LLM Restart Failed',
            message: result.error || 'Failed to restart local LLM model',
            duration: 5000
          })
        }
      } else {
        throw new Error('Electron API not available')
      }
    } catch (error: any) {
      console.error('Failed to restart local LLM:', error)
      onNotification({
        type: 'error',
        title: 'LLM Restart Failed',
        message: error.message || 'Unable to restart local LLM model',
        duration: 5000
      })
    } finally {
      setIsLoading(false)
    }
  }

  const downloadModel = async () => {
    try {
      console.log('Starting model download...')
      setIsDownloadModalOpen(true)
      setDownloadProgress(0)
      setDownloadStep('starting')
      setDownloadMessage('Preparing to download qwen3:8b model...')
      setDownloadError(undefined)
      
      onNotification({
        type: 'info',
        title: 'Model Download Started',
        message: 'Starting qwen3:8b model download. This may take 10-30 minutes.',
        duration: 5000
      })

      if (window.electronAPI) {
        // Set up progress listener
        const handleProgress = (event: any) => {
          console.log('Download progress:', event.detail || event)
          const progress = event.detail || event
          
          setDownloadStep(progress.step || 'downloading')
          setDownloadMessage(progress.message || 'Downloading...')
          setDownloadProgress(progress.progress || 0)
          setDownloadSubProgress(progress.subProgress)
          setDownloadTotalSize(progress.totalSize)
          setDownloadCancellable(progress.cancellable || false)
          setDownloadTimeEstimate(progress.timeEstimate)
          setDownloadSpeed(progress.downloadSpeed)
          
          if (progress.error) {
            setDownloadError(progress.error)
          }
          
          if (progress.cancelled) {
            setDownloadError('Download cancelled by user')
          }
        }

        // Listen for progress updates
        if (window.electronAPI.on) {
          window.electronAPI.on('ollama-install-progress', handleProgress)
        }

        const result = await window.electronAPI.installOllamaSetup()
        
        // Clean up listener
        if (window.electronAPI.removeListener) {
          window.electronAPI.removeListener('ollama-install-progress', handleProgress)
        }
        
        if (result.success) {
          onNotification({
            type: 'success',
            title: 'Model Download Complete',
            message: 'qwen3:8b model downloaded and installed successfully!',
            duration: 5000
          })
          
          // Wait a moment then refresh health status to reflect the new model
          setTimeout(() => {
            checkLlmHealth()
          }, 2000)
        } else if (result.error && result.error.includes('cancelled')) {
          onNotification({
            type: 'info',
            title: 'Download Cancelled',
            message: 'Model download was cancelled',
            duration: 3000
          })
        } else {
          setDownloadError(result.error || 'Unknown error occurred')
          onNotification({
            type: 'error',
            title: 'Download Failed',
            message: result.error || 'Failed to download model',
            duration: 5000
          })
        }
      } else {
        throw new Error('Electron API not available')
      }
    } catch (error: any) {
      console.error('Failed to download model:', error)
      setDownloadError(error.message || 'Failed to start download')
      onNotification({
        type: 'error',
        title: 'Download Failed',
        message: error.message || 'Unable to start model download',
        duration: 5000
      })
    }
  }

  const handleDownloadCancel = () => {
    console.log('Download cancelled by user')
    setDownloadError('Download cancelled by user')
  }

  const handleDownloadClose = () => {
    setIsDownloadModalOpen(false)
    setDownloadProgress(0)
    setDownloadStep('')
    setDownloadMessage('')
    setDownloadError(undefined)
    setDownloadSubProgress(undefined)
    setDownloadTotalSize(undefined)
    setDownloadCancellable(false)
  }

  const checkHealth = async (includeLlm: boolean = false) => {
    setIsLoading(true)
    try {
      // Use the background service for all health checks
      await healthMonitoringService.refreshHealth(includeLlm)
    } catch (error: any) {
      console.error('Health check failed:', error)
      onNotification({
        type: 'error',
        title: 'Health Check Failed',
        message: error.message || 'Unable to check system health',
        duration: 5000
      })
    } finally {
      setIsLoading(false)
    }
  }

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'healthy':
        return <CheckCircle className="w-5 h-5 text-green-500" />
      case 'degraded':
      case 'rate_limited':
      case 'warning':
        return <AlertTriangle className="w-5 h-5 text-yellow-500" />
      case 'down':
      case 'error':
        return <XCircle className="w-5 h-5 text-red-500" />
      case 'not_started':
      case 'not_initialized':
        return <Clock className="w-5 h-5 text-blue-500" />
      case 'initializing':
        return <Loader2 className="w-5 h-5 text-orange-500 animate-spin" />
      case 'loading':
        return <Loader2 className="w-5 h-5 text-purple-500 animate-spin" />
      default:
        return <Activity className="w-5 h-5 text-gray-500" />
    }
  }

  const getStatusText = (status: string, type: 'api' | 'llm') => {
    switch (status) {
      case 'healthy':
        return 'Operational'
      case 'degraded':
        return 'Degraded'
      case 'rate_limited':
        return 'Rate Limited'
      case 'down':
        return 'Down'
      case 'error':
        return 'Error'
      case 'not_started':
        return type === 'api' ? 'Not Started' : 'Not Started'
      case 'not_initialized':
        return type === 'llm' ? 'Not Initialized' : 'Not Initialized'
      case 'initializing':
        return 'Initializing...'
      case 'loading':
        return 'Loading...'
      default:
        return status.charAt(0).toUpperCase() + status.slice(1)
    }
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'healthy':
        return 'from-green-500/5 to-emerald-500/5 border-green-500/20'
      case 'degraded':
      case 'rate_limited':
        return 'from-yellow-500/5 to-orange-500/5 border-yellow-500/20'
      case 'down':
      case 'error':
        return 'from-red-500/5 to-pink-500/5 border-red-500/20'
      case 'not_started':
      case 'not_initialized':
        return 'from-blue-500/5 to-sky-500/5 border-blue-500/20'
      case 'initializing':
        return 'from-orange-500/5 to-amber-500/5 border-orange-500/20'
      case 'loading':
        return 'from-purple-500/5 to-violet-500/5 border-purple-500/20'
      default:
        return 'from-gray-500/5 to-slate-500/5 border-gray-500/20'
    }
  }

  return (
    <motion.div 
      className="w-full"
      initial="hidden"
      animate="visible"
      variants={containerVariants}
    >
      <div className="space-y-4 w-full">
        {/* Status Overview and Controls */}
        <motion.div 
          className="flex items-center justify-between mb-4"
          variants={itemVariants}
        >
          <motion.div 
            className={`px-3 py-1.5 bg-gradient-to-r ${
              setupType === 'basic' 
                ? (healthStatus.api.status === 'healthy'
                  ? 'from-green-500/10 to-emerald-500/10 border-green-500/20 text-green-600 dark:text-green-400'
                  : healthStatus.api.status === 'down'
                  ? 'from-red-500/10 to-pink-500/10 border-red-500/20 text-red-600 dark:text-red-400'
                  : 'from-yellow-500/10 to-orange-500/10 border-yellow-500/20 text-yellow-600 dark:text-yellow-400')
                : (healthStatus.api.status === 'healthy' && healthStatus.llm.status === 'healthy'
                  ? 'from-green-500/10 to-emerald-500/10 border-green-500/20 text-green-600 dark:text-green-400'
                  : healthStatus.api.status === 'down' || healthStatus.llm.status === 'error'
                  ? 'from-red-500/10 to-pink-500/10 border-red-500/20 text-red-600 dark:text-red-400'
                  : 'from-yellow-500/10 to-orange-500/10 border-yellow-500/20 text-yellow-600 dark:text-yellow-400')
            } border rounded-full text-sm font-medium`}
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ delay: 0.3, type: "spring" }}
          >
            <Activity className="w-3 h-3 inline mr-1" />
            {setupType === 'basic'
              ? (healthStatus.api.status === 'healthy' 
                ? 'API Operational'
                : healthStatus.api.status === 'down'
                ? 'API Issues Detected'
                : 'API Degraded Performance')
              : (healthStatus.api.status === 'healthy' && healthStatus.llm.status === 'healthy' 
                ? 'All Systems Operational'
                : healthStatus.api.status === 'down' || healthStatus.llm.status === 'error'
                ? 'Service Issues Detected'
                : 'Degraded Performance')
            }
          </motion.div>
          
          <motion.div 
            className="flex items-center space-x-3"
            variants={itemVariants}
          >
            {setupType !== 'basic' && (
              <Button 
                onClick={() => checkLlmHealth()} 
                disabled={isLoading}
                variant="outline"
                size="sm"
                className="flex items-center space-x-2 rounded-xl"
              >
                <TrendingUp className="w-4 h-4" />
                <span>Test LLM</span>
              </Button>
            )}
            <Button 
              onClick={() => setupType === 'basic' ? checkHealth(false) : checkHealth(true)} 
              disabled={isLoading}
              variant="outline"
              className="flex items-center space-x-2 hover:scale-105 transition-transform rounded-xl"
            >
              {isLoading ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <RefreshCw className="w-4 h-4" />
              )}
              <span>{setupType === 'basic' ? 'Check API' : 'Check Services'}</span>
            </Button>
          </motion.div>
        </motion.div>
        
        <motion.div 
          className="grid gap-3 grid-cols-1 md:grid-cols-2"
          variants={containerVariants}
        >
          {/* API Health */}
          <motion.div variants={itemVariants} className="h-full">
            <Card className={`bg-gradient-to-br ${getStatusColor(healthStatus.api.status)} transition-all duration-300 h-full flex flex-col rounded-xl`}>
              <CardHeader className="pb-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-3">
                    {getStatusIcon(healthStatus.api.status)}
                    <div>
                      <CardTitle className="text-lg">API Service</CardTitle>
                      <CardDescription className="capitalize">
                        {getStatusText(healthStatus.api.status, 'api')}
                      </CardDescription>
                    </div>
                  </div>
                  <Zap className="w-5 h-5 text-muted-foreground" />
                </div>
              </CardHeader>
              <CardContent className="flex-1">
                <div className="space-y-3">
                  {healthStatus.api.responseTime && (
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-muted-foreground">Response Time</span>
                      <span className="text-sm font-medium">{healthStatus.api.responseTime}ms</span>
                    </div>
                  )}
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-muted-foreground">Last Checked</span>
                    <span className="text-sm font-medium">
                      {new Date(healthStatus.api.lastChecked).toLocaleTimeString()}
                    </span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-muted-foreground">Service Type</span>
                    <span className="text-sm font-medium">REST API</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-muted-foreground">Endpoint</span>
                    <span className="text-sm font-medium">localhost:5000</span>
                  </div>
                </div>
              </CardContent>
            </Card>
          </motion.div>

          {/* LLM Health - Only show in local/groq mode */}
          {setupType !== 'basic' && (
            <motion.div variants={itemVariants} className="h-full">
              <Card className={`bg-gradient-to-br ${getStatusColor(healthStatus.llm.status)} transition-all duration-300 h-full flex flex-col rounded-xl`}>
                <CardHeader className="pb-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-3">
                      {getStatusIcon(healthStatus.llm.status)}
                      <div>
                        <CardTitle className="text-lg">LLM Service</CardTitle>
                        <CardDescription className="capitalize">
                          {getStatusText(healthStatus.llm.status, 'llm')}
                        </CardDescription>
                      </div>
                    </div>
                    <TrendingUp className="w-5 h-5 text-muted-foreground" />
                  </div>
                </CardHeader>
                <CardContent className="flex-1">
                  <div className="space-y-3">
                    {healthStatus.llm.rateLimitInfo && (
                      <>
                        <div className="space-y-2">
                          <div className="flex justify-between items-center">
                            <span className="text-sm text-muted-foreground">Daily Limit</span>
                            <span className="text-sm font-medium">
                              {healthStatus.llm.rateLimitInfo.used.toLocaleString()} / {healthStatus.llm.rateLimitInfo.limit.toLocaleString()}
                            </span>
                          </div>
                          <div className="w-full bg-muted rounded-full h-2">
                            <div 
                              className="bg-yellow-500 h-2 rounded-full transition-all duration-300" 
                              style={{ 
                                width: `${(healthStatus.llm.rateLimitInfo.used / healthStatus.llm.rateLimitInfo.limit) * 100}%` 
                              }}
                            />
                          </div>
                        </div>
                        
                        {countdown !== null && (
                          <div className="flex items-center space-x-2 p-3 bg-yellow-500/10 border border-yellow-500/20 rounded-xl">
                            <Clock className="w-4 h-4 text-yellow-500" />
                            <div className="flex-1">
                            <div className="text-sm font-medium text-yellow-700 dark:text-yellow-300">
                              Rate limit resets in
                            </div>
                            <div className="text-lg font-mono font-bold text-yellow-600 dark:text-yellow-400">
                              {formatCountdown(countdown)}
                            </div>
                          </div>
                        </div>
                      )}
                    </>
                  )}
                  
                  {!healthStatus.llm.rateLimitInfo && !healthStatus.llm.lastError && (
                    <div className="space-y-3">
                      {healthStatus.llm.localModel ? (
                        // Local LLM mode - show local model info
                        <>
                          <div className="flex justify-between items-center">
                            <span className="text-sm text-muted-foreground">Service Provider</span>
                            <span className="text-sm font-medium">Local LLM</span>
                          </div>
                          <div className="flex justify-between items-center">
                            <span className="text-sm text-muted-foreground">Model</span>
                            <span className="text-sm font-medium">{healthStatus.llm.localModel}</span>
                          </div>
                          <div className="flex justify-between items-center">
                            <span className="text-sm text-muted-foreground">Type</span>
                            <span className="text-sm font-medium">Self-hosted</span>
                          </div>
                        </>
                      ) : (
                        // Groq mode or other - show original info
                        <>
                          <div className="flex justify-between items-center">
                            <span className="text-sm text-muted-foreground">Service Provider</span>
                            <span className="text-sm font-medium">Groq</span>
                          </div>
                          <div className="flex justify-between items-center">
                            <span className="text-sm text-muted-foreground">Model</span>
                            <span className="text-sm font-medium">Llama 3.3 70B</span>
                          </div>
                          <div className="flex justify-between items-center">
                            <span className="text-sm text-muted-foreground">Daily Limit</span>
                            <span className="text-sm font-medium">100K tokens</span>
                          </div>
                        </>
                      )}
                    </div>
                  )}
                  
                  {healthStatus.llm.lastError && (
                    <div className="space-y-2">
                      <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-xl">
                        <div className="text-sm text-red-700 dark:text-red-300 break-words">
                          {healthStatus.llm.lastError.length > 100 
                            ? `${healthStatus.llm.lastError.substring(0, 100)}...`
                            : healthStatus.llm.lastError
                          }
                        </div>
                      </div>
                      
                      {/* Debug info */}
                      <div className="text-xs text-muted-foreground">
                        Debug: localModel={healthStatus.llm.localModel || 'none'}, status={healthStatus.llm.status}
                        {healthStatus.llm.details && (
                          <>, modelAvailable=${healthStatus.llm.details.modelAvailable}</>
                        )}
                      </div>
                      
                      {/* Show appropriate action button based on error type */}
                      {(healthStatus.llm.status === 'error' || healthStatus.llm.status === 'warning') && (
                        <>
                          {/* Check if this is specifically a model missing error */}
                          {healthStatus.llm.details && !healthStatus.llm.details.modelAvailable ? (
                            <Button 
                              onClick={downloadModel}
                              disabled={isLoading}
                              variant="outline"
                              size="sm"
                              className="w-full flex items-center justify-center space-x-2 text-blue-600 hover:text-blue-700 border-blue-200 hover:border-blue-300 bg-blue-50 hover:bg-blue-100 dark:bg-blue-950 dark:border-blue-800 dark:text-blue-400 dark:hover:text-blue-300"
                            >
                              {isLoading ? (
                                <Loader2 className="w-4 h-4 animate-spin" />
                              ) : (
                                <Download className="w-4 h-4" />
                              )}
                              <span>Download Model</span>
                            </Button>
                          ) : (
                            <Button 
                              onClick={restartLocalLLM}
                              disabled={isLoading}
                              variant="outline"
                              size="sm"
                              className="w-full flex items-center justify-center space-x-2 text-orange-600 hover:text-orange-700 border-orange-200 hover:border-orange-300 bg-orange-50 hover:bg-orange-100 dark:bg-orange-950 dark:border-orange-800 dark:text-orange-400 dark:hover:text-orange-300"
                            >
                              {isLoading ? (
                                <Loader2 className="w-4 h-4 animate-spin" />
                              ) : (
                                <RefreshCw className="w-4 h-4" />
                              )}
                              <span>Restart LLM Model</span>
                            </Button>
                          )}
                        </>
                      )}
                    </div>
                  )}
                  
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-muted-foreground">Last Checked</span>
                    <span className="text-sm font-medium">
                      {new Date(healthStatus.llm.lastChecked).toLocaleTimeString()}
                    </span>
                  </div>
                </div>
              </CardContent>
            </Card>
          </motion.div>
          )}
        </motion.div>

        {/* Additional Information */}
        <motion.div variants={itemVariants} className="mt-3">
          <Card className="bg-gradient-to-br from-blue-500/5 to-indigo-500/5 border-blue-500/20 rounded-xl">
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center space-x-2">
                <Activity className="w-4 h-4 text-blue-500" />
                <span>System Information</span>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
                <div className="text-center">
                  <div className="font-medium text-foreground">Auto Refresh</div>
                  <div className="text-muted-foreground">API only (30s)</div>
                </div>
                <div className="text-center">
                  <div className="font-medium text-foreground">LLM Monitoring</div>
                  <div className="text-muted-foreground">Rate-limit aware</div>
                </div>
                <div className="text-center">
                  <div className="font-medium text-foreground">Rate Limit</div>
                  <div className="text-muted-foreground">100K tokens/day</div>
                </div>
                <div className="text-center">
                  <div className="font-medium text-foreground">API Endpoint</div>
                  <div className="text-muted-foreground">localhost:5000</div>
                </div>
              </div>
            </CardContent>
          </Card>
        </motion.div>

        {/* Download Modal */}
        <OllamaInstallModal
          isOpen={isDownloadModalOpen}
          progress={downloadProgress}
          step={downloadStep}
          message={downloadMessage}
          error={downloadError}
          subProgress={downloadSubProgress}
          totalSize={downloadTotalSize}
          cancellable={downloadCancellable}
          timeEstimate={downloadTimeEstimate}
          downloadSpeed={downloadSpeed}
          onClose={handleDownloadClose}
          onCancel={handleDownloadCancel}
        />
      </div>
    </motion.div>
  )
}

export default HealthManager
