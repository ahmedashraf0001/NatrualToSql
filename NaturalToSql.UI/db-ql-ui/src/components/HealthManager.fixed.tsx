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
  Loader2
} from 'lucide-react'
import { healthMonitoringService } from '@/services/healthMonitoring'
import { NotificationMessage } from '@/types'
import { HealthStatus } from '@/types/health'

interface HealthManagerProps {
  onNotification: (notification: Omit<NotificationMessage, 'id'>) => void
  onHealthStatusUpdate?: (status: HealthStatus) => void
}

const HealthManager: React.FC<HealthManagerProps> = ({ onNotification, onHealthStatusUpdate }) => {
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
        return <AlertTriangle className="w-5 h-5 text-yellow-500" />
      case 'down':
      case 'error':
        return <XCircle className="w-5 h-5 text-red-500" />
      default:
        return <Activity className="w-5 h-5 text-gray-500" />
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
      <div className="space-y-4 w-full max-w-4xl">
        {/* Status Overview and Controls */}
        <motion.div 
          className="flex items-center justify-between mb-4"
          variants={itemVariants}
        >
          <motion.div 
            className={`px-3 py-1.5 bg-gradient-to-r ${
              healthStatus.api.status === 'healthy' && healthStatus.llm.status === 'healthy'
                ? 'from-green-500/10 to-emerald-500/10 border-green-500/20 text-green-600 dark:text-green-400'
                : healthStatus.api.status === 'down' || healthStatus.llm.status === 'error'
                ? 'from-red-500/10 to-pink-500/10 border-red-500/20 text-red-600 dark:text-red-400'
                : 'from-yellow-500/10 to-orange-500/10 border-yellow-500/20 text-yellow-600 dark:text-yellow-400'
            } border rounded-full text-sm font-medium`}
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ delay: 0.3, type: "spring" }}
          >
            <Activity className="w-3 h-3 inline mr-1" />
            {healthStatus.api.status === 'healthy' && healthStatus.llm.status === 'healthy' 
              ? 'All Systems Operational'
              : healthStatus.api.status === 'down' || healthStatus.llm.status === 'error'
              ? 'Service Issues Detected'
              : 'Degraded Performance'
            }
          </motion.div>
          
          <motion.div 
            className="flex items-center space-x-3"
            variants={itemVariants}
          >
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
            <Button 
              onClick={() => checkHealth(true)} 
              disabled={isLoading}
              variant="outline"
              className="flex items-center space-x-2 hover:scale-105 transition-transform rounded-xl"
            >
              {isLoading ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <RefreshCw className="w-4 h-4" />
              )}
              <span>Refresh</span>
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
                        {healthStatus.api.status === 'healthy' ? 'Operational' : healthStatus.api.status}
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

          {/* LLM Health */}
          <motion.div variants={itemVariants} className="h-full">
            <Card className={`bg-gradient-to-br ${getStatusColor(healthStatus.llm.status)} transition-all duration-300 h-full flex flex-col rounded-xl`}>
              <CardHeader className="pb-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-3">
                    {getStatusIcon(healthStatus.llm.status)}
                    <div>
                      <CardTitle className="text-lg">LLM Service</CardTitle>
                      <CardDescription className="capitalize">
                        {healthStatus.llm.status === 'healthy' ? 'Operational' : 
                         healthStatus.llm.status === 'rate_limited' ? 'Rate Limited' : 
                         healthStatus.llm.status}
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
                    </div>
                  )}
                  
                  {healthStatus.llm.lastError && (
                    <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-xl">
                      <div className="text-sm text-red-700 dark:text-red-300 break-words">
                        {healthStatus.llm.lastError.length > 100 
                          ? `${healthStatus.llm.lastError.substring(0, 100)}...`
                          : healthStatus.llm.lastError
                        }
                      </div>
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
      </div>
    </motion.div>
  )
}

export default HealthManager
