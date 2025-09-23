import React, { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import AppLogo from './AppLogo'
import { 
  Database,
  Zap,
  Brain,
  Code,
  Search,
  Settings,
  Activity,
  CheckCircle,
  Loader2,
  Cpu,
  Shield,
  Network
} from 'lucide-react'

interface LoadingScreenProps {
  type?: 'generating' | 'connecting' | 'analyzing' | 'executing' | 'loading' | 'app-init' | 'mode-switching' | 'llm-init'
  title?: string
  subtitle?: string
  progress?: number
  showProgress?: boolean
  animated?: boolean
  size?: 'sm' | 'md' | 'lg' | 'xl' | 'fullscreen'
  className?: string
  currentStep?: string
}

const LoadingScreen: React.FC<LoadingScreenProps> = ({
  type = 'app-init',
  title,
  subtitle,
  progress = 0,
  showProgress = true,
  animated = true,
  size = 'fullscreen',
  className = '',
  currentStep: customStep
}) => {
  const [currentStepIndex, setCurrentStepIndex] = useState(0)
  const [animatedProgress, setAnimatedProgress] = useState(0)
  const [appProgress, setAppProgress] = useState(0)

  // Animated steps for different loading types
  const loadingSteps = {
    'app-init': [
      { icon: Shield, text: 'Initializing security protocols...', color: 'text-blue-500' },
      { icon: Database, text: 'Connecting to database services...', color: 'text-green-500' },
      { icon: Network, text: 'Establishing API connections...', color: 'text-purple-500' },
      { icon: Brain, text: 'Loading AI models...', color: 'text-orange-500' },
      { icon: Cpu, text: 'Optimizing performance...', color: 'text-red-500' },
      { icon: CheckCircle, text: 'Ready to generate SQL!', color: 'text-emerald-500' }
    ],
    'llm-init': [
      { icon: Search, text: 'Checking Ollama installation...', color: 'text-blue-500' },
      { icon: Brain, text: 'Verifying qwen3:8b model...', color: 'text-purple-500' },
      { icon: Cpu, text: 'Starting local LLM service...', color: 'text-orange-500' },
      { icon: Activity, text: 'Warming up model...', color: 'text-yellow-500' },
      { icon: CheckCircle, text: 'Local LLM ready!', color: 'text-emerald-500' }
    ],
    'mode-switching': [
      { icon: Settings, text: 'Stopping current services...', color: 'text-yellow-500' },
      { icon: Shield, text: 'Updating configuration...', color: 'text-blue-500' },
      { icon: Network, text: 'Starting API services...', color: 'text-purple-500' },
      { icon: Activity, text: 'Verifying connections...', color: 'text-green-500' },
      { icon: CheckCircle, text: 'Mode switch complete!', color: 'text-emerald-500' }
    ],
    generating: [
      { icon: Brain, text: 'Understanding your query...', color: 'text-blue-500' },
      { icon: Search, text: 'Analyzing database schema...', color: 'text-green-500' },
      { icon: Code, text: 'Generating SQL code...', color: 'text-purple-500' },
      { icon: CheckCircle, text: 'Optimizing query...', color: 'text-orange-500' }
    ],
    connecting: [
      { icon: Database, text: 'Establishing connection...', color: 'text-blue-500' },
      { icon: Settings, text: 'Configuring settings...', color: 'text-green-500' },
      { icon: CheckCircle, text: 'Verifying credentials...', color: 'text-purple-500' }
    ],
    analyzing: [
      { icon: Search, text: 'Scanning database structure...', color: 'text-blue-500' },
      { icon: Activity, text: 'Mapping relationships...', color: 'text-green-500' },
      { icon: Brain, text: 'Building context...', color: 'text-purple-500' }
    ],
    executing: [
      { icon: Zap, text: 'Executing query...', color: 'text-blue-500' },
      { icon: Database, text: 'Fetching results...', color: 'text-green-500' },
      { icon: Activity, text: 'Processing data...', color: 'text-purple-500' }
    ],
    loading: [
      { icon: Loader2, text: 'Loading...', color: 'text-blue-500' }
    ]
  }

  const steps = loadingSteps[type] || loadingSteps.loading

  // Size configurations
  const sizeConfig = {
    sm: {
      container: 'w-48 h-24',
      icon: 'w-4 h-4',
      title: 'text-sm',
      subtitle: 'text-xs',
      progress: 'h-1',
      logo: 'w-8 h-8',
      wrapper: 'p-4'
    },
    md: {
      container: 'w-64 h-32',
      icon: 'w-5 h-5',
      title: 'text-base',
      subtitle: 'text-sm',
      progress: 'h-2',
      logo: 'w-12 h-12',
      wrapper: 'p-6'
    },
    lg: {
      container: 'w-80 h-40',
      icon: 'w-6 h-6',
      title: 'text-lg',
      subtitle: 'text-base',
      progress: 'h-2',
      logo: 'w-16 h-16',
      wrapper: 'p-8'
    },
    xl: {
      container: 'w-96 h-48',
      icon: 'w-8 h-8',
      title: 'text-xl',
      subtitle: 'text-lg',
      progress: 'h-3',
      logo: 'w-20 h-20',
      wrapper: 'p-10'
    },
    fullscreen: {
      container: 'min-h-screen w-full',
      icon: 'w-8 h-8',
      title: 'text-3xl',
      subtitle: 'text-lg',
      progress: 'h-3',
      logo: 'w-24 h-24',
      wrapper: 'p-12'
    }
  }

  const config = sizeConfig[size]

  // Auto-cycle through steps for app initialization and mode switching
  useEffect(() => {
    // Don't auto-cycle if a custom step is provided
    if (customStep) return

    if (type === 'app-init') {
      const interval = setInterval(() => {
        setCurrentStepIndex((prev) => {
          const next = prev + 1
          if (next >= steps.length) {
            clearInterval(interval)
            return prev
          }
          return next
        })
        setAppProgress((prev) => Math.min(100, prev + (100 / steps.length)))
      }, 1500)

      return () => clearInterval(interval)
    } else if (type === 'mode-switching') {
      const interval = setInterval(() => {
        setCurrentStepIndex((prev) => {
          const next = prev + 1
          if (next >= steps.length) {
            clearInterval(interval)
            return prev
          }
          return next
        })
        setAppProgress((prev) => Math.min(100, prev + (100 / steps.length)))
      }, 2000) // Slower progression for mode switching

      return () => clearInterval(interval)
    } else if (type === 'llm-init') {
      const interval = setInterval(() => {
        setCurrentStepIndex((prev) => {
          const next = prev + 1
          if (next >= steps.length) {
            clearInterval(interval)
            return prev
          }
          return next
        })
        setAppProgress((prev) => Math.min(100, prev + (100 / steps.length)))
      }, 3000) // Slower progression for LLM initialization

      return () => clearInterval(interval)
    } else if (animated && steps.length > 1) {
      const interval = setInterval(() => {
        setCurrentStepIndex((prev) => (prev + 1) % steps.length)
      }, 2000)

      return () => clearInterval(interval)
    }
  }, [animated, steps.length, type, customStep])

  // Animate progress
  useEffect(() => {
    if (!showProgress) return

    // Use custom progress when currentStep is provided, otherwise use auto progress
    const targetProgress = customStep 
      ? Math.min(100, Math.max(0, progress))
      : (type === 'app-init' || type === 'mode-switching') 
        ? appProgress 
        : Math.min(100, Math.max(0, progress))
        
    const increment = (targetProgress - animatedProgress) / 20

    const interval = setInterval(() => {
      setAnimatedProgress(prev => {
        const next = prev + increment
        if (Math.abs(next - targetProgress) < 1) {
          clearInterval(interval)
          return targetProgress
        }
        return next
      })
    }, 50)

    return () => clearInterval(interval)
  }, [progress, showProgress, appProgress, type, customStep])

  // Determine icon and color based on custom step content or current step
  let CurrentIcon = steps[currentStepIndex]?.icon || Loader2
  let currentColor = steps[currentStepIndex]?.color || 'text-blue-500'
  
  // Enhanced step detection for downloads
  if (customStep) {
    const stepLower = customStep.toLowerCase()
    if (stepLower.includes('check') || stepLower.includes('verify')) {
      CurrentIcon = Search
      currentColor = 'text-blue-500'
    } else if (stepLower.includes('download') || stepLower.includes('pulling')) {
      CurrentIcon = Network
      currentColor = 'text-blue-500'
    } else if (stepLower.includes('starting') || stepLower.includes('start')) {
      CurrentIcon = Cpu
      currentColor = 'text-orange-500'
    } else if (stepLower.includes('success') || stepLower.includes('ready') || stepLower.includes('running')) {
      CurrentIcon = CheckCircle
      currentColor = 'text-emerald-500'
    } else if (stepLower.includes('failed') || stepLower.includes('error')) {
      CurrentIcon = Activity
      currentColor = 'text-red-500'
    } else if (stepLower.includes('required') || stepLower.includes('setup')) {
      CurrentIcon = Settings
      currentColor = 'text-yellow-500'
    } else if (stepLower.includes('install')) {
      CurrentIcon = Settings
      currentColor = 'text-purple-500'
    } else {
      CurrentIcon = Brain
      currentColor = 'text-purple-500'
    }
  }
  
  const currentText = customStep || steps[currentStepIndex]?.text || 'Loading...'
  
  // Extract download percentage for enhanced display
  const isDownloadStep = customStep && customStep.toLowerCase().includes('%')
  const downloadMatch = customStep?.match(/(\d+(?:\.\d+)?)%/)
  const downloadPercentage = downloadMatch ? parseFloat(downloadMatch[1]) : 0
  const sizeMatch = customStep?.match(/\(([^)]+)\)/)
  const sizeInfo = sizeMatch ? sizeMatch[1] : ''

  if (size === 'fullscreen') {
    return (
      <div className={`${config.container} bg-gradient-to-br from-background via-muted/20 to-background flex items-center justify-center ${className}`}>
        {/* Animated Background Pattern */}
        <div className="absolute inset-0 overflow-hidden">
          <div className="absolute inset-0 opacity-10">
            {[...Array(20)].map((_, i) => (
              <motion.div
                key={i}
                className="absolute w-2 h-2 bg-primary rounded-full"
                style={{
                  left: `${Math.random() * 100}%`,
                  top: `${Math.random() * 100}%`
                }}
                animate={{
                  scale: [0, 1, 0],
                  opacity: [0, 0.8, 0]
                }}
                transition={{
                  duration: 3,
                  repeat: Infinity,
                  delay: i * 0.2,
                  ease: 'easeInOut'
                }}
              />
            ))}
          </div>
        </div>

        <div className={`relative z-10 text-center space-y-8 ${config.wrapper}`}>
          {/* Enhanced Logo */}
          <motion.div
            className="relative mx-auto flex justify-center"
            initial={{ scale: 0.8, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ duration: 0.8, ease: 'easeOut' }}
          >
            <AppLogo size="xl" animated={true} showOrbits={true} />
          </motion.div>

          {/* Brand Text */}
          <motion.div
            className="space-y-2"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4, duration: 0.6 }}
          >
            <h1 className={`font-bold bg-gradient-to-r from-blue-600 via-purple-600 to-green-600 bg-clip-text text-transparent ${config.title}`}>
              NaturalToSQL
            </h1>
            <p className={`text-muted-foreground ${config.subtitle}`}>
              Transform natural language into powerful SQL queries
            </p>
          </motion.div>

          {/* Loading Status */}
          <motion.div
            className="space-y-4"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.8 }}
          >
            {/* Current Step */}
            <AnimatePresence mode="wait">
              <motion.div
                key={currentStepIndex}
                className="flex items-center justify-center space-x-3"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                transition={{ duration: 0.4 }}
              >
                <motion.div
                  animate={{
                    scale: [1, 1.2, 1],
                    rotate: CurrentIcon === Loader2 ? [0, 360] : [0, 0]
                  }}
                  transition={{
                    duration: CurrentIcon === Loader2 ? 1 : 2,
                    repeat: Infinity,
                    ease: 'easeInOut'
                  }}
                >
                  <CurrentIcon className={`${config.icon} ${currentColor}`} />
                </motion.div>
                <span className="text-foreground font-medium">{currentText}</span>
              </motion.div>
            </AnimatePresence>

            {/* Progress Bar */}
            {showProgress && (
              <div className="w-80 mx-auto space-y-2">
                <div className={`w-full bg-muted rounded-full overflow-hidden ${config.progress}`}>
                  <motion.div
                    className="h-full bg-gradient-to-r from-blue-500 via-purple-500 to-green-500 rounded-full shadow-lg"
                    initial={{ width: '0%' }}
                    animate={{ 
                      width: isDownloadStep && downloadPercentage > 0 
                        ? `${Math.min(100, Math.max(0, downloadPercentage))}%`
                        : `${animatedProgress}%` 
                    }}
                    transition={{ duration: 0.8, ease: 'easeOut' }}
                  />
                </div>
                <div className="flex justify-between text-sm text-muted-foreground">
                  <span>
                    {isDownloadStep && sizeInfo ? sizeInfo : 'Loading components...'}
                  </span>
                  <span>
                    {isDownloadStep && downloadPercentage > 0 
                      ? `${downloadPercentage.toFixed(1)}%`
                      : `${Math.round(animatedProgress)}%`
                    }
                  </span>
                </div>
              </div>
            )}

            {/* Step Indicators */}
            <div className="flex justify-center space-x-2">
              {steps.map((_: any, index: number) => (
                <motion.div
                  key={index}
                  className={`w-2 h-2 rounded-full transition-all duration-300 ${
                    index === currentStepIndex 
                      ? 'bg-primary scale-125' 
                      : index < currentStepIndex 
                        ? 'bg-green-500' 
                        : 'bg-muted'
                  }`}
                  animate={{
                    scale: index === currentStepIndex ? 1.5 : 1
                  }}
                />
              ))}
            </div>
          </motion.div>
        </div>
      </div>
    )
  }

  // Compact version for inline loading
  return (
    <div className={`flex flex-col items-center justify-center ${config.container} ${className}`}>
      {/* Animated Background */}
      <div className="absolute inset-0 overflow-hidden rounded-lg">
        <div className="absolute inset-0 bg-gradient-to-br from-blue-500/5 via-purple-500/5 to-green-500/5 animate-pulse" />
        <motion.div
          className="absolute inset-0 bg-gradient-to-r from-transparent via-white/10 to-transparent"
          animate={{
            x: ['-100%', '100%']
          }}
          transition={{
            duration: 2,
            repeat: Infinity,
            ease: 'linear'
          }}
        />
      </div>

      {/* Main Content */}
      <div className="relative z-10 flex flex-col items-center space-y-4">
        {/* Animated Icon */}
        <motion.div
          className="relative"
          animate={{
            scale: [1, 1.1, 1],
            rotate: CurrentIcon === Loader2 ? [0, 360] : [0, 0]
          }}
          transition={{
            duration: CurrentIcon === Loader2 ? 1 : 2,
            repeat: Infinity,
            ease: 'easeInOut'
          }}
        >
          {/* Glow Effect */}
          <motion.div
            className={`absolute inset-0 ${config.icon} ${currentColor} opacity-20 blur-md`}
            animate={{
              scale: [1, 1.5, 1],
              opacity: [0.2, 0.4, 0.2]
            }}
            transition={{
              duration: 2,
              repeat: Infinity,
              ease: 'easeInOut'
            }}
          />
          
          {/* Icon */}
          <CurrentIcon className={`${config.icon} ${currentColor} relative z-10`} />
        </motion.div>

        {/* Text Content */}
        <div className="text-center space-y-2">
          <AnimatePresence mode="wait">
            <motion.h3
              key={title || currentText}
              className={`font-semibold text-foreground ${config.title}`}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.3 }}
            >
              {title || currentText}
            </motion.h3>
          </AnimatePresence>
          
          {subtitle && (
            <motion.p
              className={`text-muted-foreground ${config.subtitle}`}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.2 }}
            >
              {subtitle}
            </motion.p>
          )}
        </div>

        {/* Progress Bar */}
        {showProgress && (
          <div className="w-full max-w-xs">
            <div className={`w-full bg-muted rounded-full overflow-hidden ${config.progress}`}>
              <motion.div
                className="h-full bg-gradient-to-r from-blue-500 via-purple-500 to-green-500 rounded-full"
                initial={{ width: '0%' }}
                animate={{ width: `${animatedProgress}%` }}
                transition={{ duration: 0.5, ease: 'easeOut' }}
              />
            </div>
            <motion.p 
              className="text-xs text-muted-foreground text-center mt-1"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.3 }}
            >
              {Math.round(animatedProgress)}%
            </motion.p>
          </div>
        )}

        {/* Dots Indicator */}
        {animated && steps.length > 1 && (
          <div className="flex space-x-1">
            {steps.map((_: any, index: number) => (
              <motion.div
                key={index}
                className={`w-2 h-2 rounded-full transition-colors duration-300 ${
                  index === currentStepIndex ? 'bg-primary' : 'bg-muted'
                }`}
                animate={{
                  scale: index === currentStepIndex ? 1.2 : 1
                }}
                transition={{ duration: 0.3 }}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

export default LoadingScreen
