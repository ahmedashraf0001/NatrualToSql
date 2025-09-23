import React, { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { 
  X, 
  Brain, 
  Cpu, 
  Database, 
  Key, 
  Server, 
  Loader2,
  CheckCircle,
  AlertCircle,
  Eye,
  EyeOff
} from 'lucide-react'
import { apiService } from '../services/api'

interface ModeChangeModalProps {
  isOpen: boolean
  currentMode: 'groq' | 'local' | 'basic'
  targetMode?: 'groq' | 'local' | 'basic' // Optional mode to pre-select
  onClose: () => void
  onModeChanged: (mode: 'groq' | 'local' | 'basic', apiKey?: string) => void
  onNotification: (notification: {
    type: 'success' | 'error' | 'warning' | 'info'
    title: string
    message: string
    duration?: number
  }) => void
}

const ModeChangeModal: React.FC<ModeChangeModalProps> = ({
  isOpen,
  currentMode,
  targetMode,
  onClose,
  onModeChanged,
  onNotification
}) => {
  const [selectedMode, setSelectedMode] = useState<'groq' | 'local' | 'basic'>(currentMode)
  const [apiKey, setApiKey] = useState('')
  const [showApiKey, setShowApiKey] = useState(false)
  const [isTestingKey, setIsTestingKey] = useState(false)
  const [keyTestResult, setKeyTestResult] = useState<'success' | 'error' | null>(null)
  const [isApplying, setIsApplying] = useState(false)
  const [loadingMessage, setLoadingMessage] = useState('')

  // Reset state when modal opens and load existing API key if switching to Groq
  React.useEffect(() => {
    if (isOpen) {
      // Use targetMode if provided, otherwise use currentMode
      setSelectedMode(targetMode || currentMode)
      setApiKey('')
      setShowApiKey(false)
      setIsTestingKey(false)
      setKeyTestResult(null)
      setIsApplying(false)
      setLoadingMessage('')
      
      // Load existing API key if available
      loadExistingApiKey()
    }
  }, [isOpen, currentMode, targetMode])

  // Load existing API key when switching to Groq mode
  React.useEffect(() => {
    if (isOpen && selectedMode === 'groq') {
      loadExistingApiKey()
    }
  }, [selectedMode, isOpen])

  const loadExistingApiKey = async () => {
    if (selectedMode === 'groq' && window.electronAPI?.getGroqApiKeyStatus) {
      try {
        const keyStatus = await window.electronAPI.getGroqApiKeyStatus()
        if (keyStatus.hasApiKey) {
          // We can't show the full key for security, but we can indicate it exists
          setApiKey('') // Keep empty to force user to re-enter for security
          setKeyTestResult('success') // Mark as valid since it exists
          onNotification({
            type: 'info',
            title: 'Existing API Key Found',
            message: `Found existing API key (${keyStatus.keyPrefix}). You can use it or enter a new one.`,
            duration: 4000
          })
        }
      } catch (error) {
        console.warn('Failed to check existing API key:', error)
      }
    }
  }

  const modeOptions = [
    {
      id: 'groq' as const,
      name: 'Groq AI',
      description: 'Use Groq\'s fast AI models for natural language to SQL conversion',
      icon: Brain,
      color: 'text-blue-500',
      bgColor: 'bg-blue-500/10',
      borderColor: 'border-blue-500/20',
      requiresApiKey: true,
      features: ['Fast AI processing', 'High accuracy', 'Cloud-based', 'Requires API key']
    },
    {
      id: 'local' as const,
      name: 'Local LLM',
      description: 'Use a locally installed language model for privacy and offline use',
      icon: Cpu,
      color: 'text-green-500',
      bgColor: 'bg-green-500/10',
      borderColor: 'border-green-500/20',
      requiresApiKey: false,
      features: ['Complete privacy', 'Offline capability', 'No API costs', 'Local processing']
    },
    {
      id: 'basic' as const,
      name: 'Basic Mode',
      description: 'Use the application for database management without AI assistance',
      icon: Database,
      color: 'text-gray-500',
      bgColor: 'bg-gray-500/10',
      borderColor: 'border-gray-500/20',
      requiresApiKey: false,
      features: ['Database browsing', 'Manual SQL editing', 'Schema exploration', 'No AI features']
    }
  ]

  const testApiKey = async () => {
    if (!apiKey.trim()) {
      onNotification({
        type: 'warning',
        title: 'API Key Required',
        message: 'Please enter your Groq API key to test'
      })
      return
    }

    setIsTestingKey(true)
    setKeyTestResult(null)

    try {
      const result = await apiService.testGroqApiKey(apiKey.trim())
      
      if (result.valid) {
        setKeyTestResult('success')
        onNotification({
          type: 'success',
          title: 'API Key Valid',
          message: 'Your Groq API key is working correctly',
          duration: 3000
        })
      } else {
        setKeyTestResult('error')
        onNotification({
          type: 'error',
          title: 'API Key Invalid',
          message: result.message || 'The provided API key is not valid',
          duration: 5000
        })
      }
    } catch (error) {
      setKeyTestResult('error')
      onNotification({
        type: 'error',
        title: 'Test Failed',
        message: 'Could not test the API key. Please check your connection.',
        duration: 5000
      })
    } finally {
      setIsTestingKey(false)
    }
  }

  const handleApplyChanges = async () => {
    // Validate requirements
    if (selectedMode === 'groq') {
      // Check if we have a new API key or an existing valid one
      const hasNewApiKey = apiKey.trim()
      const hasExistingValidKey = keyTestResult === 'success' && !hasNewApiKey
      
      if (!hasNewApiKey && !hasExistingValidKey) {
        onNotification({
          type: 'warning',
          title: 'API Key Required',
          message: 'Please enter your Groq API key to use Groq mode'
        })
        return
      }

      if (hasNewApiKey && keyTestResult !== 'success') {
        onNotification({
          type: 'warning',
          title: 'Test API Key',
          message: 'Please test your API key before applying changes'
        })
        return
      }
    }

    setIsApplying(true)

    try {
      const modeName = modeOptions.find(m => m.id === selectedMode)?.name || selectedMode
      
      // Phase 1: Preparing mode change
      setLoadingMessage(`Preparing to switch to ${modeName}...`)
      await new Promise(resolve => setTimeout(resolve, 500))
      
      // Phase 2: Apply mode change
      // Note: API process stays running - only the user mode is updated via backend API
      // Note: API key is now handled by the backend through userService.updateUserMode()
      setLoadingMessage(`Switching to ${modeName}...`)
      await new Promise(resolve => setTimeout(resolve, 500))
      
      // Notify parent component about the mode change
      onModeChanged(selectedMode, selectedMode === 'groq' ? apiKey.trim() : undefined)
      
      // Phase 3: Success
      setLoadingMessage('Mode changed successfully!')
      await new Promise(resolve => setTimeout(resolve, 500))
      
      onNotification({
        type: 'success',
        title: 'Mode Changed',
        message: `Successfully switched to ${modeName}. ${selectedMode === 'basic' ? 'AI features are now disabled.' : 'The system is initializing...'}`,
        duration: 4000
      })
      
      onClose()
    } catch (error) {
      console.error('Mode change error:', error)
      onNotification({
        type: 'error',
        title: 'Failed to Change Mode',
        message: error instanceof Error ? error.message : 'An unexpected error occurred while changing the mode.',
        duration: 5000
      })
    } finally {
      setIsApplying(false)
      setLoadingMessage('')
    }
  }

  const resetForm = () => {
    setSelectedMode(currentMode)
    setApiKey('')
    setShowApiKey(false)
    setKeyTestResult(null)
    setIsTestingKey(false)
    setIsApplying(false)
  }

  const handleClose = () => {
    resetForm()
    onClose()
  }

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
        >
          {/* Backdrop */}
          <motion.div
            className="absolute inset-0 bg-black/50 backdrop-blur-sm"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={handleClose}
          />

          {/* Modal */}
          <motion.div
            className="relative w-full max-w-2xl max-h-[90vh] overflow-y-auto bg-background border border-border rounded-xl shadow-2xl"
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            transition={{ type: 'spring', duration: 0.3 }}
          >
            {/* Header */}
            <div className="sticky top-0 bg-background border-b border-border p-6">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-2xl font-bold text-foreground">Change AI Mode</h2>
                  <p className="text-muted-foreground mt-1">
                    Switch between different AI processing modes
                  </p>
                </div>
                <button
                  onClick={handleClose}
                  className="p-2 hover:bg-muted rounded-lg transition-colors"
                  disabled={isApplying}
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Content */}
            <div className="p-6 space-y-6">
              {/* Mode Selection */}
              <div className="space-y-4">
                <h3 className="text-lg font-semibold text-foreground">Select Mode</h3>
                <div className="space-y-3">
                  {modeOptions.map((mode) => {
                    const Icon = mode.icon
                    const isSelected = selectedMode === mode.id
                    const isCurrent = currentMode === mode.id

                    return (
                      <motion.div
                        key={mode.id}
                        className={`
                          relative p-4 rounded-lg border-2 cursor-pointer transition-all
                          ${isSelected 
                            ? `${mode.borderColor} ${mode.bgColor}` 
                            : 'border-border bg-background hover:bg-muted/50'
                          }
                        `}
                        onClick={() => setSelectedMode(mode.id)}
                        whileHover={{ scale: 1.01 }}
                        whileTap={{ scale: 0.99 }}
                      >
                        {isCurrent && (
                          <div className="absolute top-2 right-2">
                            <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800 dark:bg-green-800/20 dark:text-green-400">
                              Current
                            </span>
                          </div>
                        )}
                        
                        <div className="flex items-start space-x-4">
                          <div className={`p-2 rounded-lg ${mode.bgColor}`}>
                            <Icon className={`w-6 h-6 ${mode.color}`} />
                          </div>
                          
                          <div className="flex-1">
                            <h4 className="text-lg font-medium text-foreground">{mode.name}</h4>
                            <p className="text-muted-foreground text-sm mt-1">{mode.description}</p>
                            
                            <div className="mt-3 flex flex-wrap gap-2">
                              {mode.features.map((feature, index) => (
                                <span
                                  key={index}
                                  className="inline-flex items-center px-2 py-1 rounded-md text-xs font-medium bg-muted text-muted-foreground"
                                >
                                  {feature}
                                </span>
                              ))}
                            </div>
                          </div>
                          
                          <div className={`
                            w-5 h-5 rounded-full border-2 flex items-center justify-center
                            ${isSelected ? mode.borderColor : 'border-border'}
                          `}>
                            {isSelected && (
                              <div className={`w-2 h-2 rounded-full ${mode.color.replace('text-', 'bg-')}`} />
                            )}
                          </div>
                        </div>
                      </motion.div>
                    )
                  })}
                </div>
              </div>

              {/* API Key Input for Groq */}
              {selectedMode === 'groq' && (
                <motion.div
                  className="space-y-4 p-4 bg-blue-500/5 border border-blue-500/20 rounded-lg"
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                >
                  <div className="flex items-center space-x-2">
                    <Key className="w-5 h-5 text-blue-500" />
                    <h4 className="text-lg font-medium text-foreground">Groq API Configuration</h4>
                  </div>
                  
                  <div className="space-y-3">
                    <div>
                      <label className="block text-sm font-medium text-foreground mb-2">
                        API Key
                      </label>
                      <div className="relative">
                        <input
                          type={showApiKey ? 'text' : 'password'}
                          value={apiKey}
                          onChange={(e) => {
                            setApiKey(e.target.value)
                            setKeyTestResult(null)
                          }}
                          placeholder="Enter your Groq API key (gsk_...)"
                          className="w-full px-3 py-2 pr-20 border border-border rounded-lg bg-background text-foreground placeholder-muted-foreground focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        />
                        <div className="absolute right-2 top-1/2 transform -translate-y-1/2 flex items-center space-x-1">
                          {keyTestResult === 'success' && (
                            <CheckCircle className="w-4 h-4 text-green-500" />
                          )}
                          {keyTestResult === 'error' && (
                            <AlertCircle className="w-4 h-4 text-red-500" />
                          )}
                          <button
                            type="button"
                            onClick={() => setShowApiKey(!showApiKey)}
                            className="p-1 hover:bg-muted rounded"
                          >
                            {showApiKey ? (
                              <EyeOff className="w-4 h-4 text-muted-foreground" />
                            ) : (
                              <Eye className="w-4 h-4 text-muted-foreground" />
                            )}
                          </button>
                        </div>
                      </div>
                    </div>
                    
                    <button
                      onClick={testApiKey}
                      disabled={!apiKey.trim() || isTestingKey}
                      className="flex items-center space-x-2 px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                    >
                      {isTestingKey ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        <Server className="w-4 h-4" />
                      )}
                      <span>{isTestingKey ? 'Testing...' : 'Test API Key'}</span>
                    </button>
                  </div>
                </motion.div>
              )}

              {/* Local LLM Notice */}
              {selectedMode === 'local' && (
                <motion.div
                  className="p-4 bg-green-500/5 border border-green-500/20 rounded-lg"
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                >
                  <div className="flex items-start space-x-3">
                    <Cpu className="w-5 h-5 text-green-500 mt-0.5" />
                    <div>
                      <h4 className="text-lg font-medium text-foreground">Local LLM Setup</h4>
                      <p className="text-muted-foreground text-sm mt-1">
                        Use locally installed language models for complete privacy and offline operation.
                        This mode supports Ollama and other local AI models for secure, on-device processing.
                      </p>
                    </div>
                  </div>
                </motion.div>
              )}

              {/* Basic Mode Notice */}
              {selectedMode === 'basic' && (
                <motion.div
                  className="p-4 bg-gray-500/5 border border-gray-500/20 rounded-lg"
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                >
                  <div className="flex items-start space-x-3">
                    <Database className="w-5 h-5 text-gray-500 mt-0.5" />
                    <div>
                      <h4 className="text-lg font-medium text-foreground">Basic Mode</h4>
                      <p className="text-muted-foreground text-sm mt-1">
                        In basic mode, you can browse your database, explore schemas, and write SQL manually.
                        Natural language to SQL conversion will not be available.
                      </p>
                    </div>
                  </div>
                </motion.div>
              )}
            </div>

            {/* Footer */}
            <div className="sticky bottom-0 bg-background border-t border-border p-6">
              <div className="flex items-center justify-between">
                <div className="text-sm text-muted-foreground">
                  {selectedMode !== currentMode ? (
                    <span>Mode will change from <strong>{modeOptions.find(m => m.id === currentMode)?.name}</strong> to <strong>{modeOptions.find(m => m.id === selectedMode)?.name}</strong></span>
                  ) : (
                    <span>No changes to apply</span>
                  )}
                </div>
                
                <div className="flex items-center space-x-3">
                  <button
                    onClick={handleClose}
                    disabled={isApplying}
                    className="px-4 py-2 text-muted-foreground hover:text-foreground border border-border rounded-lg hover:bg-muted transition-colors disabled:opacity-50"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleApplyChanges}
                    disabled={
                      isApplying || 
                      selectedMode === currentMode || 
                      (selectedMode === 'groq' && (!apiKey.trim() || keyTestResult !== 'success'))
                    }
                    className="flex items-center space-x-2 px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors min-w-[140px]"
                  >
                    {isApplying ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <CheckCircle className="w-4 h-4" />
                    )}
                    <span>{isApplying ? (loadingMessage || 'Applying...') : 'Apply Changes'}</span>
                  </button>
                </div>
              </div>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}

export default ModeChangeModal
