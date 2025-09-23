import React, { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { NotificationMessage } from '@/types'
import { apiService } from '@/services/api'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent } from '@/components/ui/card'
import { 
  Brain, 
  Key, 
  Server, 
  ExternalLink,
  CheckCircle, 
  ArrowLeft, 
  ArrowRight,
  Sparkles,
  Zap,
  Shield,
  AlertCircle,
  Eye,
  EyeOff,
  Loader2,
  Globe,
  Info,
  Cpu,
  Cloud
} from 'lucide-react'

interface InitialSetupProps {
  onSetupCompleted: (setupType: 'groq' | 'local' | 'basic', apiKey?: string) => Promise<void>
  onNotification: (notification: Omit<NotificationMessage, 'id'>) => void
}

type SetupStep = 'welcome' | 'choose-option' | 'groq-setup' | 'local-setup' | 'confirm'
type SetupOption = 'groq' | 'local' | 'basic' | null

const InitialSetup: React.FC<InitialSetupProps> = ({ 
  onSetupCompleted, 
  onNotification
}) => {
  const [currentStep, setCurrentStep] = useState<SetupStep>('welcome')
  const [selectedOption, setSelectedOption] = useState<SetupOption>(null)
  const [groqApiKey, setGroqApiKey] = useState('')
  const [showApiKey, setShowApiKey] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [isTestingApiKey, setIsTestingApiKey] = useState(false)
  const [apiKeyValid, setApiKeyValid] = useState<boolean | null>(null)

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
    },
    exit: { 
      opacity: 0, 
      y: -20,
      transition: { duration: 0.3 }
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

  const stepIndicatorVariants = {
    hidden: { scale: 0.8, opacity: 0 },
    visible: { 
      scale: 1, 
      opacity: 1,
      transition: { duration: 0.3 }
    },
    active: {
      scale: 1.1,
      transition: { duration: 0.2 }
    }
  }

  // Clear API key validation when key changes
  useEffect(() => {
    setApiKeyValid(null)
  }, [groqApiKey])

  const handleOptionSelect = (option: SetupOption) => {
    setSelectedOption(option)
    if (option === 'groq') {
      setCurrentStep('groq-setup')
    } else if (option === 'local') {
      setCurrentStep('local-setup')
    } else if (option === 'basic') {
      setCurrentStep('confirm')
    }
  }

  const handleBack = () => {
    if (currentStep === 'choose-option') {
      setCurrentStep('welcome')
    } else if (currentStep === 'groq-setup' || currentStep === 'local-setup' || currentStep === 'confirm') {
      setCurrentStep('choose-option')
      setSelectedOption(null)
    }
  }

  const handleNext = () => {
    if (currentStep === 'welcome') {
      setCurrentStep('choose-option')
    } else if (currentStep === 'groq-setup' && groqApiKey.trim() && apiKeyValid === true) {
      setCurrentStep('confirm')
    } else if (currentStep === 'local-setup') {
      setCurrentStep('confirm')
    } else if (currentStep === 'confirm') {
      handleCompleteSetup()
    }
  }

  const openGroqApiKeyPage = () => {
    const groqUrl = 'https://console.groq.com/keys'
    // For now, just open in new tab since electron API doesn't have openExternal
    window.open(groqUrl, '_blank', 'noopener,noreferrer')
  }

  const testGroqApiKey = async () => {
    if (!groqApiKey.trim()) return

    setIsTestingApiKey(true)
    setApiKeyValid(null)

    try {
      const result = await apiService.testGroqApiKey(groqApiKey.trim())
      
      if (result.valid) {
        setApiKeyValid(true)
        onNotification({
          type: 'success',
          title: 'API Key Valid',
          message: 'Your Groq API key is working correctly!',
          duration: 3000
        })
      } else {
        setApiKeyValid(false)
        onNotification({
          type: 'error',
          title: 'Invalid API Key',
          message: result.message || 'The provided API key is invalid',
          duration: 5000
        })
      }
    } catch (error: any) {
      setApiKeyValid(false)
      
      // Extract error message from API error format
      let errorMessage = 'Could not validate the API key.'
      if (error.errors && Array.isArray(error.errors)) {
        errorMessage = error.errors.join('; ')
      } else if (error.message) {
        errorMessage = error.message
      }
      
      onNotification({
        type: 'error',
        title: 'Test Failed',
        message: errorMessage,
        duration: 5000
      })
    } finally {
      setIsTestingApiKey(false)
    }
  }

  const handleCompleteSetup = async () => {
    setIsLoading(true)

    try {
      // Wait for the parent component to complete the full setup process
      await onSetupCompleted(selectedOption || 'basic', selectedOption === 'groq' ? groqApiKey.trim() : undefined)
    } catch (error) {
      console.error('Setup completion error:', error)
      onNotification({
        type: 'error',
        title: 'Setup Failed',
        message: 'Failed to complete setup. Please try again.',
        duration: 5000
      })
    } finally {
      setIsLoading(false)
    }
  }

  const canProceed = () => {
    switch (currentStep) {
      case 'welcome':
        return true
      case 'choose-option':
        return !!selectedOption
      case 'groq-setup':
        return groqApiKey.trim() !== '' && apiKeyValid === true
      case 'local-setup':
        return true // For now, just allow proceeding
      case 'confirm':
        return true
      default:
        return false
    }
  }

  const getNextButtonText = () => {
    if (isLoading && currentStep === 'confirm') {
      return 'Initializing...'
    }
    
    switch (currentStep) {
      case 'welcome':
        return 'Get Started'
      case 'choose-option':
        return 'Continue'
      case 'groq-setup':
        return 'Continue to Setup'
      case 'local-setup':
        return 'Continue to Setup'
      case 'confirm':
        return 'Complete Setup'
      default:
        return 'Next'
    }
  }

  const getStepTitle = () => {
    switch (currentStep) {
      case 'welcome':
        return 'Welcome to NaturalToSQL'
      case 'choose-option':
        return 'Choose Your Setup'
      case 'groq-setup':
        return 'Configure Groq API'
      case 'local-setup':
        return 'Local LLM Setup'
      case 'confirm':
        return 'Confirm Setup'
      default:
        return 'Setup'
    }
  }

  return (
    <motion.div 
      className="bg-background p-4 sm:p-6 md:p-8 w-full max-w-4xl mx-auto relative"
      initial="hidden"
      animate="visible"
      variants={containerVariants}
    >
      {/* Loading Overlay */}
      {isLoading && currentStep === 'confirm' && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="absolute inset-0 bg-background/80 backdrop-blur-sm z-50 flex items-center justify-center rounded-2xl"
        >
          <div className="bg-card/90 backdrop-blur-sm border border-border/50 rounded-2xl p-8 shadow-2xl">
            <div className="text-center space-y-4">
              <div className="w-16 h-16 mx-auto">
                <Loader2 className="w-16 h-16 text-blue-500 animate-spin" />
              </div>
              <div>
                <h3 className="text-lg font-semibold text-foreground mb-2">Initializing System</h3>
                <p className="text-muted-foreground text-sm">
                  Setting up your AI-powered SQL environment...
                </p>
                <p className="text-muted-foreground text-xs mt-2">
                  This may take a few moments
                </p>
              </div>
            </div>
          </div>
        </motion.div>
      )}

      <div className="w-full">
        {/* Header */}
        <motion.div 
          className="text-center mb-4 sm:mb-6"
          variants={itemVariants}
        >
          <div className="inline-flex items-center justify-center w-10 h-10 sm:w-12 sm:h-12 rounded-full bg-gradient-to-r from-blue-500 to-indigo-600 mb-3">
            <Brain className="w-5 h-5 sm:w-6 sm:h-6 text-white" />
          </div>
          <h1 className="text-xl sm:text-2xl md:text-3xl font-bold text-foreground mb-2 bg-gradient-to-r from-foreground to-muted-foreground bg-clip-text">
            {getStepTitle()}
          </h1>
          <p className="text-sm sm:text-base text-muted-foreground px-4">
            Configure your AI-powered SQL conversion experience
          </p>
        </motion.div>

        {/* Progress Indicator */}
        <motion.div 
          className="flex items-center justify-center mb-4 sm:mb-6 overflow-x-auto"
          variants={itemVariants}
        >
          <div className="flex items-center space-x-1 sm:space-x-2 min-w-max px-4">
            {(() => {
              const steps = selectedOption === 'groq' 
                ? ['welcome', 'choose-option', 'groq-setup', 'confirm']
                : selectedOption === 'local'
                ? ['welcome', 'choose-option', 'local-setup', 'confirm']
                : ['welcome', 'choose-option', 'confirm']
              
              return steps.map((step, index) => {
                const stepNumber = index + 1
                const isActive = step === currentStep
                const stepOrder = steps.indexOf(currentStep)
                const thisStepOrder = steps.indexOf(step)
                const isCompleted = stepOrder > thisStepOrder
                
                let stepLabel = ''
                switch (step) {
                  case 'welcome': stepLabel = 'Welcome'; break
                  case 'choose-option': stepLabel = 'Choose'; break
                  case 'groq-setup': stepLabel = 'Groq API'; break
                  case 'local-setup': stepLabel = 'Local LLM'; break
                  case 'confirm': stepLabel = 'Confirm'; break
                }
                
                return (
                  <React.Fragment key={step}>
                    <div className="flex flex-col items-center">
                      <motion.div
                        className={`flex items-center justify-center w-6 h-6 sm:w-8 sm:h-8 rounded-full font-medium text-xs sm:text-sm transition-all duration-300 ${
                          isCompleted 
                            ? 'bg-green-500 text-white' 
                            : isActive 
                              ? 'bg-blue-500 text-white shadow-lg shadow-blue-500/30' 
                              : 'bg-muted text-muted-foreground'
                        }`}
                        variants={stepIndicatorVariants}
                        animate={isActive ? "active" : "visible"}
                      >
                        {isCompleted ? <CheckCircle className="w-3 h-3 sm:w-4 sm:h-4" /> : stepNumber}
                      </motion.div>
                      <div className={`text-xs mt-1 transition-colors hidden sm:block ${
                        isActive ? 'text-blue-600 font-medium' : 'text-muted-foreground'
                      }`}>
                        {stepLabel}
                      </div>
                    </div>
                    {index < steps.length - 1 && (
                      <div className={`w-8 h-1 rounded-full transition-all duration-300 mt-3 ${
                        isCompleted ? 'bg-green-500' : 'bg-muted'
                      }`} />
                    )}
                  </React.Fragment>
                )
              })
            })()}
          </div>
        </motion.div>

        {/* Main Content Card */}
        <AnimatePresence mode="wait">
          <motion.div
            key={currentStep}
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            transition={{ duration: 0.3 }}
          >
            <Card className="backdrop-blur-sm bg-card/80 border-border/50 shadow-xl rounded-2xl">
              <CardContent className="p-6">
                {/* Welcome Step */}
                {currentStep === 'welcome' && (
                  <motion.div variants={containerVariants} initial="hidden" animate="visible">
                    <div className="text-center space-y-6">
                      <motion.div variants={itemVariants}>
                        <div className="w-20 h-20 mx-auto mb-6 rounded-full bg-gradient-to-r from-blue-500 to-indigo-600 flex items-center justify-center">
                          <Brain className="w-10 h-10 text-white" />
                        </div>
                        <h2 className="text-3xl font-bold text-foreground mb-4">
                          Welcome to NaturalToSQL
                        </h2>
                        <p className="text-lg text-muted-foreground mb-6 max-w-2xl mx-auto">
                          Transform your natural language questions into powerful SQL queries with AI assistance.
                        </p>
                      </motion.div>

                      <motion.div variants={itemVariants} className="grid md:grid-cols-3 gap-6 max-w-4xl mx-auto">
                        <div className="text-center p-4">
                          <div className="w-12 h-12 mx-auto mb-3 rounded-full bg-blue-100 dark:bg-blue-500/20 flex items-center justify-center">
                            <Zap className="w-6 h-6 text-blue-600 dark:text-blue-400" />
                          </div>
                          <h3 className="font-semibold text-foreground mb-2">Instant Conversion</h3>
                          <p className="text-sm text-muted-foreground">
                            Convert natural language to SQL in seconds
                          </p>
                        </div>
                        <div className="text-center p-4">
                          <div className="w-12 h-12 mx-auto mb-3 rounded-full bg-green-100 dark:bg-green-500/20 flex items-center justify-center">
                            <Shield className="w-6 h-6 text-green-600 dark:text-green-400" />
                          </div>
                          <h3 className="font-semibold text-foreground mb-2">Safe & Secure</h3>
                          <p className="text-sm text-muted-foreground">
                            Built-in safety checks and validation
                          </p>
                        </div>
                        <div className="text-center p-4">
                          <div className="w-12 h-12 mx-auto mb-3 rounded-full bg-purple-100 dark:bg-purple-500/20 flex items-center justify-center">
                            <Sparkles className="w-6 h-6 text-purple-600 dark:text-purple-400" />
                          </div>
                          <h3 className="font-semibold text-foreground mb-2">Smart Learning</h3>
                          <p className="text-sm text-muted-foreground">
                            Learns from your database schema
                          </p>
                        </div>
                      </motion.div>

                      <motion.div variants={itemVariants}>
                        <p className="text-muted-foreground">
                          To get started, we need to configure your AI conversion preferences.
                        </p>
                      </motion.div>
                    </div>
                  </motion.div>
                )}

                {/* Choose Option Step */}
                {currentStep === 'choose-option' && (
                  <motion.div variants={containerVariants} initial="hidden" animate="visible">
                    <div className="text-center mb-8">
                      <motion.div variants={itemVariants}>
                        <Brain className="w-12 h-12 mx-auto mb-4 text-blue-500" />
                        <h2 className="text-2xl font-bold text-foreground mb-3">Choose Your AI Setup</h2>
                        <p className="text-muted-foreground">Select how you'd like to power your natural language to SQL conversion</p>
                      </motion.div>
                    </div>

                    <motion.div 
                      className="grid gap-6 md:grid-cols-3"
                      variants={containerVariants}
                    >
                      {/* Groq Cloud AI Option */}
                      <motion.div variants={itemVariants}>
                        <Card 
                          className={`cursor-pointer group hover:shadow-lg transition-all duration-300 hover:scale-[1.02] h-full ${
                            selectedOption === 'groq' 
                              ? 'ring-2 ring-blue-500 bg-blue-50/50 dark:bg-blue-500/10 border-blue-500' 
                              : 'border-border/50 hover:border-blue-500/50'
                          }`}
                          onClick={() => handleOptionSelect('groq')}
                        >
                          <CardContent className="p-6 text-center h-full flex flex-col">
                            <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-gradient-to-r from-blue-500 to-indigo-600 flex items-center justify-center group-hover:scale-110 transition-transform">
                              <Cloud className="w-8 h-8 text-white" />
                            </div>
                            <h3 className="text-xl font-semibold text-foreground mb-2 group-hover:text-blue-600 transition-colors">
                              Groq Cloud AI
                            </h3>
                            <p className="text-sm text-muted-foreground mb-4 flex-1">
                              Use Groq's high-performance cloud AI for lightning-fast SQL generation with excellent accuracy.
                            </p>
                            <div className="space-y-2 text-xs">
                              <div className="flex items-center justify-center text-green-600">
                                <CheckCircle className="w-3 h-3 mr-1" />
                                Lightning fast responses
                              </div>
                              <div className="flex items-center justify-center text-green-600">
                                <CheckCircle className="w-3 h-3 mr-1" />
                                High accuracy
                              </div>
                              <div className="flex items-center justify-center text-blue-600">
                                <Key className="w-3 h-3 mr-1" />
                                Requires API key
                              </div>
                            </div>
                            <div className="mt-4 flex items-center justify-center text-xs text-blue-600">
                              <Sparkles className="w-3 h-3 mr-1" />
                              Recommended
                            </div>
                          </CardContent>
                        </Card>
                      </motion.div>

                      {/* Local LLM Option */}
                      <motion.div variants={itemVariants}>
                        <Card 
                          className={`cursor-pointer group hover:shadow-lg transition-all duration-300 hover:scale-[1.02] h-full ${
                            selectedOption === 'local' 
                              ? 'ring-2 ring-purple-500 bg-purple-50/50 dark:bg-purple-500/10 border-purple-500' 
                              : 'border-border/50 hover:border-purple-500/50'
                          }`}
                          onClick={() => handleOptionSelect('local')}
                        >
                          <CardContent className="p-6 text-center h-full flex flex-col">
                            <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-gradient-to-r from-purple-500 to-pink-500 flex items-center justify-center group-hover:scale-110 transition-transform">
                              <Cpu className="w-8 h-8 text-white" />
                            </div>
                            <h3 className="text-xl font-semibold text-foreground mb-2 group-hover:text-purple-600 transition-colors">
                              Local LLM
                            </h3>
                            <p className="text-sm text-muted-foreground mb-4 flex-1">
                              Run AI models locally on your machine for complete privacy and offline capability.
                            </p>
                            <div className="space-y-2 text-xs">
                              <div className="flex items-center justify-center text-green-600">
                                <CheckCircle className="w-3 h-3 mr-1" />
                                Complete privacy
                              </div>
                              <div className="flex items-center justify-center text-green-600">
                                <CheckCircle className="w-3 h-3 mr-1" />
                                Works offline
                              </div>
                              <div className="flex items-center justify-center text-orange-600">
                                <AlertCircle className="w-3 h-3 mr-1" />
                                Requires setup
                              </div>
                            </div>
                            <div className="mt-4 flex items-center justify-center text-xs text-green-600">
                              <CheckCircle className="w-3 h-3 mr-1" />
                              Ready to Use
                            </div>
                          </CardContent>
                        </Card>
                      </motion.div>

                      {/* Basic Mode Option */}
                      <motion.div variants={itemVariants}>
                        <Card 
                          className={`cursor-pointer group hover:shadow-lg transition-all duration-300 hover:scale-[1.02] h-full ${
                            selectedOption === 'basic' 
                              ? 'ring-2 ring-gray-500 bg-gray-50/50 dark:bg-gray-500/10 border-gray-500' 
                              : 'border-border/50 hover:border-gray-500/50'
                          }`}
                          onClick={() => handleOptionSelect('basic')}
                        >
                          <CardContent className="p-6 text-center h-full flex flex-col">
                            <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-gradient-to-r from-gray-500 to-gray-600 flex items-center justify-center group-hover:scale-110 transition-transform">
                              <Server className="w-8 h-8 text-white" />
                            </div>
                            <h3 className="text-xl font-semibold text-foreground mb-2 group-hover:text-gray-600 transition-colors">
                              Basic Mode
                            </h3>
                            <p className="text-sm text-muted-foreground mb-4 flex-1">
                              Use the app without AI conversion. Perfect for direct SQL querying and database exploration.
                            </p>
                            <div className="space-y-2 text-xs">
                              <div className="flex items-center justify-center text-green-600">
                                <CheckCircle className="w-3 h-3 mr-1" />
                                No setup required
                              </div>
                              <div className="flex items-center justify-center text-green-600">
                                <CheckCircle className="w-3 h-3 mr-1" />
                                Database browsing
                              </div>
                              <div className="flex items-center justify-center text-orange-600">
                                <AlertCircle className="w-3 h-3 mr-1" />
                                No AI conversion
                              </div>
                            </div>
                            <div className="mt-4 flex items-center justify-center text-xs text-gray-600">
                              <Shield className="w-3 h-3 mr-1" />
                              Simple & Clean
                            </div>
                          </CardContent>
                        </Card>
                      </motion.div>
                    </motion.div>
                  </motion.div>
                )}

                {/* Groq Setup Step */}
                {currentStep === 'groq-setup' && (
                  <motion.div variants={containerVariants} initial="hidden" animate="visible">
                    <div className="text-center mb-6">
                      <motion.div variants={itemVariants}>
                        <Cloud className="w-12 h-12 mx-auto mb-4 text-blue-500" />
                        <h2 className="text-2xl font-bold text-foreground mb-3">Configure Groq API</h2>
                        <p className="text-muted-foreground">Set up your Groq API key for AI-powered SQL conversion</p>
                      </motion.div>
                    </div>

                    <motion.div className="space-y-6 max-w-2xl mx-auto" variants={containerVariants}>
                      {/* Step 1: Get API Key */}
                      <motion.div variants={itemVariants}>
                        <div className="p-6 bg-blue-50/50 dark:bg-blue-500/5 border border-blue-200/50 dark:border-blue-500/20 rounded-lg">
                          <div className="flex items-start space-x-4">
                            <div className="w-8 h-8 rounded-full bg-blue-500 text-white flex items-center justify-center font-semibold text-sm">
                              1
                            </div>
                            <div className="flex-1">
                              <h3 className="font-semibold text-foreground mb-2">Get Your Groq API Key</h3>
                              <p className="text-sm text-muted-foreground mb-4">
                                Visit the Groq console to create a free API key. It only takes a minute!
                              </p>
                              <Button
                                onClick={openGroqApiKeyPage}
                                className="flex items-center space-x-2 bg-blue-500 hover:bg-blue-600"
                              >
                                <ExternalLink className="w-4 h-4" />
                                <span>Open Groq Console</span>
                              </Button>
                            </div>
                          </div>
                        </div>
                      </motion.div>

                      {/* Step 2: Enter API Key */}
                      <motion.div variants={itemVariants}>
                        <div className="p-6 bg-green-50/50 dark:bg-green-500/5 border border-green-200/50 dark:border-green-500/20 rounded-lg">
                          <div className="flex items-start space-x-4">
                            <div className="w-8 h-8 rounded-full bg-green-500 text-white flex items-center justify-center font-semibold text-sm">
                              2
                            </div>
                            <div className="flex-1 space-y-4">
                              <div>
                                <h3 className="font-semibold text-foreground mb-2">Enter Your API Key</h3>
                                <p className="text-sm text-muted-foreground mb-4">
                                  Paste your Groq API key here. It will be stored securely on your local machine.
                                </p>
                              </div>
                              
                              <div className="relative">
                                <Input
                                  type={showApiKey ? "text" : "password"}
                                  value={groqApiKey}
                                  onChange={(e) => setGroqApiKey(e.target.value)}
                                  placeholder="gsk_..."
                                  className={`pr-20 font-mono text-sm ${
                                    apiKeyValid === true 
                                      ? 'border-green-500 focus:ring-green-500' 
                                      : apiKeyValid === false 
                                        ? 'border-red-500 focus:ring-red-500' 
                                        : ''
                                  }`}
                                />
                                <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center space-x-1">
                                  <Button
                                    type="button"
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => setShowApiKey(!showApiKey)}
                                    className="h-8 w-8 p-0"
                                  >
                                    {showApiKey ? (
                                      <EyeOff className="w-4 h-4" />
                                    ) : (
                                      <Eye className="w-4 h-4" />
                                    )}
                                  </Button>
                                  {groqApiKey.trim() && (
                                    <Button
                                      type="button"
                                      variant="ghost"
                                      size="sm"
                                      onClick={testGroqApiKey}
                                      disabled={isTestingApiKey}
                                      className="h-8 px-2 text-xs"
                                    >
                                      {isTestingApiKey ? (
                                        <Loader2 className="w-3 h-3 animate-spin" />
                                      ) : (
                                        'Test'
                                      )}
                                    </Button>
                                  )}
                                </div>
                              </div>

                              {/* API Key Status */}
                              {apiKeyValid === true && (
                                <div className="flex items-center space-x-2 text-green-600">
                                  <CheckCircle className="w-4 h-4" />
                                  <span className="text-sm font-medium">API key is valid and working!</span>
                                </div>
                              )}
                              {apiKeyValid === false && (
                                <div className="flex items-center space-x-2 text-red-600">
                                  <AlertCircle className="w-4 h-4" />
                                  <span className="text-sm font-medium">Invalid API key. Please check and try again.</span>
                                </div>
                              )}

                              <div className="text-xs text-muted-foreground space-y-1">
                                <div className="flex items-center space-x-1">
                                  <Info className="w-3 h-3" />
                                  <span>Your API key is stored locally and never shared</span>
                                </div>
                                <div className="flex items-center space-x-1">
                                  <Shield className="w-3 h-3" />
                                  <span>All communications are encrypted</span>
                                </div>
                              </div>
                            </div>
                          </div>
                        </div>
                      </motion.div>
                    </motion.div>
                  </motion.div>
                )}

                {/* Local Setup Step */}
                {currentStep === 'local-setup' && (
                  <motion.div variants={containerVariants} initial="hidden" animate="visible">
                    <div className="text-center mb-6">
                      <motion.div variants={itemVariants}>
                        <Cpu className="w-12 h-12 mx-auto mb-4 text-purple-500" />
                        <h2 className="text-2xl font-bold text-foreground mb-3">Local LLM Setup</h2>
                        <p className="text-muted-foreground">Configure local AI models for complete privacy</p>
                      </motion.div>
                    </div>

                    <motion.div className="space-y-6 max-w-2xl mx-auto" variants={containerVariants}>
                      <motion.div variants={itemVariants}>
                        <div className="p-8 bg-green-50/50 dark:bg-green-500/5 border border-green-200/50 dark:border-green-500/20 rounded-lg text-center">
                          <Cpu className="w-16 h-16 mx-auto mb-4 text-green-500" />
                          <h3 className="text-xl font-semibold text-foreground mb-3">Local LLM Ready</h3>
                          <p className="text-muted-foreground mb-6">
                            Run AI models directly on your machine for complete privacy and offline operation.
                            Local LLM mode is now fully supported and production-ready.
                          </p>
                          
                          <div className="space-y-3 text-sm text-left max-w-md mx-auto">
                            <h4 className="font-medium text-foreground">Features Available:</h4>
                            <div className="space-y-2">
                              <div className="flex items-center space-x-2">
                                <CheckCircle className="w-4 h-4 text-green-500" />
                                <span>Ollama integration for easy model management</span>
                              </div>
                              <div className="flex items-center space-x-2">
                                <CheckCircle className="w-4 h-4 text-green-500" />
                                <span>Support for Qwen, Llama, Mistral, and other models</span>
                              </div>
                              <div className="flex items-center space-x-2">
                                <CheckCircle className="w-4 h-4 text-green-500" />
                                <span>Automatic model downloading and setup</span>
                              </div>
                              <div className="flex items-center space-x-2">
                                <CheckCircle className="w-4 h-4 text-green-500" />
                                <span>GPU acceleration support</span>
                              </div>
                              <div className="flex items-center space-x-2">
                                <CheckCircle className="w-4 h-4 text-green-500" />
                                <span>Complete offline operation</span>
                              </div>
                              <div className="flex items-center space-x-2">
                                <CheckCircle className="w-4 h-4 text-green-500" />
                                <span>Comprehensive health monitoring</span>
                              </div>
                            </div>
                          </div>

                          <div className="mt-6 p-4 bg-blue-50/50 dark:bg-blue-500/5 border border-blue-200/50 dark:border-blue-500/20 rounded-lg">
                            <p className="text-sm text-blue-700 dark:text-blue-300">
                              The app will guide you through the Ollama installation and model setup process. 
                              Local LLM mode provides enterprise-grade privacy and performance.
                            </p>
                          </div>
                        </div>
                      </motion.div>
                    </motion.div>
                  </motion.div>
                )}

                {/* Confirm Step */}
                {currentStep === 'confirm' && (
                  <motion.div variants={containerVariants} initial="hidden" animate="visible">
                    <div className="text-center mb-6">
                      <motion.div variants={itemVariants}>
                        <CheckCircle className="w-12 h-12 mx-auto mb-4 text-green-500" />
                        <h2 className="text-2xl font-bold text-foreground mb-3">Setup Complete!</h2>
                        <p className="text-muted-foreground">Your NaturalToSQL configuration is ready</p>
                      </motion.div>
                    </div>

                    <motion.div className="space-y-6 max-w-2xl mx-auto" variants={containerVariants}>
                      <motion.div variants={itemVariants}>
                        <div className="p-6 bg-green-50/50 dark:bg-green-500/5 border border-green-200/50 dark:border-green-500/20 rounded-lg">
                          <h3 className="font-semibold text-foreground mb-4">Configuration Summary:</h3>
                          <div className="space-y-3">
                            {selectedOption === 'groq' && (
                              <>
                                <div className="flex items-center space-x-3">
                                  <Cloud className="w-5 h-5 text-blue-500" />
                                  <span className="text-foreground">AI Provider: Groq Cloud AI</span>
                                </div>
                                <div className="flex items-center space-x-3">
                                  <CheckCircle className="w-5 h-5 text-green-500" />
                                  <span className="text-foreground">API Key: Configured and validated</span>
                                </div>
                                <div className="flex items-center space-x-3">
                                  <Zap className="w-5 h-5 text-yellow-500" />
                                  <span className="text-foreground">Lightning-fast SQL conversion enabled</span>
                                </div>
                              </>
                            )}
                            {selectedOption === 'local' && (
                              <>
                                <div className="flex items-center space-x-3">
                                  <Cpu className="w-5 h-5 text-purple-500" />
                                  <span className="text-foreground">AI Provider: Local LLM</span>
                                </div>
                                <div className="flex items-center space-x-3">
                                  <Shield className="w-5 h-5 text-green-500" />
                                  <span className="text-foreground">Privacy: Maximum (local processing)</span>
                                </div>
                                <div className="flex items-center space-x-3">
                                  <Globe className="w-5 h-5 text-blue-500" />
                                  <span className="text-foreground">Internet: Not required for AI features</span>
                                </div>
                              </>
                            )}
                            {selectedOption === 'basic' && (
                              <>
                                <div className="flex items-center space-x-3">
                                  <Server className="w-5 h-5 text-gray-500" />
                                  <span className="text-foreground">Mode: Basic database operations</span>
                                </div>
                                <div className="flex items-center space-x-3">
                                  <CheckCircle className="w-5 h-5 text-green-500" />
                                  <span className="text-foreground">Database browsing and direct SQL</span>
                                </div>
                                <div className="flex items-center space-x-3">
                                  <Shield className="w-5 h-5 text-green-500" />
                                  <span className="text-foreground">No external dependencies</span>
                                </div>
                              </>
                            )}
                          </div>
                        </div>
                      </motion.div>

                      <motion.div variants={itemVariants}>
                        <div className="p-4 bg-blue-50/50 dark:bg-blue-500/5 border border-blue-200/50 dark:border-blue-500/20 rounded-lg">
                          <h4 className="font-medium text-foreground mb-2">What's Next?</h4>
                          <p className="text-sm text-muted-foreground">
                            {selectedOption === 'groq' 
                              ? "You can now create database connections and start converting natural language to SQL with AI assistance."
                              : selectedOption === 'local'
                              ? "You can now create database connections and start using local AI for secure, on-device natural language to SQL conversion."
                              : "You can create database connections and use direct SQL querying to explore your databases."
                            }
                          </p>
                        </div>
                      </motion.div>
                    </motion.div>
                  </motion.div>
                )}
              </CardContent>

              {/* Footer with Navigation */}
              <div className="border-t border-border/50 bg-muted/20 p-4">
                <div className="flex flex-col sm:flex-row justify-between items-center gap-3 sm:gap-4">
                  <Button 
                    variant="outline" 
                    onClick={handleBack}
                    disabled={currentStep === 'welcome'}
                    className="w-full sm:w-auto flex items-center justify-center space-x-2 hover:scale-105 transition-transform"
                  >
                    <ArrowLeft className="w-4 h-4" />
                    <span>Back</span>
                  </Button>
                  
                  <Button 
                    onClick={handleNext} 
                    disabled={!canProceed() || isLoading}
                    className="w-full sm:w-auto flex items-center justify-center space-x-2 bg-gradient-to-r from-blue-500 to-indigo-600 hover:from-blue-600 hover:to-indigo-700 hover:scale-105 transition-all shadow-lg"
                  >
                    {isLoading && (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    )}
                    <span>{isLoading && currentStep === 'confirm' ? 'Initializing system...' : getNextButtonText()}</span>
                    {!isLoading && (
                      <ArrowRight className="w-4 h-4" />
                    )}
                  </Button>
                </div>
              </div>
            </Card>
          </motion.div>
        </AnimatePresence>
      </div>
    </motion.div>
  )
}

export default InitialSetup
