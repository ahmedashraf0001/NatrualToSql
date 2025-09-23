import React, { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { DatabaseProvider, DatabaseServer, DatabaseInfo, ConnectionProfile, NotificationMessage } from '@/types'
import { ConnectionType, ProviderType } from '@/types/user'
import apiService from '@/services/api'
import { userService } from '@/services/user'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent } from '@/components/ui/card'
import LoadingScreen from './LoadingScreen'
import { 
  Database, 
  Server, 
  Cable, 
  CheckCircle, 
  ArrowLeft, 
  ArrowRight,
  Sparkles,
  Zap,
  Shield,
  ChevronRight,
  AlertCircle,
  Search,
  Terminal,
  Tag,
  Eye,
  EyeOff,
  Loader2
} from 'lucide-react'

interface SetupWizardProps {
  onProfileCreated: (profile: ConnectionProfile) => void
  onNotification: (notification: Omit<NotificationMessage, 'id'>) => void
  existingProfiles: ConnectionProfile[]
  onBackToProfiles?: () => void
}

type SetupStep = 'provider' | 'connection-method' | 'auto-config' | 'database-selection' | 'manual-config'

const SetupWizard: React.FC<SetupWizardProps> = ({ 
  onProfileCreated, 
  onNotification, 
  existingProfiles,
  onBackToProfiles 
}) => {
  /* eslint-disable @typescript-eslint/no-unused-vars */
  console.log('🏗️ SetupWizard initialized with existingProfiles:', existingProfiles)
  console.log('🏗️ Profile details:', existingProfiles.map(p => ({
    id: p.id,
    name: p.name,
    databaseName: p.databaseName,
    serverName: p.serverName,
    provider: p.provider,
    providerType: p.providerType,
    hasConnectionString: !!p.connectionString,
    connectionStringPreview: p.connectionString ? p.connectionString.substring(0, 50) + '...' : 'none'
  })))
  
  // Helper function to determine if a database is a system/meta database
  const isMetaDatabase = (databaseName: string): boolean => {
    const metaDatabases = [
      'master', 'model', 'msdb', 'tempdb', // SQL Server system databases
      'information_schema', 'performance_schema', 'mysql', 'sys', // MySQL system databases
      'postgres', 'template0', 'template1', // PostgreSQL system databases
      'sqlite_master', 'sqlite_temp_master', // SQLite system databases
      'INFORMATION_SCHEMA', 'PERFORMANCE_SCHEMA' // Case variations
    ]
    return metaDatabases.includes(databaseName.toLowerCase()) || 
           metaDatabases.includes(databaseName) ||
           databaseName.startsWith('sys') ||
           databaseName.startsWith('SYS') ||
           databaseName.includes('system') ||
           databaseName.includes('SYSTEM')
  }
  
  // Filter databases based on meta database toggle
  const getFilteredDatabases = (): DatabaseInfo[] => {
    if (showMetaDatabases) {
      return discoveredDatabases
    }
    return discoveredDatabases.filter(db => !isMetaDatabase(db.name))
  }
  
  // Helper function to extract error message from API errors
  const getErrorMessage = (error: any): string => {
    if (error && error.errors && Array.isArray(error.errors)) {
      return error.errors.join('; ')
    }
    if (error && error.message) {
      return error.message
    }
    if (typeof error === 'string') {
      return error
    }
    return 'An unknown error occurred'
  }
  
  const [currentStep, setCurrentStep] = useState<SetupStep>('provider')
  const [providers, setProviders] = useState<DatabaseProvider[]>([])
  const [selectedProvider, setSelectedProvider] = useState<DatabaseProvider | null>(null)
  const [connectionMethod, setConnectionMethod] = useState<'auto' | 'manual' | null>(null)
  
  // Auto-detect configuration
  const [selectedServer, setSelectedServer] = useState<DatabaseServer | null>(null)
  const [selectedDatabase, setSelectedDatabase] = useState<string>('')
  const [discoveredServers, setDiscoveredServers] = useState<DatabaseServer[]>([])
  const [discoveredDatabases, setDiscoveredDatabases] = useState<DatabaseInfo[]>([])
  const [isLoadingServers] = useState(false)
  const [isLoadingDatabases] = useState(false)
  const [profileName, setProfileName] = useState('')
  const [showMetaDatabases, setShowMetaDatabases] = useState(false)
  
  // Manual configuration
  const [connectionString, setConnectionString] = useState('')
  
  const [isLoading, setIsLoading] = useState(false)

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

  // Load providers on mount
  useEffect(() => {
    let mounted = true
    let requestCompleted = false
    
    const loadProviders = async () => {
      try {
        setIsLoading(true)
        const providersData = await apiService.getSupportedProviders()
        
        // Only update state if component is still mounted and request completed successfully
        if (mounted && !requestCompleted) {
          requestCompleted = true
          setProviders(providersData)
          console.log('Providers loaded successfully:', providersData)
        }
      } catch (error) {
        // Only show error notification if component is still mounted and this is a genuine error
        if (mounted && !requestCompleted) {
          requestCompleted = true
          console.error('Failed to load providers:', error)
          onNotification({
            type: 'error',
            title: 'Failed to Load Providers',
            message: getErrorMessage(error),
            duration: 5000
          })
        }
      } finally {
        if (mounted) {
          setIsLoading(false)
        }
      }
    }

    loadProviders()
    
    // Cleanup function to mark component as unmounted
    return () => {
      mounted = false
    }
  }, []) // Remove onNotification dependency to prevent re-execution

  // Load servers when provider is selected for auto-detect
  useEffect(() => {
    if (selectedProvider && connectionMethod === 'auto') {
      const loadServers = async () => {
        try {
          setIsLoading(true)
          console.log('Selected Provider:', selectedProvider)
          const serversData = await apiService.getAvailableServers(selectedProvider.dbType)
          setDiscoveredServers(serversData)
        } catch (error) {
          onNotification({
            type: 'error',
            title: 'Failed to Load Servers',
            message: getErrorMessage(error),
            duration: 5000
          })
        } finally {
          setIsLoading(false)
        }
      }

      loadServers()
    }
  }, [selectedProvider, connectionMethod, onNotification])

  // Load databases when server is selected
  useEffect(() => {
    if (selectedProvider && selectedServer) {
      const loadDatabases = async () => {
        try {
          setIsLoading(true)
          const databasesData = await apiService.getAvailableDatabases(
            selectedProvider.dbType,
            selectedServer.name
          )
          setDiscoveredDatabases(databasesData)
        } catch (error) {
          onNotification({
            type: 'error',
            title: 'Failed to Load Databases',
            message: getErrorMessage(error),
            duration: 5000
          })
        } finally {
          setIsLoading(false)
        }
      }

      loadDatabases()
    }
  }, [selectedProvider, selectedServer, onNotification])

  // Reset connection test state when connection string changes
  useEffect(() => {
    // Connection validation will be handled by backend
  }, [connectionString])

  const handleProviderSelect = (provider: DatabaseProvider) => {
    // No longer blocking provider selection since we support multiple profiles per provider
    // The database-specific check will happen later in the flow
    setSelectedProvider(provider)
    setCurrentStep('connection-method')
  }

  const handleConnectionMethodSelect = (method: 'auto' | 'manual') => {
    setConnectionMethod(method)
    setCurrentStep(method === 'auto' ? 'auto-config' : 'manual-config')
    
    // The useEffect will handle loading servers when method is 'auto'
  }

  const handleServerSelect = (server: DatabaseServer) => {
    setSelectedServer(server)
    // Move to database selection step
    setCurrentStep('database-selection')
  }

  const handleDatabaseSelect = (database: DatabaseInfo) => {
    // Check if this database already has a profile configured
    if (!selectedProvider || !selectedServer) return
    
    console.log('🔎 User selected database:', {
      databaseName: database.name,
      serverName: selectedServer.name,
      providerType: selectedProvider.dbType,
      availableProfiles: existingProfiles.length
    })
    
    const existingProfile = findExistingProfileForDatabase(database.name, selectedServer.name, selectedProvider.dbType)
    
    console.log('🔎 Search result:', existingProfile ? 'FOUND EXISTING PROFILE' : 'NO EXISTING PROFILE')
    
    // Prevent selection of databases that already have profiles
    if (existingProfile) {
      console.log('🚫 Blocking database selection - profile already exists:', existingProfile.name)
      onNotification({
        type: 'info',
        title: 'Database Already Connected',
        message: `The "${database.name}" database is already connected via the "${existingProfile.name}" profile. Please select a different database or use the existing profile.`,
        duration: 4000
      })
      return
    }
    
    console.log('✅ Database selection allowed - proceeding')
    setSelectedDatabase(database.name)
    setProfileName(`${selectedProvider?.name} - ${database.name}`)
  }

  // Helper function to find existing profile for a database with simplified matching
  // Since backend ProfileDto doesn't store serverName separately, we'll focus on database name matching
  const findExistingProfileForDatabase = (databaseName: string, serverName: string, providerType: string): ConnectionProfile | undefined => {
    console.log('🔍 PROFILE SEARCH DEBUG:')
    console.log('🔍 Looking for:', { databaseName, serverName, providerType })
    console.log('🔍 Total profiles available:', existingProfiles.length)
    console.log('🔍 All profiles:', existingProfiles.map((p, index) => ({
      index,
      id: p.id,
      name: p.name,
      databaseName: p.databaseName,
      serverName: p.serverName || 'undefined',
      provider: p.provider,
      providerType: p.providerType || 'undefined',
      hasConnectionString: !!p.connectionString,
      connectionStringLength: p.connectionString?.length || 0
    })))
    
    // Primary matching strategy: find by database name (case-insensitive) and provider type
    const matchedProfile = existingProfiles.find(profile => {
      console.log(`🔍 Checking profile #${existingProfiles.indexOf(profile)}:`, {
        profileName: profile.name,
        profileDatabaseName: profile.databaseName,
        profileProvider: profile.provider,
        targetDatabaseName: databaseName,
        targetProviderType: providerType
      })
      
      // Database name matching (case-insensitive)
      const dbNameMatch = profile.databaseName && 
                         profile.databaseName.toLowerCase() === databaseName.toLowerCase()
      
      console.log('🔍 Database name match result:', {
        profileDbName: profile.databaseName,
        targetDbName: databaseName,
        match: dbNameMatch
      })
      
      if (dbNameMatch) {
        console.log('✅ Database name matches!')
        
        // Provider type matching with fallbacks
        const profileProvider = profile.provider || profile.providerType || 'SqlServer'
        const targetProvider = providerType || 'SqlServer'
        
        console.log('🔍 Provider comparison:', {
          profileProvider,
          targetProvider,
          providersMatch: profileProvider === targetProvider
        })
        
        // Match provider types (handle SqlServer variations)
        if (profileProvider === targetProvider || 
            (profileProvider === 'SqlServer' && targetProvider === 'SqlServer')) {
          console.log('✅ Provider type matches - PROFILE FOUND!')
          return true
        } else {
          console.log('❌ Provider type mismatch')
        }
      } else {
        console.log('❌ Database name mismatch')
      }

      return false
    })
    
    console.log('🔍 SEARCH RESULT:', matchedProfile ? 'FOUND EXISTING PROFILE' : 'NO MATCHING PROFILE')
    if (matchedProfile) {
      console.log('🔍 Matched profile details:', {
        id: matchedProfile.id,
        name: matchedProfile.name,
        databaseName: matchedProfile.databaseName,
        provider: matchedProfile.provider
      })
    }
    
    return matchedProfile
  }

  const handleBack = () => {
    if (currentStep === 'connection-method') {
      setCurrentStep('provider')
    } else if (currentStep === 'auto-config') {
      setCurrentStep('connection-method')
    } else if (currentStep === 'database-selection') {
      setCurrentStep('auto-config')
    } else if (currentStep === 'manual-config') {
      setCurrentStep('connection-method')
    }
  }

  const handleNext = () => {
    if (currentStep === 'provider' && selectedProvider) {
      setCurrentStep('connection-method')
    } else if (currentStep === 'connection-method' && connectionMethod) {
      setCurrentStep(connectionMethod === 'auto' ? 'auto-config' : 'manual-config')
    } else if (currentStep === 'auto-config' && selectedServer) {
      setCurrentStep('database-selection')
    } else if (currentStep === 'database-selection' && selectedDatabase) {
      // Check for duplicate database profiles before creating using robust matching
      if (!selectedProvider || !selectedServer) return
      
      const existingProfile = findExistingProfileForDatabase(selectedDatabase, selectedServer.name, selectedProvider.dbType)
      
      if (existingProfile) {
        onNotification({
          type: 'info',
          title: 'Database Connection Already Exists',
          message: `You already have a connection profile "${existingProfile.name}" configured for the "${selectedDatabase}" database on "${selectedServer.name}". To avoid duplicate connections, please select a different database or use the existing profile from your connections list.`,
          duration: 8000
        })
        return
      }
      
      // Auto flow should create profile directly, not go to manual config
      handleCreateProfile()
    } else if (currentStep === 'manual-config') {
      // Manual config creates profile directly, backend will handle validation
      handleCreateProfile()
    }
  }

  const canProceed = () => {
    switch (currentStep) {
      case 'provider':
        return !!selectedProvider
      case 'connection-method':
        return !!connectionMethod
      case 'auto-config':
        return !!selectedServer
      case 'database-selection': {
        if (!selectedDatabase) return false
        
        // Additional check: ensure the selected database is not already configured using robust matching
        if (!selectedProvider || !selectedServer) return false
        
        const existingProfile = findExistingProfileForDatabase(selectedDatabase, selectedServer.name, selectedProvider.dbType)
        return !existingProfile
      }
      case 'manual-config':
        return !!connectionString.trim()
      default:
        return false
    }
  }

  const getNextButtonText = () => {
    switch (currentStep) {
      case 'provider':
        return 'Continue'
      case 'connection-method':
        return 'Configure'
      case 'auto-config':
        return 'Continue'
      case 'database-selection':
        return 'Create Profile'
      case 'manual-config':
        return 'Create Profile'
      default:
        return 'Next'
    }
  }
  const handleCreateProfile = async () => {
    if (!selectedProvider) return

    try {
      setIsLoading(true)
      
      const profileRequest = connectionMethod === 'auto' 
        ? {
            connectionType: ConnectionType.AutoConnect,
            providerType: ProviderType.SqlServer,
            serverName: selectedServer?.name || '',
            databaseName: selectedDatabase,
            connectionString: ''
          }
        : {
            connectionType: ConnectionType.ConnectionString,
            providerType: ProviderType.SqlServer,
            connectionString,
            serverName: '',
            databaseName: ''
          }

      const profileResponse = await userService.createProfile(profileRequest)
      
      // Convert ProfileCreationResponse to ConnectionProfile format
      const profile: ConnectionProfile = {
        id: profileResponse.profileId,
        name: connectionMethod === 'auto' 
          ? `${selectedDatabase} (${selectedServer?.name})` 
          : `${selectedProvider.name} Connection`,
        connectionString: connectionMethod === 'auto' ? '' : connectionString,
        queries: [],
        createdUtc: new Date().toISOString(),
        provider: ProviderType.SqlServer,
        databaseName: connectionMethod === 'auto' ? selectedDatabase : undefined
      }
      
      onProfileCreated(profile)
    } catch (error) {
      onNotification({
        type: 'error',
        title: 'Profile Creation Failed',
        message: getErrorMessage(error),
        duration: 5000
      })
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <motion.div 
      className="bg-background p-2 sm:p-4 md:p-6"
      initial="hidden"
      animate="visible"
      variants={containerVariants}
    >
      <div className="w-full max-w-6xl mx-auto">
        {/* Header */}
        <motion.div 
          className="text-center mb-4 sm:mb-6"
          variants={itemVariants}
        >
          <div className="inline-flex items-center justify-center w-10 h-10 sm:w-12 sm:h-12 rounded-full bg-gradient-to-r from-blue-500 to-indigo-600 mb-3">
            <Database className="w-5 h-5 sm:w-6 sm:h-6 text-white" />
          </div>
          {existingProfiles.length === 0 ? (
            <>
              <h1 className="text-xl sm:text-2xl md:text-3xl font-bold text-foreground mb-2 bg-gradient-to-r from-foreground to-muted-foreground bg-clip-text">
                Welcome to NaturalToSQL
              </h1>
              <p className="text-sm sm:text-base text-muted-foreground px-4">
                Let's set up your first database connection
              </p>
            </>
          ) : (
            <>
              <h1 className="text-lg sm:text-xl md:text-2xl font-bold text-foreground mb-2">
                Create New Connection
              </h1>
              <p className="text-sm sm:text-base text-muted-foreground px-4">
                Add a new database connection to your workspace
              </p>
            </>
          )}
        </motion.div>

        {/* Progress Indicator */}
        <motion.div 
          className="flex items-center justify-center mb-4 sm:mb-6 overflow-x-auto"
          variants={itemVariants}
        >
          <div className="flex items-center space-x-1 sm:space-x-2 min-w-max px-4">
            {(() => {
              const steps = connectionMethod === 'manual' 
                ? ['provider', 'connection-method', 'manual-config']
                : ['provider', 'connection-method', 'auto-config', 'database-selection']
              
              return steps.map((step, index) => {
                const stepNumber = index + 1
                const isActive = step === currentStep
                const stepOrder = steps.indexOf(currentStep)
                const thisStepOrder = steps.indexOf(step)
                const isCompleted = stepOrder > thisStepOrder
                
                let stepLabel = ''
                switch (step) {
                  case 'provider': stepLabel = 'Provider'; break
                  case 'connection-method': stepLabel = 'Method'; break
                  case 'auto-config': stepLabel = 'Server'; break
                  case 'database-selection': stepLabel = 'Database'; break
                  case 'manual-config': stepLabel = 'Configure'; break
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

        {/* Back to Profiles Button */}
        {existingProfiles.length > 0 && (
          <motion.div 
            className="flex justify-start mb-4"
            variants={itemVariants}
          >
            <Button
              variant="outline"
              onClick={onBackToProfiles || (() => {})}
              className="flex items-center space-x-2 hover:scale-105 transition-transform"
            >
              <ArrowLeft className="w-4 h-4" />
              <span>Back to Profiles ({existingProfiles.length})</span>
            </Button>
          </motion.div>
        )}

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
                {/* Provider Selection */}
                {currentStep === 'provider' && (
                  <motion.div variants={containerVariants} initial="hidden" animate="visible">
                    <div className="text-center mb-6">
                      <motion.div variants={itemVariants}>
                        <Database className="w-12 h-12 mx-auto mb-4 text-blue-500" />
                        <h2 className="text-2xl font-bold text-foreground mb-3">Choose Your Database</h2>
                        <p className="text-muted-foreground">Select the database provider you want to connect to</p>
                      </motion.div>
                    </div>

                    {isLoading ? (
                      <motion.div 
                        className="flex items-center justify-center py-8"
                        variants={itemVariants}
                      >
                        <LoadingScreen 
                          type="connecting"
                          title="Discovering Providers"
                          subtitle="Discovering available database providers..."
                          size="md"
                          animated={true}
                          showProgress={false}
                        />
                      </motion.div>
                    ) : providers.length === 0 ? (
                      <motion.div 
                        className="text-center py-8"
                        variants={itemVariants}
                      >
                        <AlertCircle className="w-12 h-12 mx-auto mb-4 text-muted-foreground" />
                        <p className="text-muted-foreground">No database providers available</p>
                      </motion.div>
                    ) : (
                      <motion.div 
                        className="grid gap-4 md:grid-cols-2"
                        variants={containerVariants}
                      >
                        {providers.map((provider) => {
                          const existingProfilesForProvider = existingProfiles.filter(p => p.providerType === provider.dbType)
                          const profileCount = existingProfilesForProvider.length
                          
                          return (
                            <motion.div key={provider.dbType} variants={itemVariants}>
                              <Card 
                                className="relative overflow-hidden cursor-pointer group hover:shadow-lg transition-all duration-300 hover:scale-[1.02] border-border/50 hover:border-blue-500/50"
                                onClick={() => handleProviderSelect(provider)}
                              >
                                <CardContent className="p-6">
                                  <div className="flex items-start justify-between">
                                    <div className="flex items-center space-x-4">
                                      <div className="w-12 h-12 rounded-full bg-gradient-to-r from-blue-500 to-indigo-600 flex items-center justify-center group-hover:scale-110 transition-transform">
                                        <Database className="w-6 h-6 text-white" />
                                      </div>
                                      <div>
                                        <h3 className="font-semibold text-foreground group-hover:text-blue-600 transition-colors">
                                          {provider.name}
                                        </h3>
                                        <p className="text-sm text-muted-foreground">
                                          {provider.describtion}
                                        </p>
                                      </div>
                                    </div>
                                    <ChevronRight className="w-5 h-5 text-muted-foreground group-hover:text-blue-500 group-hover:translate-x-1 transition-all" />
                                  </div>
                                  
                                  {profileCount > 0 && (
                                    <div className="mt-4 flex items-center space-x-2 text-xs">
                                      <div className="flex items-center space-x-1 px-2 py-1 rounded-full bg-green-500/10 text-green-600">
                                        <CheckCircle className="w-3 h-3" />
                                        <span>{profileCount} profile{profileCount !== 1 ? 's' : ''}</span>
                                      </div>
                                    </div>
                                  )}
                                </CardContent>
                              </Card>
                            </motion.div>
                          )
                        })}
                      </motion.div>
                    )}
                  </motion.div>
                )}

                {/* Connection Method Selection */}
                {currentStep === 'connection-method' && (
                  <motion.div variants={containerVariants} initial="hidden" animate="visible">
                    <div className="text-center mb-4">
                      <motion.div variants={itemVariants}>
                        <Cable className="w-8 h-8 mx-auto mb-2 text-blue-500" />
                        <h2 className="text-lg font-bold text-foreground mb-1">Connection Method</h2>
                        <p className="text-sm text-muted-foreground">How would you like to connect to your {selectedProvider?.name} database?</p>
                      </motion.div>
                    </div>

                    <motion.div 
                      className="grid gap-4 md:grid-cols-2"
                      variants={containerVariants}
                    >
                      <motion.div variants={itemVariants}>
                        <Card 
                          className="cursor-pointer group hover:shadow-lg transition-all duration-300 hover:scale-[1.02] border-border/50 hover:border-blue-500/50 h-full"
                          onClick={() => handleConnectionMethodSelect('auto')}
                        >
                          <CardContent className="p-6 text-center h-full flex flex-col">
                            <div className="w-12 h-12 mx-auto mb-3 rounded-full bg-gradient-to-r from-blue-500 to-indigo-600 flex items-center justify-center group-hover:scale-110 transition-transform">
                              <Zap className="w-6 h-6 text-white" />
                            </div>
                            <h3 className="text-lg font-semibold text-foreground mb-1 group-hover:text-blue-600 transition-colors">
                              Auto-Detect
                            </h3>
                            <p className="text-sm text-muted-foreground flex-1">
                              Automatically discover servers and databases on your network
                            </p>
                            <div className="mt-3 flex items-center justify-center text-xs text-green-600">
                              <Sparkles className="w-3 h-3 mr-1" />
                              Recommended
                            </div>
                          </CardContent>
                        </Card>
                      </motion.div>

                      <motion.div variants={itemVariants}>
                        <Card 
                          className="cursor-pointer group hover:shadow-lg transition-all duration-300 hover:scale-[1.02] border-border/50 hover:border-orange-500/50 h-full"
                          onClick={() => handleConnectionMethodSelect('manual')}
                        >
                          <CardContent className="p-6 text-center h-full flex flex-col">
                            <div className="w-12 h-12 mx-auto mb-3 rounded-full bg-gradient-to-r from-orange-500 to-red-500 flex items-center justify-center group-hover:scale-110 transition-transform">
                              <Cable className="w-6 h-6 text-white" />
                            </div>
                            <h3 className="text-lg font-semibold text-foreground mb-1 group-hover:text-orange-600 transition-colors">
                              Connection String
                            </h3>
                            <p className="text-sm text-muted-foreground flex-1">
                              Enter your database connection string manually
                            </p>
                            <div className="mt-3 flex items-center justify-center text-xs text-orange-600">
                              <Shield className="w-3 h-3 mr-1" />
                              Advanced
                            </div>
                          </CardContent>
                        </Card>
                      </motion.div>
                    </motion.div>
                  </motion.div>
                )}

                {/* Auto Configuration */}
                {currentStep === 'auto-config' && (
                  <motion.div variants={containerVariants} initial="hidden" animate="visible">
                    <div className="text-center mb-4">
                      <motion.div variants={itemVariants}>
                        <Search className="w-8 h-8 mx-auto mb-2 text-blue-500" />
                        <h2 className="text-lg font-bold text-foreground mb-1">Auto-Detection</h2>
                        <p className="text-sm text-muted-foreground">Discovering {selectedProvider?.name} servers and databases</p>
                      </motion.div>
                    </div>

                    {isLoadingServers ? (
                      <motion.div 
                        className="flex items-center justify-center py-8"
                        variants={itemVariants}
                      >
                        <LoadingScreen 
                          type="analyzing"
                          title="Discovering Servers"
                          subtitle={`Scanning network for ${selectedProvider?.name} servers...`}
                          size="md"
                          animated={true}
                          showProgress={false}
                        />
                      </motion.div>
                    ) : (
                      <motion.div className="space-y-8" variants={containerVariants}>
                        {/* Server Selection */}
                        <motion.div variants={itemVariants}>
                          <div className="flex items-center space-x-2 mb-4">
                            <Server className="w-5 h-5 text-blue-500" />
                            <h3 className="text-lg font-semibold text-foreground">Available Servers</h3>
                          </div>
                          
                          {discoveredServers.length === 0 ? (
                            <Card className="border-dashed border-2 border-muted-foreground/30">
                              <CardContent className="text-center py-12">
                                <Server className="w-12 h-12 mx-auto mb-4 text-muted-foreground/50" />
                                <p className="text-muted-foreground mb-2">No servers found on the network</p>
                                <p className="text-sm text-muted-foreground/70">Try manual configuration instead</p>
                                <Button
                                  variant="outline"
                                  onClick={() => handleConnectionMethodSelect('manual')}
                                  className="mt-4"
                                >
                                  Switch to Manual Configuration
                                </Button>
                              </CardContent>
                            </Card>
                          ) : (
                            <div className="grid gap-3">
                              {discoveredServers.map((server) => (
                                <motion.div
                                  key={server.name}
                                  whileHover={{ scale: 1.02 }}
                                  whileTap={{ scale: 0.98 }}
                                >
                                  <Card 
                                    className={`cursor-pointer transition-all duration-200 ${
                                      selectedServer?.name === server.name 
                                        ? 'ring-2 ring-blue-500 bg-blue-50/50 border-blue-500' 
                                        : 'hover:shadow-md hover:border-blue-300'
                                    }`}
                                    onClick={() => handleServerSelect(server)}
                                  >
                                    <CardContent className="p-4">
                                      <div className="flex items-center justify-between">
                                        <div className="flex items-center space-x-3">
                                          <div className={`w-3 h-3 rounded-full ${
                                            selectedServer?.name === server.name 
                                              ? 'bg-blue-500' 
                                              : 'bg-muted-foreground/30'
                                          }`} />
                                          <div>
                                            <div className="font-medium text-foreground">{server.name}</div>
                                            <div className="text-sm text-muted-foreground">{server.runningDbs} databases</div>
                                          </div>
                                        </div>
                                        {selectedServer?.name === server.name && (
                                          <CheckCircle className="w-5 h-5 text-blue-500" />
                                        )}
                                      </div>
                                    </CardContent>
                                  </Card>
                                </motion.div>
                              ))}
                            </div>
                          )}
                        </motion.div>
                      </motion.div>
                    )}
                  </motion.div>
                )}

                {/* Database Selection */}
                {currentStep === 'database-selection' && (
                  <motion.div variants={containerVariants} initial="hidden" animate="visible">
                    <div className="text-center mb-4">
                      <motion.div variants={itemVariants}>
                        <Database className="w-8 h-8 mx-auto mb-2 text-green-500" />
                        <h2 className="text-lg font-bold text-foreground mb-1">Select Database</h2>
                        <p className="text-sm text-muted-foreground">Choose a database from {selectedServer?.name}</p>
                        
                        {/* Helpful info about disabled databases and meta database toggle */}
                        {(existingProfiles.some(p => p.serverName === selectedServer?.name && p.providerType === selectedProvider?.dbType) || 
                          discoveredDatabases.some(db => isMetaDatabase(db.name))) && (
                          <div className="mt-4 space-y-2">
                            {existingProfiles.some(p => p.serverName === selectedServer?.name && p.providerType === selectedProvider?.dbType) && (
                              <div className="p-2 bg-blue-50/50 dark:bg-blue-500/5 border border-blue-200/50 dark:border-blue-500/20 rounded-lg max-w-md mx-auto">
                                <div className="flex items-center justify-center space-x-2 text-xs text-blue-600 dark:text-blue-400">
                                  <AlertCircle className="w-3 h-3" />
                                  <span>Databases with existing connections are disabled to prevent duplicates</span>
                                </div>
                              </div>
                            )}
                            {discoveredDatabases.some(db => isMetaDatabase(db.name)) && (
                              <div className="p-2 bg-orange-50/50 dark:bg-orange-500/5 border border-orange-200/50 dark:border-orange-500/20 rounded-lg max-w-md mx-auto">
                                <div className="flex items-center justify-center space-x-2 text-xs text-orange-600 dark:text-orange-400">
                                  <Eye className="w-3 h-3" />
                                  <span>Use the eye icon to {showMetaDatabases ? 'hide' : 'show'} system databases</span>
                                </div>
                              </div>
                            )}
                          </div>
                        )}
                      </motion.div>
                    </div>

                    <motion.div className="space-y-4" variants={containerVariants}>
                      {/* Profile Name Input - Moved to top */}
                      <motion.div variants={itemVariants}>
                        <div className="flex items-center space-x-2 mb-3">
                          <Tag className="w-4 h-4 text-purple-500" />
                          <label htmlFor="auto-profile-name" className="text-base font-semibold text-foreground">
                            Profile Name
                          </label>
                        </div>
                        <Input
                          id="auto-profile-name"
                          value={profileName}
                          onChange={(e) => setProfileName(e.target.value)}
                          placeholder="Enter a name for this connection profile"
                          className="p-3 focus:border-transparent focus:ring-2 focus:ring-purple-500 transition-all"
                        />
                      </motion.div>

                      <motion.div variants={itemVariants}>
                        <div className="flex items-center justify-between mb-4">
                          <div className="flex items-center space-x-2">
                            <Database className="w-5 h-5 text-green-500" />
                            <h3 className="text-lg font-semibold text-foreground">Available Databases</h3>
                            {/* Eye toggle button for meta databases */}
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => setShowMetaDatabases(!showMetaDatabases)}
                              className="ml-2 h-7 w-7 p-0 hover:bg-muted"
                              title={showMetaDatabases ? "Hide system databases" : "Show system databases"}
                            >
                              {showMetaDatabases ? (
                                <EyeOff className="w-4 h-4 text-muted-foreground" />
                              ) : (
                                <Eye className="w-4 h-4 text-muted-foreground" />
                              )}
                            </Button>
                          </div>
                          {getFilteredDatabases().length > 0 && (
                            <div className="flex items-center space-x-3 text-sm">
                              {(() => {
                                const filteredDatabases = getFilteredDatabases()
                                const configuredCount = filteredDatabases.filter(database => {
                                  return selectedProvider && selectedServer && 
                                    findExistingProfileForDatabase(database.name, selectedServer.name, selectedProvider.dbType)
                                }).length
                                const availableCount = filteredDatabases.length - configuredCount
                                const totalMetaDatabases = discoveredDatabases.filter(db => isMetaDatabase(db.name)).length
                                
                                return (
                                  <>
                                    {availableCount > 0 && (
                                      <div className="flex items-center space-x-1 px-2 py-1 rounded-full bg-green-500/10 text-green-600 border border-green-500/20">
                                        <span className="text-xs font-medium">{availableCount} available</span>
                                      </div>
                                    )}
                                    {configuredCount > 0 && (
                                      <div className="flex items-center space-x-1 px-2 py-1 rounded-full bg-muted text-muted-foreground border">
                                        <CheckCircle className="w-3 h-3" />
                                        <span className="text-xs font-medium">{configuredCount} configured</span>
                                      </div>
                                    )}
                                    {!showMetaDatabases && totalMetaDatabases > 0 && (
                                      <div className="flex items-center space-x-1 px-2 py-1 rounded-full bg-blue-500/10 text-blue-600 border border-blue-500/20">
                                        <EyeOff className="w-3 h-3" />
                                        <span className="text-xs font-medium">{totalMetaDatabases} system hidden</span>
                                      </div>
                                    )}
                                  </>
                                )
                              })()}
                            </div>
                          )}
                        </div>
                        
                        {isLoadingDatabases ? (
                          <Card>
                            <CardContent className="flex items-center justify-center py-8">
                              <LoadingScreen 
                                type="analyzing"
                                title="Loading Databases"
                                subtitle="Fetching database list..."
                                size="sm"
                                animated={true}
                                showProgress={false}
                              />
                            </CardContent>
                          </Card>
                        ) : getFilteredDatabases().length === 0 ? (
                          <Card className="border-dashed border-2 border-muted-foreground/30">
                            <CardContent className="text-center py-8">
                              <Database className="w-8 h-8 mx-auto mb-2 text-muted-foreground/50" />
                              <p className="text-muted-foreground">
                                {discoveredDatabases.length > 0 && !showMetaDatabases 
                                  ? "No user databases found. Click the eye icon to show system databases."
                                  : "No databases found"
                                }
                              </p>
                            </CardContent>
                          </Card>
                        ) : (() => {
                          // Get filtered databases (with/without meta databases)
                          const filteredDatabases = getFilteredDatabases()
                          
                          // Check if all filtered databases are already configured
                          const availableDatabases = filteredDatabases.filter(database => {
                            const hasExistingProfile = selectedProvider && selectedServer && 
                              findExistingProfileForDatabase(database.name, selectedServer.name, selectedProvider.dbType)
                            return !hasExistingProfile
                          })
                          
                          if (availableDatabases.length === 0 && filteredDatabases.length > 0) {
                            return (
                              <Card className="border-dashed border-2 border-amber-200 dark:border-amber-500/30 bg-amber-50/30 dark:bg-amber-500/5">
                                <CardContent className="text-center py-8">
                                  <CheckCircle className="w-12 h-12 mx-auto mb-4 text-amber-500" />
                                  <h3 className="text-lg font-semibold text-amber-700 dark:text-amber-400 mb-2">
                                    All Databases Already Connected
                                  </h3>
                                  <p className="text-amber-600 dark:text-amber-300 text-sm mb-4">
                                    All available databases on this server already have connection profiles configured.
                                  </p>
                                  <div className="space-y-2">
                                    <Button
                                      variant="outline"
                                      onClick={() => setCurrentStep('auto-config')}
                                      className="border-amber-300 text-amber-700 hover:bg-amber-50 dark:border-amber-500/50 dark:text-amber-400 dark:hover:bg-amber-500/10"
                                    >
                                      Choose Different Server
                                    </Button>
                                    <div className="text-xs text-amber-600/70 dark:text-amber-400/70">
                                      or go back to your existing profiles
                                    </div>
                                  </div>
                                </CardContent>
                              </Card>
                            )
                          }
                          
                          return (
                          <div className="grid gap-3">
                            {filteredDatabases.map((database) => {
                              // Check if this database already has a profile configured using robust matching
                              const existingProfile = selectedProvider && selectedServer 
                                ? findExistingProfileForDatabase(database.name, selectedServer.name, selectedProvider.dbType)
                                : undefined
                              
                              console.log(`🎨 Rendering database "${database.name}":`, {
                                hasExistingProfile: !!existingProfile,
                                existingProfileName: existingProfile?.name || 'none',
                                serverName: selectedServer?.name,
                                providerType: selectedProvider?.dbType
                              })
                              
                              const isDisabled = !!existingProfile
                              const isSelected = selectedDatabase === database.name && !isDisabled
                              
                              return (
                                <motion.div
                                  key={database.name}
                                  whileHover={!isDisabled ? { scale: 1.02 } : {}}
                                  whileTap={!isDisabled ? { scale: 0.98 } : {}}
                                >
                                  <Card 
                                    className={`transition-all duration-200 ${
                                      isDisabled
                                        ? 'opacity-60 cursor-not-allowed bg-muted/30 border-muted'
                                        : isSelected
                                          ? 'ring-2 ring-green-500 bg-green-50/50 dark:bg-green-500/10 border-green-500 cursor-pointer'
                                          : 'hover:shadow-md hover:border-green-300 cursor-pointer'
                                    }`}
                                    onClick={() => !isDisabled && handleDatabaseSelect(database)}
                                  >
                                    <CardContent className="p-4">
                                      <div className="flex items-center justify-between">
                                        <div className="flex items-center space-x-3">
                                          <div className={`w-3 h-3 rounded-full ${
                                            isDisabled
                                              ? 'bg-muted-foreground/20'
                                              : isSelected
                                                ? 'bg-green-500' 
                                                : 'bg-muted-foreground/30'
                                          }`} />
                                          <div>
                                            <div className={`font-medium flex items-center space-x-2 ${
                                              isDisabled 
                                                ? 'text-muted-foreground' 
                                                : 'text-foreground'
                                            }`}>
                                              <span>{database.name}</span>
                                              {isMetaDatabase(database.name) && (
                                                <span className="px-1.5 py-0.5 rounded text-xs bg-orange-100 dark:bg-orange-500/20 text-orange-600 dark:text-orange-400 border border-orange-200 dark:border-orange-500/30">
                                                  System
                                                </span>
                                              )}
                                            </div>
                                            <div className={`text-sm ${
                                              isDisabled 
                                                ? 'text-muted-foreground/60' 
                                                : 'text-muted-foreground'
                                            }`}>
                                              {database.tableCount} tables
                                            </div>
                                            {isDisabled && (
                                              <div className="flex items-center space-x-1 mt-1">
                                                <CheckCircle className="w-3 h-3 text-green-500/70" />
                                                <span className="text-xs text-green-600/70 font-medium">
                                                  Already configured
                                                </span>
                                              </div>
                                            )}
                                          </div>
                                        </div>
                                        <div className="flex items-center space-x-2">
                                          {isDisabled && existingProfile && (
                                            <div className="flex items-center space-x-1 px-2 py-1 rounded-full bg-green-500/10 text-green-600 border border-green-500/20">
                                              <CheckCircle className="w-3 h-3" />
                                              <span className="text-xs font-medium">Profile: {existingProfile.name}</span>
                                            </div>
                                          )}
                                          {isSelected && (
                                            <CheckCircle className="w-5 h-5 text-green-500" />
                                          )}
                                        </div>
                                      </div>
                                      {isDisabled && existingProfile && (
                                        <div className="mt-3 p-3 bg-blue-50/50 dark:bg-blue-500/5 border border-blue-200/50 dark:border-blue-500/20 rounded-lg">
                                          <div className="flex items-start space-x-2">
                                            <AlertCircle className="w-4 h-4 text-blue-500 mt-0.5 flex-shrink-0" />
                                            <div className="text-sm">
                                              <p className="text-blue-700 dark:text-blue-300 font-medium mb-1">
                                                Connection Already Exists
                                              </p>
                                              <p className="text-blue-600 dark:text-blue-400 text-xs">
                                                This database is already connected via the "{existingProfile.name}" profile. 
                                                To avoid duplicate connections, please select a different database or use the existing profile.
                                              </p>
                                            </div>
                                          </div>
                                        </div>
                                      )}
                                    </CardContent>
                                  </Card>
                                </motion.div>
                              )
                            })}
                          </div>
                          )
                        })()}
                      </motion.div>
                    </motion.div>
                  </motion.div>
                )}

                {/* Manual Configuration */}
                {currentStep === 'manual-config' && (
                  <motion.div variants={containerVariants} initial="hidden" animate="visible">
                    <div className="text-center mb-6">
                      <motion.div variants={itemVariants}>
                        <Terminal className="w-10 h-10 mx-auto mb-3 text-orange-500" />
                        <h2 className="text-xl font-bold text-foreground mb-2">Manual Configuration</h2>
                        <p className="text-muted-foreground">Enter your {selectedProvider?.name} connection details</p>
                      </motion.div>
                    </div>

                    <motion.div className="space-y-8" variants={containerVariants}>
                      <motion.div variants={itemVariants}>
                        <div className="flex items-center space-x-2 mb-4">
                          <Tag className="w-5 h-5 text-purple-500" />
                          <label htmlFor="manual-profile-name" className="text-lg font-semibold text-foreground">
                            Profile Name
                          </label>
                        </div>
                        <Input
                          id="manual-profile-name"
                          value={profileName}
                          onChange={(e) => setProfileName(e.target.value)}
                          placeholder="Enter a name for this connection profile"
                          className="p-3 focus:border-transparent focus:ring-2 focus:ring-purple-500 transition-all"
                        />
                      </motion.div>

                      <motion.div variants={itemVariants}>
                        <div className="flex items-center space-x-2 mb-3">
                          <Cable className="w-5 h-5 text-orange-500" />
                          <label htmlFor="connection-string" className="text-base font-semibold text-foreground">
                            Connection String
                          </label>
                        </div>
                        <textarea
                          id="connection-string"
                          value={connectionString}
                          onChange={(e) => setConnectionString(e.target.value)}
                          placeholder="Enter your database connection string"
                          className="min-h-[120px] font-mono text-sm w-full p-3 rounded-xl border border-input bg-background focus:border-transparent focus:ring-2 focus:ring-orange-500 focus:outline-none transition-all placeholder:text-muted-foreground"
                        />
                        <div className="mt-3 p-4 bg-muted/50 rounded-xl border">
                          <div className="text-sm font-medium text-foreground mb-2">Example:</div>
                          <code className="text-xs text-muted-foreground break-all">
                            Server=localhost;Database=MyDB;Trusted_Connection=True;
                          </code>
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
                    disabled={currentStep === 'provider'}
                    className="w-full sm:w-auto flex items-center justify-center space-x-2 hover:scale-105 transition-transform"
                  >
                    <ArrowLeft className="w-4 h-4" />
                    <span>Back</span>
                  </Button>
                  
                  <Button 
                    onClick={handleNext} 
                    disabled={!canProceed || isLoading}
                    className="w-full sm:w-auto flex items-center justify-center space-x-2 bg-gradient-to-r from-blue-500 to-indigo-600 hover:from-blue-600 hover:to-indigo-700 hover:scale-105 transition-all shadow-lg"
                  >
                    {isLoading && (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    )}
                    <span>{isLoading && currentStep === 'manual-config' ? 'Testing Connection...' : getNextButtonText()}</span>
                    {!isLoading && currentStep !== 'manual-config' && currentStep !== 'auto-config' && (
                      <ArrowRight className="w-4 h-4" />
                    )}
                    {!isLoading && (currentStep === 'manual-config' || currentStep === 'auto-config') && (
                      <CheckCircle className="w-4 h-4" />
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

export default SetupWizard
