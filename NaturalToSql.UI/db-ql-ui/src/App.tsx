import { useState, useEffect, useRef } from 'react'
import { apiService } from './services/api'
import { userService } from './services/user'
import { healthMonitoringService } from './services/healthMonitoring'
import { downloadManager } from './services/downloadManager'
import { AppState, ConnectionProfile, NotificationMessage } from './types'
import { HealthStatus } from './types/health'
import InitialSetup from './components/InitialSetup.tsx'
import SetupWizard from './components/SetupWizard.tsx'
import MainInterface from './components/MainInterface.tsx'
import ProfileManager from './components/ProfileManager.tsx'
import HealthManager from './components/HealthManager.tsx'
import NotificationContainer from './components/NotificationContainer.tsx'
import LoadingScreen from './components/LoadingScreen.tsx'
import { GlobalDownloadProgress, DownloadInfo } from './components/GlobalDownloadProgress'
import { Dialog } from './components/ui/dialog'
import { ToastProvider } from './components/ui/toast'
import { NotificationProvider } from './contexts/NotificationContext'

type AppMode = 'loading' | 'initial-setup' | 'main'
type ModalContent = 'setup-wizard' | 'profile-manager' | 'health-manager' | null

function App() {
  const [appMode, setAppMode] = useState<AppMode>('loading')
  const [modalContent, setModalContent] = useState<ModalContent>(null)
  const [needsInitialSetup, setNeedsInitialSetup] = useState(false)
  const [appState, setAppState] = useState<AppState>({
    profiles: [],
    currentProfile: null,
    isSetupMode: false,
    setupType: null,
    theme: 'dark'
  })
  
  const [notifications, setNotifications] = useState<NotificationMessage[]>([])
  const [retrying, setRetrying] = useState(false)
  const [modeSwitching, setModeSwitching] = useState(false)
  const [lastModeSwitchTime, setLastModeSwitchTime] = useState<number>(0)
  const [llmInitializing, setLlmInitializing] = useState(false)
  const [llmInitStep, setLlmInitStep] = useState('')
  const [llmInitProgress, setLlmInitProgress] = useState(0)
  const [isInInitialSetup, setIsInInitialSetup] = useState(false)
  
  // Health status state for sharing with sidebar
  const [healthStatus, setHealthStatus] = useState<HealthStatus | null>({
    api: {
      status: 'healthy',
      lastChecked: new Date().toISOString()
    },
    llm: {
      status: 'healthy',
      lastChecked: new Date().toISOString()
    }
  })
  
  // Flag to track if we need to show Ollama setup in main interface
  const [needsOllamaSetup, setNeedsOllamaSetup] = useState(false)
  
  // Global download progress state
  const [globalDownloads, setGlobalDownloads] = useState<DownloadInfo[]>([])
  
  // Track whether we've shown the initial connection notification
  const hasShownInitialConnection = useRef(false)
  const initializationInProgress = useRef(false)
  const hasLoadedInitialData = useRef(false)

  // Initialize health monitoring service on app start
  useEffect(() => {
    const initializeHealthMonitoring = async () => {
      // Subscribe to health status updates
      const unsubscribe = healthMonitoringService.subscribe((status: HealthStatus) => {
        setHealthStatus(status)
      })

      // Wait for the app to be in main mode before initializing health monitoring
      if (appMode === 'main') {
        console.log('App is in main mode, initializing health monitoring...')
        await healthMonitoringService.initialize()
      }

      // Cleanup subscription on component unmount
      return unsubscribe
    }

    initializeHealthMonitoring()
  }, [appMode]) // Run when appMode changes

  // Update health monitoring service when setup type changes
  useEffect(() => {
    if (appState.setupType) {
      console.log('Updating health monitoring service with mode:', appState.setupType)
      healthMonitoringService.setCurrentMode(appState.setupType)
    }
  }, [appState.setupType]) // Run when setupType changes

  // Update health monitoring service when user changes
  useEffect(() => {
    if (appState.user?.id) {
      console.log('Updating health monitoring service with user ID:', appState.user.id)
      healthMonitoringService.setCurrentUserId(appState.user.id)
    }
  }, [appState.user?.id]) // Run when user ID changes

  // Subscribe to global download manager
  useEffect(() => {
    console.log('📥 CRITICAL SETUP: Setting up global download manager subscription')
    console.log('📥 CRITICAL SETUP: window.electronAPI exists:', !!window.electronAPI)
    console.log('📥 CRITICAL SETUP: onGlobalDownloadProgress exists:', !!(window.electronAPI && window.electronAPI.onGlobalDownloadProgress))
    
    const unsubscribe = downloadManager.subscribe((downloads) => {
      console.log('📥 CRITICAL UPDATE: Downloads state updated to:', downloads.length, 'downloads')
      if (downloads.length > 0) {
        console.log('📥 CRITICAL UPDATE: Download details:', downloads.map(d => `${d.id}: ${d.title} (${d.status})`))
      }
      setGlobalDownloads(downloads)
    })

    // Listen for Electron global download events
    if (window.electronAPI && window.electronAPI.onGlobalDownloadProgress) {
      const handleGlobalDownloadProgress = (data: any) => {
        console.log('🎯 CRITICAL: Global download progress from Electron received!', data)
        console.log('🎯 Download ID:', data.id)
        console.log('🎯 Download Status:', data.status)
        console.log('🎯 Download Title:', data.title)
        
        if (data.status === 'downloading') {
          downloadManager.updateProgress(data.id, {
            progress: data.progress,
            size: data.size,
            downloadSpeed: data.downloadSpeed,
            timeEstimate: data.timeEstimate,
            description: data.description
          })
        } else if (data.status === 'completed') {
          downloadManager.completeDownload(data.id)
        } else if (data.status === 'error') {
          downloadManager.failDownload(data.id, data.error || 'Download failed')
        } else if (data.status === 'cancelled') {
          downloadManager.cancelDownload(data.id)
        } else {
          // Start new download if not already tracked
          if (!downloadManager.getDownload(data.id)) {
            downloadManager.startDownload({
              id: data.id,
              title: data.title,
              description: data.description,
              progress: data.progress,
              size: data.size,
              downloadSpeed: data.downloadSpeed,
              timeEstimate: data.timeEstimate,
              cancellable: data.cancellable
            })
          }
        }
      }

      window.electronAPI.onGlobalDownloadProgress(handleGlobalDownloadProgress)

      // Cleanup
      return () => {
        unsubscribe()
        if (window.electronAPI && window.electronAPI.removeGlobalDownloadProgressListener) {
          window.electronAPI.removeGlobalDownloadProgressListener(handleGlobalDownloadProgress)
        }
      }
    }

    return unsubscribe
  }, [])

  // Listen for Ollama installation progress during app startup
  useEffect(() => {
    if (!llmInitializing || !window.electronAPI) return

    const handleInstallProgress = (data: any) => {
      console.log('🦙 Installation progress:', data)
      setLlmInitStep(data.message)
      setLlmInitProgress(data.progress)
      
      if (data.error) {
        console.error('🦙 Installation error:', data.message)
      }
    }

    // Listen for progress events
    window.electronAPI.on('ollama-install-progress', handleInstallProgress)

    // Cleanup listener
    return () => {
      window.electronAPI?.removeListener('ollama-install-progress', handleInstallProgress)
    }
  }, [llmInitializing]) // Run when llmInitializing changes

  // Helper function to extract error message from API errors
  const getErrorMessage = (error: any): string => {
    // If it's an ApiError object with errors array
    if (error && error.errors && Array.isArray(error.errors)) {
      return error.errors.join('; ')
    }
    
    // If it's a regular Error object
    if (error && error.message) {
      return error.message
    }
    
    // If it's a string
    if (typeof error === 'string') {
      return error
    }
    
    // Fallback
    return 'An unknown error occurred'
  }

  // Check if initial setup is needed using the new user management system
  const checkInitialSetup = async (): Promise<boolean> => {
    try {
      // First, check if there are any users in the system at all
      const allUsers = await apiService.getAllUsers()
      console.log('Setup check: Found users in system:', allUsers.length)
      
      if (allUsers.length === 0) {
        console.log('Setup check: No users exist, initial setup required')
        return true
      }
      
      // Users exist, check if we have a stored user ID
      const storedUserId = userService.getUserId()
      console.log('Setup check: Stored user ID:', storedUserId)
      
      if (!storedUserId) {
        // No stored user ID, but users exist - pick the first user and set it as current
        console.log('Setup check: No stored user ID, using first available user')
        const firstUser = allUsers[0]
        
        // Set this user as the current user
        localStorage.setItem('naturalToSql.userId', firstUser.id)
        
        // Update app state with user data
        const setupType = firstUser.mode === 'Groq' ? 'groq' : firstUser.mode === 'Local' ? 'local' : 'basic'
        localStorage.setItem('naturalToSql.setupType', setupType)
        
        console.log(`Setup check: Set user ${firstUser.id} as current with mode ${setupType}`)
        return false // No initial setup needed
      }
      
      // We have a stored user ID, verify it's valid
      try {
        const userData = await userService.getCurrentUser()
        if (userData) {
          console.log(`Setup check: Found valid user with ${userData.profiles.length} profiles`)
          return false
        }
      } catch (error) {
        console.warn('Stored user ID is invalid:', error)
      }
      
      // Stored user ID is invalid, but other users exist - use the first one
      console.log('Setup check: Stored user ID invalid, using first available user')
      const firstUser = allUsers[0]
      localStorage.setItem('naturalToSql.userId', firstUser.id)
      
      const setupType = firstUser.mode === 'Groq' ? 'groq' : firstUser.mode === 'Local' ? 'local' : 'basic'
      localStorage.setItem('naturalToSql.setupType', setupType)
      
      return false
    } catch (error) {
      console.error('Error checking initial setup:', error)
      
      // On error, check if there's a saved setupType - if so, don't require initial setup
      const savedSetupType = localStorage.getItem('naturalToSql.setupType')
      if (savedSetupType) {
        console.log('Setup check: Error occurred but found saved setupType, skipping initial setup')
        return false
      }
      
      return true
    }
  }
  const loadProfilesFromServer = async (): Promise<ConnectionProfile[]> => {
    try {
      // Use user service to get profiles for the current user
      const profileDtos = await userService.getUserProfiles()
      
      // Convert ProfileDto[] to ConnectionProfile[]
      const profiles = profileDtos.map(convertProfileDtoToConnectionProfile)
      
      const validProfiles = profiles.filter(profile => 
        profile && 
        profile.id && 
        profile.id.trim() !== ''
      )
      
      // Sort profiles by creation date (newest first)
      const sortedProfiles = validProfiles.sort((a, b) => {
        const dateA = new Date(a.createdUtc).getTime()
        const dateB = new Date(b.createdUtc).getTime()
        return dateB - dateA // Newest first
      })
      
      // Save profiles to localStorage for persistence
      localStorage.setItem('naturalToSql.profiles', JSON.stringify(sortedProfiles))
      
      return sortedProfiles
    } catch (error) {
      console.error('Failed to load profiles from server:', error)
      return []
    }
  }

  // Get the last selected profile from localStorage or default to newest
  const getInitialProfile = (profiles: ConnectionProfile[]): string | null => {
    if (profiles.length === 0) return null
    
    // Try to get last selected profile from localStorage
    const savedProfileId = localStorage.getItem('naturalToSql.selectedProfile')
    if (savedProfileId && profiles.find(p => p.id === savedProfileId)) {
      return savedProfileId
    }
    
    // Default to newest profile (first in sorted array)
    return profiles[0].id
  }

  // Save selected profile to localStorage
  const saveSelectedProfile = (profileId: string | null) => {
    if (profileId) {
      localStorage.setItem('naturalToSql.selectedProfile', profileId)
    } else {
      localStorage.removeItem('naturalToSql.selectedProfile')
    }
  }

  // Check API health and determine initial mode
  useEffect(() => {
    const initializeApp = async () => {
      console.log('🚀 initializeApp called, flags:', {
        initializationInProgress: initializationInProgress.current,
        hasLoadedInitialData: hasLoadedInitialData.current,
        setupType: appState.setupType,
        appMode: appMode,
        isInInitialSetup: isInInitialSetup
      })
      
      // Only run once after initial data is loaded
      if (initializationInProgress.current || hasLoadedInitialData.current) {
        console.log('⏹️ initializeApp early return - already in progress or loaded')
        return
      }
      
      // Don't initialize if we're already in main mode (i.e., setup was just completed)
      if (appMode === 'main') {
        console.log('⏹️ initializeApp early return - already in main mode')
        return
      }
      
      // Wait for setup type and profiles to be loaded from localStorage
      if (appState.setupType === null) {
        console.log('⏳ initializeApp waiting for setupType to be loaded')
        return // Still loading setup type
      }
      
      initializationInProgress.current = true
      hasLoadedInitialData.current = true
      
      console.log('🔄 initializeApp proceeding with setupType:', appState.setupType)
      
      try {
        // First, check if we need initial setup without requiring API connection
        console.log('🔍 Checking if initial setup is needed...')
        const needsSetup = await checkInitialSetup()
        console.log('📝 Initial setup needed:', needsSetup)
        
        if (needsSetup) {
          // Skip API health checks if initial setup is needed
          console.log('⚙️ Initial setup required, skipping API connection')
          setNeedsInitialSetup(true)
          setAppMode('initial-setup')
          return
        }
        
        // Check if we have a setupType but no user - this might happen if user data was lost
        // but setup preferences were saved to localStorage
        if (appState.setupType && !appState.user) {
          console.log('🔄 Found setupType but no user - attempting to create/get user')
          try {
            const savedApiKey = localStorage.getItem('naturalToSql.groqApiKey')
            const user = await userService.createOrGetUser(appState.setupType, savedApiKey || undefined)
            console.log('👤 Created/retrieved user:', user)
            
            setAppState(prev => ({ ...prev, user }))
          } catch (error) {
            console.error('Failed to create/get user with saved setupType:', error)
            // Don't fail here - we'll try to continue with what we have
          }
        }
        
        // If no initial setup needed, check if API process is already running
        // Only start API process if it's not already running (avoid restarts during mode changes)
        console.log('No initial setup needed, checking API process status...')
        
        // First check if API is already responding
        let apiAlreadyRunning = false
        try {
          if (window.electronAPI) {
            const health = await window.electronAPI.checkApiHealth()
            apiAlreadyRunning = !!health
          } else {
            await apiService.checkHealth()
            apiAlreadyRunning = true
          }
          console.log('API already running:', apiAlreadyRunning)
        } catch (error) {
          console.log('API not responding, will start process')
          apiAlreadyRunning = false
        }
        
        // Only start API process if it's not already running
        if (!apiAlreadyRunning && window.electronAPI && window.electronAPI.startApiProcess) {
          try {
            console.log('Starting API process...')
            const result = await window.electronAPI.startApiProcess(appState.setupType as 'groq' | 'local' | 'basic')
            if (result.success) {
              console.log('API process started successfully')
            } else {
              console.error('Failed to start API process:', result.message)
              // Continue anyway and try to connect
            }
          } catch (error) {
            console.error('Error starting API process:', error)
            // Continue anyway and try to connect
          }
        } else if (apiAlreadyRunning) {
          console.log('API process already running, skipping startup')
        }
        
        // Add initial delay to let API start
        await new Promise(resolve => setTimeout(resolve, 4000))
        
        const maxRetries = 5
        const retryDelay = 2000
        let connected = false
        
        for (let attempt = 0; attempt < maxRetries; attempt++) {
          try {
            console.log(`API connection attempt ${attempt + 1}/${maxRetries}`)
            
            // Check if we're in Electron environment
            if (window.electronAPI) {
              const health = await window.electronAPI.checkApiHealth()
              if (health) {
                connected = true
                break
              }
            } else {
              // Fallback for web environment
              await apiService.checkHealth()
              connected = true
              break
            }
            
            throw new Error('API health check failed')
          } catch (error) {
            console.error(`API connection attempt ${attempt + 1} failed:`, error)
            
            if (attempt < maxRetries - 1) {
              await new Promise(resolve => setTimeout(resolve, retryDelay))
            } else {
              // On the last attempt, capture the error for display
              if (attempt === maxRetries - 1) {
                addNotification({
                  type: 'error',
                  title: 'Connection Failed',
                  message: getErrorMessage(error),
                  duration: 0
                })
              }
            }
          }
        }

        if (connected) {
          // Load profiles and determine initial mode
          const profiles = await loadProfilesFromServer()
          const initialProfile = getInitialProfile(profiles)
          
          setAppState(prev => ({ 
            ...prev, 
            profiles,
            currentProfile: initialProfile 
          }))
          
          // Check if user is in local mode and ensure Ollama is running
          // Get the setup type directly from user data instead of appState
          let shouldShowMainInterface = true
          let userSetupType: string | null = null
          
          try {
            // Get the current user to determine setup type
            const currentUser = await userService.getCurrentUser()
            if (currentUser) {
              userSetupType = currentUser.mode === 'Local' ? 'local' : 
                            currentUser.mode === 'Groq' ? 'groq' : 'basic'
              console.log('🦙 User setup type determined:', userSetupType, 'from mode:', currentUser.mode)
            }
          } catch (error) {
            console.log('🦙 Could not determine user setup type:', error)
          }
          
          if (userSetupType === 'local' && window.electronAPI?.checkOllamaStatus && window.electronAPI?.startOllamaModel) {
            try {
              setLlmInitializing(true)
              setLlmInitProgress(20)
              setLlmInitStep('Checking Ollama installation...')
              console.log('🦙 User is in local mode, checking Ollama status...')
              
              const ollamaStatus = await window.electronAPI.checkOllamaStatus()
              console.log('🦙 Ollama status:', ollamaStatus)
              
              setLlmInitProgress(40)
              await new Promise(resolve => setTimeout(resolve, 500)) // Brief pause for UI
              
              if (ollamaStatus.ollamaInstalled && ollamaStatus.modelInstalled && !ollamaStatus.modelRunning) {
                setLlmInitStep('Starting qwen3:8b model...')
                setLlmInitProgress(60)
                console.log('🦙 Ollama installed but model not running, starting model...')
                
                const startResult = await window.electronAPI.startOllamaModel()
                setLlmInitProgress(80)
                
                if (startResult.success) {
                  setLlmInitStep('Model started successfully!')
                  setLlmInitProgress(100)
                  console.log('🦙 Model started successfully on app load')
                  
                  // Brief delay to show success message
                  await new Promise(resolve => setTimeout(resolve, 1500))
                  
                  addNotification({
                    type: 'success',
                    title: 'Local LLM Ready',
                    message: 'qwen3:8b model started successfully',
                    duration: 3000
                  })
                } else {
                  setLlmInitStep('Model start initiated...')
                  setLlmInitProgress(100)
                  console.warn('🦙 Failed to start model on app load:', startResult.error)
                  
                  await new Promise(resolve => setTimeout(resolve, 1500))
                  
                  addNotification({
                    type: 'warning',
                    title: 'Local LLM Notice',
                    message: 'Model start initiated but may still be loading',
                    duration: 4000
                  })
                }
              } else if (ollamaStatus.ollamaInstalled && ollamaStatus.modelInstalled && ollamaStatus.modelRunning) {
                setLlmInitStep('Model is already running!')
                setLlmInitProgress(100)
                console.log('🦙 Model already running')
                
                await new Promise(resolve => setTimeout(resolve, 1200))
                
                addNotification({
                  type: 'success',
                  title: 'Local LLM Ready',
                  message: 'qwen3:8b model is running',
                  duration: 2000
                })
              } else if (!ollamaStatus.ollamaInstalled || !ollamaStatus.modelInstalled) {
                console.log('🦙 Ollama or model not installed, will show setup in main interface...')
                
                // Don't automatically install - let user decide
                setLlmInitStep('Setup required - available in main interface')
                setLlmInitProgress(100)
                
                await new Promise(resolve => setTimeout(resolve, 1500))
                
                addNotification({
                  type: 'info',
                  title: 'Local LLM Setup Required',
                  message: 'Ollama installation is available from the main interface',
                  duration: 4000
                })
                
                // Flag that we need to show setup in main interface
                setNeedsOllamaSetup(true)
              }
            } catch (error) {
              setLlmInitStep('Check failed - Unable to verify Ollama status')
              setLlmInitProgress(100)
              console.error('🦙 Error checking Ollama status on app load:', error)
              
              await new Promise(resolve => setTimeout(resolve, 1200))
              
              addNotification({
                type: 'warning',
                title: 'Local LLM Check Failed',
                message: 'Unable to verify Ollama status',
                duration: 3000
              })
            } finally {
              setLlmInitializing(false)
              setLlmInitStep('')
              setLlmInitProgress(0)
            }
          }
          
          // Show main interface after LLM initialization is complete
          if (shouldShowMainInterface) {
            if (profiles.length === 0) {
              setAppMode('main') // Start with main interface
              setModalContent('setup-wizard') // Show setup wizard as modal - only when no profiles exist
            } else {
              setAppMode('main') // Show main interface with selected profile
              setModalContent(null) // No modal needed - go directly to main interface
            }
          }
          
          // Update health status based on setup type
          if (appState.setupType === 'groq') {
            setHealthStatus({
              api: { 
                status: 'healthy', 
                responseTime: 100,
                lastChecked: new Date().toISOString()
              },
              llm: { 
                status: 'healthy', 
                lastChecked: new Date().toISOString()
              }
            })
          } else if (appState.setupType === 'local') {
            setHealthStatus({
              api: { 
                status: 'not_started', 
                lastChecked: new Date().toISOString()
              },
              llm: { 
                status: 'not_initialized', 
                lastChecked: new Date().toISOString()
              }
            })
          } else if (appState.setupType === 'basic') {
            setHealthStatus({
              api: { 
                status: 'not_started', 
                lastChecked: new Date().toISOString()
              },
              llm: { 
                status: 'not_initialized', 
                lastChecked: new Date().toISOString()
              }
            })
          }
          
          // Only show the initial connection notification once
          if (!hasShownInitialConnection.current) {
            addNotification({
              type: 'success',
              title: 'Connected',
              message: `Found ${profiles.length} database profile${profiles.length !== 1 ? 's' : ''}${initialProfile ? `. Using "${profiles.find(p => p.id === initialProfile)?.name}"` : ''}`,
              duration: 3000
            })
            hasShownInitialConnection.current = true
          }
        } else {
          // Connection failed - set appropriate health status
          if (appState.setupType === 'groq') {
            setHealthStatus({
              api: { 
                status: 'down', 
                lastChecked: new Date().toISOString()
              },
              llm: { 
                status: 'error', 
                lastError: 'Failed to connect to Groq API',
                lastChecked: new Date().toISOString()
              }
            })
          } else {
            setHealthStatus({
              api: { 
                status: 'down', 
                lastChecked: new Date().toISOString()
              },
              llm: { 
                status: 'not_initialized', 
                lastChecked: new Date().toISOString()
              }
            })
          }
          setAppMode('loading') // Stay in loading mode if connection failed
        }
      } catch (error) {
        console.error('App initialization failed:', error)
        // If we can't even check for initial setup, show the setup screen
        setNeedsInitialSetup(true)
        setAppMode('initial-setup')
      }
      
      initializationInProgress.current = false
    }

    // Don't initialize if we're in the middle of initial setup
    if (!isInInitialSetup) {
      initializeApp()
    } else {
      console.log('⏸️ Skipping app initialization - in initial setup')
    }
  }, [appState.setupType, isInInitialSetup, appMode])

  const retryConnection = async () => {
    setRetrying(true)
    setAppMode('loading')
    
    try {
      // If we're in Groq mode, try to restart the API process
      if (appState.setupType === 'groq') {
        console.log('Retrying Groq mode connection - restarting API process...')
        
        // Try to start the API process again
        if (window.electronAPI && window.electronAPI.startApiProcess) {
          const startResult = await window.electronAPI.startApiProcess('groq')
          if (!startResult.success) {
            throw new Error(startResult.message || 'Failed to start API process')
          }
        }
        
        // Wait longer for the API to be ready
        await new Promise(resolve => setTimeout(resolve, 3000))
      }
      
      const maxRetries = 5
      const retryDelay = 2000
      let connected = false
      
      for (let attempt = 0; attempt < maxRetries; attempt++) {
        try {
          console.log(`Retry attempt ${attempt + 1}/${maxRetries}`)
          
          if (window.electronAPI) {
            const health = await window.electronAPI.checkApiHealth()
            if (health) {
              connected = true
              
              // Load profiles and determine mode
              const profiles = await loadProfilesFromServer()
              const initialProfile = getInitialProfile(profiles)
              
              setAppState(prev => ({ 
                ...prev, 
                profiles,
                currentProfile: initialProfile 
              }))
              
              if (profiles.length === 0) {
                setAppMode('main')
                setModalContent('setup-wizard')
              } else {
                setAppMode('main')
                setModalContent(null) // Go directly to main interface with selected profile
              }
              
              addNotification({
                type: 'success',
                title: 'Connection Restored',
                message: 'Successfully connected to the API service',
                duration: 3000
              })
              break
            }
          } else {
            await apiService.checkHealth()
            connected = true
            break
          }
          
          throw new Error('API health check failed')
        } catch (error) {
          console.error(`Retry attempt ${attempt + 1} failed:`, error)
          
          if (attempt < maxRetries - 1) {
            await new Promise(resolve => setTimeout(resolve, retryDelay))
          }
        }
      }
      
      if (!connected) {
        addNotification({
          type: 'error',
          title: 'Connection Failed',
          message: 'Unable to connect to the API service after multiple attempts',
          duration: 5000
        })
        setAppMode('loading')
      }
      
    } catch (error) {
      console.error('Retry connection failed:', error)
      addNotification({
        type: 'error',
        title: 'Connection Failed', 
        message: getErrorMessage(error),
        duration: 5000
      })
      setAppMode('loading')
    } finally {
      setRetrying(false)
    }
  }

  // Add refs to track notification timeouts and throttling
  const notificationTimeoutsRef = useRef<Map<string, NodeJS.Timeout>>(new Map())
  const lastNotificationTimeRef = useRef<Map<string, number>>(new Map())

  const addNotification = (notification: Omit<NotificationMessage, 'id'>) => {
    // Throttle notifications of the same type and title (prevent spam)
    const notificationKey = `${notification.type}-${notification.title}`
    const now = Date.now()
    const lastTime = lastNotificationTimeRef.current.get(notificationKey) || 0
    const throttleTime = 1000 // 1 second throttle
    
    if (now - lastTime < throttleTime) {
      console.log('Notification throttled:', notification.title)
      return
    }
    
    lastNotificationTimeRef.current.set(notificationKey, now)
    
    // Check for duplicate notifications (same type and title) in current notifications
    const isDuplicate = notifications.some(existing => 
      existing.type === notification.type && 
      existing.title === notification.title
    )
    
    if (isDuplicate) {
      console.log('Duplicate notification prevented:', notification.title)
      return
    }
    
    const id = Date.now().toString() + Math.random().toString(36).substr(2, 9)
    const newNotification = { ...notification, id }
    
    setNotifications(prev => {
      // Limit notifications to 5 maximum to prevent UI overflow
      const updated = [...prev, newNotification]
      if (updated.length > 5) {
        // Clear timeouts for removed notifications
        const toRemove = updated.slice(0, updated.length - 5)
        toRemove.forEach(n => {
          const timeoutId = notificationTimeoutsRef.current.get(n.id)
          if (timeoutId) {
            clearTimeout(timeoutId)
            notificationTimeoutsRef.current.delete(n.id)
          }
        })
        return updated.slice(-5) // Keep only the latest 5
      }
      return updated
    })

    // Auto-remove after duration with proper cleanup
    if (notification.duration) {
      const timeoutId = setTimeout(() => {
        removeNotification(id)
      }, notification.duration)
      
      // Store timeout reference for cleanup
      notificationTimeoutsRef.current.set(id, timeoutId)
    }
  }

  const removeNotification = (id: string) => {
    // Clear timeout if it exists
    const timeoutId = notificationTimeoutsRef.current.get(id)
    if (timeoutId) {
      clearTimeout(timeoutId)
      notificationTimeoutsRef.current.delete(id)
    }
    setNotifications(prev => prev.filter(n => n.id !== id))
  }

  // Cleanup notification timeouts on unmount
  useEffect(() => {
    return () => {
      notificationTimeoutsRef.current.forEach((timeoutId) => {
        clearTimeout(timeoutId)
      })
      notificationTimeoutsRef.current.clear()
      lastNotificationTimeRef.current.clear()
    }
  }, [])

  // Profile management handlers
  const handleProfileCreated = async (profile: ConnectionProfile) => {
    console.log('Profile created:', profile)
    
    try {
      // Reload profiles from server to get fresh data with proper sorting
      const profiles = await loadProfilesFromServer()
      console.log('Reloaded profiles:', profiles)
      
      setAppState(prev => ({
        ...prev,
        profiles,
        currentProfile: profile.id
      }))
      
      // Save the newly created profile as selected
      saveSelectedProfile(profile.id)
      console.log('Saved profile to localStorage:', profile.id)
      
      setAppMode('main') // Go directly to main interface
      setModalContent(null) // Close the modal
      
      // Trigger a health check now that we have a profile (which resolves the GUID format error)
      setTimeout(async () => {
        try {
          console.log('🔍 Triggering health check after profile creation to ensure accurate status')
          await healthMonitoringService.refreshHealth(true)
        } catch (error) {
          console.warn('Failed to refresh health after profile creation:', error)
        }
      }, 1000)
      
      addNotification({
        type: 'success',
        title: 'Profile Created & Selected',
        message: `Successfully created and switched to profile "${profile.name}" for ${profile.databaseName}`,
        duration: 4000
      })
    } catch (error) {
      console.error('Error in handleProfileCreated:', error)
      
      // Fallback - use the created profile data directly since it's now properly formatted
      setAppState(prev => ({
        ...prev,
        profiles: [profile, ...prev.profiles].sort((a, b) => {
          const dateA = new Date(a.createdUtc).getTime()
          const dateB = new Date(b.createdUtc).getTime()
          return dateB - dateA // Newest first
        }),
        currentProfile: profile.id
      }))
      
      saveSelectedProfile(profile.id)
      setAppMode('main')
      setModalContent(null)
      
      // Trigger a health check now that we have a profile (which resolves the GUID format error)
      setTimeout(async () => {
        try {
          console.log('🔍 Triggering health check after profile creation (fallback) to ensure accurate status')
          await healthMonitoringService.refreshHealth(true)
        } catch (error) {
          console.warn('Failed to refresh health after profile creation (fallback):', error)
        }
      }, 1000)
      
      addNotification({
        type: 'success',
        title: 'Profile Created & Selected',
        message: `Successfully created and switched to profile "${profile.name}" for ${profile.databaseName}`,
        duration: 4000
      })
    }
  }

  const handleProfileSelected = (profile: ConnectionProfile) => {
    setAppState(prev => ({
      ...prev,
      currentProfile: profile.id
    }))
    
    // Save the selected profile
    saveSelectedProfile(profile.id)
    
    setAppMode('main')
    setModalContent(null) // Close the modal
    
    addNotification({
      type: 'info',
      title: 'Profile Selected',
      message: `Now using "${profile.name}" for ${profile.databaseName}`,
      duration: 2000
    })
  }

  const handleBackToProfiles = () => {
    setModalContent('profile-manager')
  }

  const handleEnterSetupMode = () => {
    setModalContent('setup-wizard')
  }

  const handleOpenHealthManager = () => {
    setModalContent('health-manager')
  }

  const handleInitialSetupCompleted = async (setupType: 'groq' | 'local' | 'basic', apiKey?: string) => {
    console.log('Initial setup completed with type:', setupType, 'API key provided:', !!apiKey)
    console.log('Actual API key value:', apiKey ? `"${apiKey}" (length: ${apiKey.length})` : 'null/undefined')
    
    try {
      setNeedsInitialSetup(false)
      setIsInInitialSetup(true) // Prevent automatic reload during setup
      console.log('🔧 Debug - Set isInInitialSetup to true')
      
      // Step 1: Create or get user
      addNotification({
        type: 'info',
        title: 'Initializing',
        message: 'Setting up user configuration...',
        duration: 2000
      })
      
      console.log('🚀 About to call userService.createOrGetUser with:', setupType, apiKey ? `"${apiKey}"` : 'null/undefined')
      const user = await userService.createOrGetUser(setupType, apiKey)
      console.log('User created/retrieved:', user)
      
      // Step 2: Start API process
      addNotification({
        type: 'info',
        title: 'Starting Services',
        message: 'Initializing backend services...',
        duration: 3000
      })
      
      if (window.electronAPI && window.electronAPI.startApiProcess) {
        const result = await window.electronAPI.startApiProcess(setupType)
        if (result.success) {
          console.log('API process started successfully')
          
          // Step 3: Wait for API to be ready
          addNotification({
            type: 'info',
            title: 'Connecting',
            message: 'Establishing connection to services...',
            duration: 4000
          })
          
          // Wait for the API to be ready before proceeding
          await new Promise(resolve => setTimeout(resolve, 4000))
          
          // Try to connect to the API
          let apiReady = false
          const maxRetries = 10
          const retryDelay = 1000
          
          for (let attempt = 0; attempt < maxRetries; attempt++) {
            try {
              if (window.electronAPI) {
                const health = await window.electronAPI.checkApiHealth()
                if (health) {
                  apiReady = true
                  break
                }
              } else {
                await apiService.checkHealth()
                apiReady = true
                break
              }
            } catch (error) {
              console.log(`API readiness check ${attempt + 1}/${maxRetries} failed:`, error)
              if (attempt < maxRetries - 1) {
                await new Promise(resolve => setTimeout(resolve, retryDelay))
              }
            }
          }
          
          if (apiReady) {
            // Switch to main mode before LLM initialization so the progress can be shown
            setAppMode('main')
            
            // Step 4: Initialize Local LLM if needed
            if (setupType === 'local' && window.electronAPI?.checkOllamaStatus && window.electronAPI?.startOllamaModel) {
              try {
                setLlmInitializing(true)
                setLlmInitProgress(20)
                setLlmInitStep('Checking Ollama installation...')
                console.log('🦙 User selected local mode, checking Ollama status during setup...')
                
                const ollamaStatus = await window.electronAPI.checkOllamaStatus()
                console.log('🦙 Ollama status:', ollamaStatus)
                
                setLlmInitProgress(40)
                await new Promise(resolve => setTimeout(resolve, 500)) // Brief pause for UI
                
                if (ollamaStatus.ollamaInstalled && ollamaStatus.modelInstalled && !ollamaStatus.modelRunning) {
                  setLlmInitStep('Starting qwen3:8b model...')
                  setLlmInitProgress(60)
                  console.log('🦙 Ollama installed but model not running, starting model during setup...')
                  
                  const startResult = await window.electronAPI.startOllamaModel()
                  setLlmInitProgress(80)
                  
                  if (startResult.success) {
                    setLlmInitStep('Model started successfully!')
                    setLlmInitProgress(100)
                    console.log('🦙 Model started successfully during setup')
                    
                    // Brief delay to show success message
                    await new Promise(resolve => setTimeout(resolve, 1500))
                    
                    addNotification({
                      type: 'success',
                      title: 'Local LLM Ready',
                      message: 'qwen3:8b model started successfully',
                      duration: 3000
                    })
                  } else {
                    setLlmInitStep('Model start initiated...')
                    setLlmInitProgress(100)
                    console.warn('🦙 Failed to start model during setup:', startResult.error)
                    
                    await new Promise(resolve => setTimeout(resolve, 1500))
                    
                    addNotification({
                      type: 'warning',
                      title: 'Local LLM Notice',
                      message: 'Model start initiated but may still be loading',
                      duration: 4000
                    })
                  }
                } else if (ollamaStatus.ollamaInstalled && ollamaStatus.modelInstalled && ollamaStatus.modelRunning) {
                  setLlmInitStep('Model is already running!')
                  setLlmInitProgress(100)
                  console.log('🦙 Model already running during setup')
                  
                  await new Promise(resolve => setTimeout(resolve, 1200))
                  
                  addNotification({
                    type: 'success',
                    title: 'Local LLM Ready',
                    message: 'qwen3:8b model is running',
                    duration: 2000
                  })
                } else if (!ollamaStatus.ollamaInstalled || !ollamaStatus.modelInstalled) {
                  console.log('🦙 Ollama or model not installed during setup, will be available in main interface...')
                  
                  setLlmInitStep('Setup required - available in main interface')
                  setLlmInitProgress(100)
                  
                  await new Promise(resolve => setTimeout(resolve, 1500))
                  
                  addNotification({
                    type: 'info',
                    title: 'Local LLM Setup Pending',
                    message: 'Ollama installation will be available from the main interface after database setup',
                    duration: 5000
                  })
                  
                  // Flag that we need to show setup in main interface
                  setNeedsOllamaSetup(true)
                }
              } catch (error) {
                console.error('🦙 Error during LLM initialization in setup:', error)
                setLlmInitStep('LLM initialization failed')
                setLlmInitProgress(100)
                
                await new Promise(resolve => setTimeout(resolve, 1500))
                
                addNotification({
                  type: 'warning',
                  title: 'Local LLM Warning',
                  message: 'LLM initialization encountered an issue but you can continue',
                  duration: 4000
                })
              } finally {
                setLlmInitializing(false)
              }
            }
            
            // Step 5: Load user data
            addNotification({
              type: 'info',
              title: 'Loading Data',
              message: 'Loading your profiles and settings...',
              duration: 2000
            })
            
            // Load profiles for the user
            const profiles = await loadProfilesFromServer()
            const initialProfile = getInitialProfile(profiles)
            
            setAppState(prev => ({ 
              ...prev, 
              profiles,
              currentProfile: initialProfile,
              setupType: setupType,
              user: user
            }))
            
            // Save the selected profile to localStorage
            saveSelectedProfile(initialProfile)
            
            if (profiles.length === 0) {
              setModalContent('setup-wizard') // Show database setup wizard
            } else {
              setModalContent(null) // Go directly to main interface
            }
          } else {
            // API not ready, but still go to main mode (user can retry connection later)
            setAppMode('main')
            setAppState(prev => ({ 
              ...prev, 
              setupType: setupType,
              user: user
            }))
            setModalContent('setup-wizard') // Show database setup since we couldn't load profiles
            
            addNotification({
              type: 'warning',
              title: 'API Connection Issue',
              message: 'Setup completed but API connection is not ready. You can try again later.',
              duration: 5000
            })
          }
        } else {
          console.error('Failed to start API process:', result.message)
          addNotification({
            type: 'error',
            title: 'API Start Failed',
            message: result.message || 'Could not start the API service',
            duration: 5000
          })
          
          // Still update user state and go to main mode
          setAppMode('main')
          setAppState(prev => ({ 
            ...prev, 
            setupType: setupType,
            user: user
          }))
          setModalContent('setup-wizard')
        }
      } else {
        // No Electron API available (development mode)
        setAppMode('main')
        setAppState(prev => ({ 
          ...prev, 
          setupType: setupType,
          user: user
        }))
        setModalContent('setup-wizard')
      }
      
      // Post-setup validation for local mode
      if (setupType === 'local' && window.electronAPI?.checkOllamaStatus) {
        try {
          const ollamaStatus = await window.electronAPI.checkOllamaStatus()
          
          // Only validate if Ollama is available - if not, user will get prompted to download
          // Don't auto-switch to basic mode here as user may be starting the download process
          if (ollamaStatus.ollamaInstalled && ollamaStatus.modelInstalled) {
            addNotification({
              type: 'success',
              title: 'Setup Complete',
              message: 'Local LLM is ready to use!',
              duration: 3000
            })
          } else {
            // Local mode selected but Ollama not available - let user proceed with download option
            console.log('🦙 Local mode selected but Ollama/model not available - user will be prompted to download')
            addNotification({
              type: 'info',
              title: 'Local LLM Setup Required',
              message: 'You can download and install the Local LLM when you first try to use it, or switch to another mode in Settings.',
              duration: 5000
            })
          }
        } catch (ollamaCheckError) {
          console.error('Failed to check Ollama status after setup:', ollamaCheckError)
          addNotification({
            type: 'warning',
            title: 'Setup Complete with Warning',
            message: 'Setup completed but could not verify Local LLM status. Check Settings if needed.',
            duration: 5000
          })
        }
      } else {
        addNotification({
          type: 'success',
          title: 'Setup Complete',
          message: setupType === 'groq' ? 'NaturalToSQL is ready with Groq AI!' : 
                   setupType === 'local' ? 'NaturalToSQL is ready with Local LLM!' : 
                   'NaturalToSQL is ready in Basic mode!',
          duration: 3000
        })
      }
      
    } catch (error) {
      console.error('Error during initial setup completion:', error)
      addNotification({
        type: 'error',
        title: 'Setup Error',
        message: 'An error occurred during setup completion',
        duration: 5000
      })
      
      // Still try to go to main mode
      setAppMode('main')
      setModalContent('setup-wizard')
    } finally {
      // Clear the initial setup flag to allow normal initialization
      setIsInInitialSetup(false)
      console.log('🔧 Debug - Set isInInitialSetup to false in finally block')
      
      // Reset initialization flags to ensure clean state
      // Don't reset hasLoadedInitialData here since we want to prevent re-initialization
      initializationInProgress.current = false
    }
  }

  const handleHealthStatusUpdate = (status: HealthStatus) => {
    setHealthStatus(status)
  }

  const handleProfilesUpdated = async () => {
    // Reload profiles from server to sync with latest state
    const profiles = await loadProfilesFromServer()
    
    // Check if current profile still exists, otherwise select newest
    const currentProfile = appState.currentProfile && profiles.find(p => p.id === appState.currentProfile) ?
      appState.currentProfile : getInitialProfile(profiles)
    
    setAppState(prev => ({
      ...prev,
      profiles,
      currentProfile
    }))
    
    // Save the updated selection
    saveSelectedProfile(currentProfile)
  }

  const handleChangeModeSetup = async (mode: 'groq' | 'local' | 'basic', apiKey?: string) => {
    try {
      console.log(`Starting mode change to: ${mode}`)
      setModeSwitching(true)
      
      // Set health status to loading immediately to avoid showing confusing/inconsistent status
      setHealthStatus({
        api: {
          status: 'loading',
          lastChecked: new Date().toISOString()
        },
        llm: {
          status: 'loading',
          lastChecked: new Date().toISOString()
        }
      })
      
      // Validate API key for Groq mode
      if (mode === 'groq' && !apiKey) {
        throw new Error('API key is required for Groq mode')
      }
      
      // Update user mode via API and app state
      // The API process stays running - we only update the user's mode in the backend
      await userService.updateUserMode(mode, apiKey)
      
      // Fetch the updated user data to ensure app state has the latest API key
      const updatedUser = await userService.getCurrentUser()
      setAppState(prev => ({ 
        ...prev, 
        setupType: mode,
        user: updatedUser 
      }))
      
      // Wait a moment for the backend to process the mode change
      await new Promise(resolve => setTimeout(resolve, 500))
      
      // Verify API is still healthy after mode change
      console.log('Verifying API health after mode change...')
      let apiReady = false
      
      try {
        if (window.electronAPI) {
          const health = await window.electronAPI.checkApiHealth()
          apiReady = !!health
        } else {
          await apiService.checkHealth()
          apiReady = true
        }
      } catch (error) {
        console.warn('API health check failed after mode change:', error)
        apiReady = false
      }
      
      // Set appropriate health status based on the mode
      if (apiReady) {
        if (mode === 'groq') {
          setHealthStatus({
            api: { 
              status: 'healthy', 
              responseTime: 100,
              lastChecked: new Date().toISOString()
            },
            llm: { 
              status: 'healthy', 
              lastChecked: new Date().toISOString()
            }
          })
          
          addNotification({
            type: 'success',
            title: 'Groq AI Enabled',
            message: 'Successfully switched to Groq AI mode. Natural language to SQL conversion is now available.',
            duration: 5000
          })
        } else if (mode === 'local') {
          setHealthStatus({
            api: { 
              status: 'healthy', 
              responseTime: 100,
              lastChecked: new Date().toISOString()
            },
            llm: { 
              status: 'loading', 
              lastChecked: new Date().toISOString()
            }
          })
          
          // Trigger a health check specifically for local LLM
          setTimeout(async () => {
            try {
              await healthMonitoringService.refreshHealth(true)
            } catch (error) {
              console.warn('Failed to refresh health after local mode switch:', error)
            }
          }, 1000)
          
          addNotification({
            type: 'success',
            title: 'Local LLM Mode Enabled',
            message: 'Successfully switched to local LLM mode. Checking Local LLM status...',
            duration: 5000
          })
        } else if (mode === 'basic') {
          setHealthStatus({
            api: { 
              status: 'healthy', 
              responseTime: 100,
              lastChecked: new Date().toISOString()
            },
            llm: { 
              status: 'not_initialized', 
              lastChecked: new Date().toISOString()
            }
          })
          
          addNotification({
            type: 'success',
            title: 'Basic Mode Enabled',
            message: 'Successfully switched to basic mode. You can browse databases and execute SQL manually.',
            duration: 5000
          })
        }
      } else {
        // API is not responding - show error but don't restart it
        setHealthStatus({
          api: { 
            status: 'down', 
            lastChecked: new Date().toISOString()
          },
          llm: { 
            status: 'error', 
            lastError: 'API connection lost after mode change',
            lastChecked: new Date().toISOString()
          }
        })
        
        addNotification({
          type: 'warning',
          title: 'API Connection Issue',
          message: `Mode changed to ${mode} but API connection was lost. Please check the API status.`,
          duration: 7000
        })
      }
      
      console.log(`Mode change to ${mode} completed successfully`)
      
    } catch (error) {
      console.error('Error changing mode:', error)
      
      // Revert state on error
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred'
      
      addNotification({
        type: 'error',
        title: 'Mode Change Failed',
        message: `Failed to switch to ${mode} mode: ${errorMessage}`,
        duration: 7000
      })
      
      // Update health status to show error
      setHealthStatus({
        api: { 
          status: 'down', 
          lastChecked: new Date().toISOString()
        },
        llm: { 
          status: 'error', 
          lastError: `Mode change failed: ${errorMessage}`,
          lastChecked: new Date().toISOString()
        }
      })
    } finally {
      // Add a small delay before clearing the modeSwitching flag
      // This ensures that any API process startup has time to complete
      // and prevents race conditions with the error page display
      setTimeout(() => {
        setModeSwitching(false)
        setLastModeSwitchTime(Date.now()) // Track when mode switch completed
      }, 1500) // Increased to 1.5 seconds to give more time for health monitoring
    }
  }

  const switchProfile = (profileId: string) => {
    const profile = appState.profiles.find(p => p.id === profileId)
    setAppState(prev => ({ ...prev, currentProfile: profileId }))
    saveSelectedProfile(profileId)
    
    if (profile) {
      addNotification({
        type: 'info',
        title: 'Profile Switched',
        message: `Now using "${profile.name}" for ${profile.databaseName}`,
        duration: 2000
      })
    }
  }

  const removeProfile = async (profileId: string) => {
    try {
      await apiService.removeProfile(profileId)
      
      // Reload profiles from server
      const profiles = await loadProfilesFromServer()
      
      // Determine new current profile
      let newCurrentProfile: string | null = null
      if (appState.currentProfile === profileId) {
        // If we're removing the current profile, select the newest remaining one
        newCurrentProfile = getInitialProfile(profiles)
      } else {
        // Keep the current profile if it still exists
        newCurrentProfile = profiles.find(p => p.id === appState.currentProfile) ? 
          appState.currentProfile : getInitialProfile(profiles)
      }

      setAppState(prev => ({
        ...prev,
        profiles,
        currentProfile: newCurrentProfile
      }))
      
      // Save the new selection
      saveSelectedProfile(newCurrentProfile)

      // If no profiles left, show setup wizard
      if (profiles.length === 0) {
        setAppMode('main')
        setModalContent('setup-wizard')
      } else if (appState.currentProfile === profileId) {
        // If we removed the current profile and there are others, optionally show profile manager
        // But since we auto-select the newest, we can just stay in main interface
        setModalContent(null)
      }

      addNotification({
        type: 'success',
        title: 'Profile Removed',
        message: 'Profile has been successfully deleted',
        duration: 3000
      })
    } catch (error) {
      addNotification({
        type: 'error',
        title: 'Delete Failed',
        message: getErrorMessage(error),
        duration: 5000
      })
    }
  }

  const toggleTheme = () => {
    const newTheme = appState.theme === 'light' ? 'dark' : 'light'
    setAppState(prev => ({ ...prev, theme: newTheme }))
    localStorage.setItem('naturalToSql.theme', newTheme)
    
    // Apply theme to document
    if (newTheme === 'dark') {
      document.documentElement.classList.add('dark')
    } else {
      document.documentElement.classList.remove('dark')
    }
  }

  // Apply saved theme on load
  useEffect(() => {
    const savedTheme = localStorage.getItem('naturalToSql.theme') as 'light' | 'dark' | null
    if (savedTheme) {
      setAppState(prev => ({ ...prev, theme: savedTheme }))
      if (savedTheme === 'dark') {
        document.documentElement.classList.add('dark')
      }
    }
  }, [])

  // Helper function to convert ProfileDto to ConnectionProfile
  const convertProfileDtoToConnectionProfile = (profileDto: import('./types/user').ProfileDto): ConnectionProfile => {
    return {
      id: profileDto.id,
      name: profileDto.name,
      connectionString: '', // Will be filled by API calls when needed
      queries: [], // Will be filled by API calls when needed
      createdUtc: profileDto.createdUtc,
      databaseName: profileDto.databaseName,
      provider: profileDto.provider,
      secretRef: profileDto.secretRef,
      cacheFile: profileDto.cacheFile
    }
  }

  // Load user data and setup state on app start
  useEffect(() => {
    const initializeUserData = async () => {
      console.log('🏁 initializeUserData called')
      try {
        // First check if users exist in the system
        const allUsers = await apiService.getAllUsers()
        console.log('👥 All users in system:', allUsers.length)
        
        if (allUsers.length === 0) {
          console.log('❌ No users found in system')
          // For fresh installations, set a default to allow initialization to proceed
          console.log('🆕 Fresh installation, setting default setup type: basic')
          setAppState(prev => ({ ...prev, setupType: 'basic' }))
          return
        }
        
        // Users exist, check if we have current user data
        console.log('👤 Getting current user...')
        let userData = await userService.getCurrentUser()
        console.log('👤 User data received:', userData)
        
        if (!userData) {
          // No current user set, but users exist - use the first one
          console.log('🔄 No current user but users exist, using first user')
          const firstUser = allUsers[0]
          
          // Set this user as current
          localStorage.setItem('naturalToSql.userId', firstUser.id)
          const setupType = firstUser.mode === 'Groq' ? 'groq' : firstUser.mode === 'Local' ? 'local' : 'basic'
          localStorage.setItem('naturalToSql.setupType', setupType)
          
          // Try to get user data again
          userData = await userService.getCurrentUser()
        }
        
        if (userData) {
          // Convert AIMode string to setup type string
          const setupType = userData.mode === 'Groq' ? 'groq' : userData.mode === 'Local' ? 'local' : 'basic'
          console.log('🔧 Setup type from user data:', setupType)
          
          // Convert ProfileDto[] to ConnectionProfile[]
          const connectionProfiles = (userData.profiles || []).map(convertProfileDtoToConnectionProfile)
          console.log('📁 Connection profiles:', connectionProfiles)
          
          setAppState(prev => ({ 
            ...prev, 
            setupType: setupType,
            user: userData,
            profiles: connectionProfiles
          }))
          
          // Set initial profile if available
          if (connectionProfiles.length > 0) {
            const savedProfileId = localStorage.getItem('naturalToSql.selectedProfile')
            const initialProfile = savedProfileId && connectionProfiles.find(p => p.id === savedProfileId) 
              ? savedProfileId 
              : connectionProfiles[0]?.id || null
            
            setAppState(prev => ({ 
              ...prev, 
              currentProfile: initialProfile
            }))
          }
        } else {
          console.log('❌ Still no user data found after attempting recovery')
          // Fallback to localStorage for setup type if no user exists
          const savedSetupType = localStorage.getItem('naturalToSql.setupType') as 'groq' | 'local' | 'basic' | null
          console.log('💾 Saved setup type from localStorage:', savedSetupType)
          if (savedSetupType) {
            console.log('✅ Using saved setup type:', savedSetupType)
            setAppState(prev => ({ ...prev, setupType: savedSetupType }))
          } else {
            // For fresh installations, set a default to allow initialization to proceed
            console.log('🆕 Fresh installation, setting default setup type: basic')
            setAppState(prev => ({ ...prev, setupType: 'basic' }))
          }
        }
      } catch (error) {
        console.error('Error loading user data:', error)
        // Also fallback to localStorage for setup type if user service fails with an error
        const savedSetupType = localStorage.getItem('naturalToSql.setupType') as 'groq' | 'local' | 'basic' | null
        console.log('💾 Error fallback - saved setup type from localStorage:', savedSetupType)
        if (savedSetupType) {
          console.log('✅ Using saved setup type after error:', savedSetupType)
          setAppState(prev => ({ ...prev, setupType: savedSetupType }))
        } else {
          // For fresh installations, set a default to allow initialization to proceed
          console.log('🆕 Error fallback - fresh installation, setting default setup type: basic')
          setAppState(prev => ({ ...prev, setupType: 'basic' }))
        }
      }
    }

    initializeUserData()
  }, [])

  // Render based on current app mode
  if (appMode === 'loading') {
    return (
      <NotificationProvider>
        <ToastProvider>
          <LoadingScreen />
          
          {/* Global Download Progress - visible even during loading */}
          <GlobalDownloadProgress
            downloads={globalDownloads}
            onCancel={async (downloadId) => {
              console.log('� CRITICAL: CANCEL HANDLER 1 TRIGGERED!!! downloadId:', downloadId)
              console.log('�📥 Cancel requested for download:', downloadId)
              console.log('🔍 Debug - isInInitialSetup:', isInInitialSetup)
              console.log('🔍 Debug - downloadId === "ollama-setup":', downloadId === 'ollama-setup')
              console.log('🔍 Debug - appState.setupType:', appState.setupType)
              console.log('🔍 🎯 HANDLER IDENTIFIER: Main Loading Screen Handler')
              
              // If cancelling Ollama setup when user is in local mode, show confirmation prompt
              if (downloadId === 'ollama-setup' && appState.setupType === 'local') {
                console.log('🚨 CONFIRMATION TRIGGER: Ollama setup cancellation detected in local mode')
                console.log('🚨 - downloadId:', downloadId)
                console.log('🚨 - appState.setupType:', appState.setupType)
                console.log('🚨 - About to show confirmation dialog...')
                
                const confirmed = window.confirm(
                  'Cancel Local LLM Installation?\n\n' +
                  'Ollama installation is required for Local mode to work. ' +
                  'If you cancel now, the app will automatically switch to Basic mode.\n\n' +
                  'You can install Ollama later from Settings → Mode to enable Local LLM.\n\n' +
                  'Are you sure you want to cancel the installation?'
                )
                
                console.log('🚨 CONFIRMATION RESULT:', confirmed ? 'USER CONFIRMED CANCELLATION' : 'USER REJECTED CANCELLATION')
                
                if (!confirmed) {
                  console.log('❌ User chose not to cancel - continuing download')
                  return // User chose not to cancel, continue the download
                }
                
                console.log('✅ User confirmed cancellation - proceeding with cancel and mode switch')
                console.log('🔄 MODE SWITCH: Starting automatic switch to Basic mode...')
                
                // Actually switch to Basic mode immediately before cancelling download
                try {
                  console.log('🔄 MODE SWITCH: Calling userService.updateUserMode("basic")...')
                  await userService.updateUserMode('basic')
                  console.log('✅ MODE SWITCH: Successfully switched to Basic mode after cancellation')
                  
                  addNotification({
                    type: 'info',
                    title: 'Switched to Basic Mode',
                    message: 'Local LLM installation cancelled. You have been switched to Basic mode. You can install Ollama later from Settings.',
                    duration: 7000
                  })
                  
                  // Update app state to reflect mode change
                  const updatedUser = await userService.getCurrentUser()
                  setAppState(prev => ({ 
                    ...prev, 
                    setupType: 'basic',
                    user: updatedUser
                  }))
                } catch (error) {
                  console.error('❌ Failed to switch to Basic mode:', error)
                  addNotification({
                    type: 'error',
                    title: 'Mode Switch Failed',
                    message: 'Could not switch to Basic mode automatically. Please check Settings → Mode after setup.',
                    duration: 7000
                  })
                }
              }
              
              // Proceed with cancellation
              console.log('📥 Cancelling download:', downloadId)
              
              // Handle cancellation based on download type
              if (downloadId === 'ollama-setup' && window.electronAPI) {
                window.electronAPI.cancelOllamaInstallation()
              }
              downloadManager.cancelDownload(downloadId)
            }}
            onDismiss={(downloadId) => {
              console.log('📥 Dismissing download:', downloadId)
              downloadManager.removeDownload(downloadId)
            }}
          />
        </ToastProvider>
      </NotificationProvider>
    )
  }

  // Show LLM initialization loading screen
  if (llmInitializing) {
    return (
      <NotificationProvider>
        <ToastProvider>
          <LoadingScreen 
            type="llm-init"
            title="Initializing Local LLM"
            subtitle="Checking and starting Ollama with qwen3:8b model"
            currentStep={llmInitStep}
            progress={llmInitProgress}
            size="fullscreen"
            animated={true}
            showProgress={true}
          />
          
          {/* Global Download Progress - visible even during LLM initialization */}
          <GlobalDownloadProgress
            downloads={globalDownloads}
            onCancel={async (downloadId) => {
              console.log('� CRITICAL: CANCEL HANDLER 2 TRIGGERED!!! downloadId:', downloadId)
              console.log('�📥 Cancelling download:', downloadId)
              console.log('🔍 Debug (Handler 2) - downloadId:', downloadId)
              console.log('🔍 Debug (Handler 2) - appState.setupType:', appState.setupType)
              
              // Show confirmation dialog if cancelling Ollama setup when user is in local mode
              if (downloadId === 'ollama-setup' && appState.setupType === 'local') {
                console.log('🚨 CONFIRMATION TRIGGER (Handler 2): Ollama setup cancellation detected in local mode')
                console.log('🚨 - downloadId:', downloadId)
                console.log('🚨 - appState.setupType:', appState.setupType)
                console.log('🚨 - About to show confirmation dialog...')
                
                const confirmed = window.confirm(
                  'Cancel Local LLM Setup?\n\n' +
                  'Ollama installation is required for Local mode to work. ' +
                  'If you cancel now, you will be automatically switched to Basic mode.\n\n' +
                  'You can install Ollama later from Settings → Mode to enable Local LLM.\n\n' +
                  'Do you want to cancel the installation and switch to Basic mode?'
                )
                
                if (!confirmed) {
                  // User chose not to cancel, don't proceed with cancellation
                  return
                }
                
                // User confirmed cancellation, actually switch to Basic mode
                try {
                  await userService.updateUserMode('basic')
                  console.log('✅ Successfully switched to Basic mode after cancellation')
                  
                  addNotification({
                    type: 'info',
                    title: 'Switched to Basic Mode',
                    message: 'Local LLM installation cancelled. You have been switched to Basic mode.',
                    duration: 7000
                  })
                  
                  // Update app state to reflect mode change
                  const updatedUser = await userService.getCurrentUser()
                  setAppState(prev => ({ 
                    ...prev, 
                    setupType: 'basic',
                    user: updatedUser
                  }))
                } catch (error) {
                  console.error('❌ Failed to switch to Basic mode:', error)
                  addNotification({
                    type: 'error',
                    title: 'Mode Switch Failed',
                    message: 'Could not switch to Basic mode automatically. Please check Settings → Mode.',
                    duration: 7000
                  })
                }
              }
              
              // Handle cancellation based on download type
              if (downloadId === 'ollama-setup' && window.electronAPI) {
                window.electronAPI.cancelOllamaInstallation()
              }
              downloadManager.cancelDownload(downloadId)
            }}
            onDismiss={(downloadId) => {
              console.log('📥 Dismissing download:', downloadId)
              downloadManager.removeDownload(downloadId)
            }}
          />
        </ToastProvider>
      </NotificationProvider>
    )
  }

  // Show initial setup screen if needed (before checking API health)
  if (appMode === 'initial-setup' || needsInitialSetup) {
    return (
      <NotificationProvider>
        <ToastProvider>
          <div className={`min-h-screen bg-background flex items-center justify-center ${appState.theme}`}>
            <InitialSetup
              onSetupCompleted={handleInitialSetupCompleted}
              onNotification={addNotification}
            />
          </div>
          
          {/* Global Download Progress - visible even during initial setup */}
          <GlobalDownloadProgress
            downloads={globalDownloads}
            onCancel={async (downloadId) => {
              console.log('� CRITICAL: CANCEL HANDLER 3 TRIGGERED!!! downloadId:', downloadId)
              console.log('�📥 Cancelling download:', downloadId)
              console.log('🔍 Debug (Handler 3 - Initial Setup) - downloadId:', downloadId)
              console.log('🔍 Debug (Handler 3 - Initial Setup) - appState.setupType:', appState.setupType)
              
              // Show confirmation dialog if cancelling Ollama setup when user is in local mode
              if (downloadId === 'ollama-setup' && appState.setupType === 'local') {
                console.log('🚨 CONFIRMATION TRIGGER (Handler 3 - Initial Setup): Ollama setup cancellation detected in local mode')
                console.log('🚨 - downloadId:', downloadId)
                console.log('🚨 - appState.setupType:', appState.setupType)
                console.log('🚨 - About to show confirmation dialog...')
                
                const confirmed = window.confirm(
                  'Cancel Local LLM Setup?\n\n' +
                  'Ollama installation is required for Local mode to work. ' +
                  'If you cancel now, you will be automatically switched to Basic mode.\n\n' +
                  'You can install Ollama later from Settings → Mode to enable Local LLM.\n\n' +
                  'Do you want to cancel the installation and switch to Basic mode?'
                )
                
                if (!confirmed) {
                  // User chose not to cancel, don't proceed with cancellation
                  return
                }
                
                // User confirmed cancellation, actually switch to Basic mode
                try {
                  await userService.updateUserMode('basic')
                  console.log('✅ Successfully switched to Basic mode after cancellation')
                  
                  addNotification({
                    type: 'info',
                    title: 'Switched to Basic Mode',
                    message: 'Local LLM installation cancelled. You have been switched to Basic mode.',
                    duration: 7000
                  })
                  
                  // Update app state to reflect mode change
                  const updatedUser = await userService.getCurrentUser()
                  setAppState(prev => ({ 
                    ...prev, 
                    setupType: 'basic',
                    user: updatedUser
                  }))
                } catch (error) {
                  console.error('❌ Failed to switch to Basic mode:', error)
                  addNotification({
                    type: 'error',
                    title: 'Mode Switch Failed',
                    message: 'Could not switch to Basic mode automatically. Please check Settings → Mode.',
                    duration: 7000
                  })
                }
              }
              
              // Handle cancellation based on download type
              if (downloadId === 'ollama-setup' && window.electronAPI) {
                window.electronAPI.cancelOllamaInstallation()
              }
              downloadManager.cancelDownload(downloadId)
            }}
            onDismiss={(downloadId) => {
              console.log('📥 Dismissing download:', downloadId)
              downloadManager.removeDownload(downloadId)
            }}
          />
        </ToastProvider>
      </NotificationProvider>
    )
  }

  // Only show API connection error if we're in a mode that requires API and it's not healthy
  // Don't show the error screen during mode switching, loading states, or any transition
  // Also wait at least 3 seconds after a mode switch before showing error
  const timeSinceLastSwitch = Date.now() - lastModeSwitchTime
  const isApiDown = healthStatus?.api?.status === 'down' || healthStatus?.api?.status === 'error'

  const shouldShowApiError = isApiDown &&
                             !modeSwitching &&
                             appMode === 'main' && // Only show error when fully in main mode
                             timeSinceLastSwitch > 3000 // Wait 3 seconds after mode switch
                             
  if (shouldShowApiError) {
    return (
      <NotificationProvider>
        <ToastProvider>
          <div className="min-h-screen bg-background flex items-center justify-center">
            <div className="text-center space-y-4">
              <h1 className="text-2xl font-bold text-destructive">API Connection Failed</h1>
              <p className="text-muted-foreground">
                Could not connect to the NaturalToSQL API service. 
                Please ensure the backend service is running.
              </p>
              <button 
                onClick={retryConnection}
                disabled={retrying}
                className="bg-primary text-primary-foreground px-4 py-2 rounded-md hover:bg-primary/90 disabled:opacity-50"
              >
                {retrying ? 'Retrying...' : 'Retry Connection'}
              </button>
            </div>
          </div>
        </ToastProvider>
      </NotificationProvider>
    )
  }

  return (
    <NotificationProvider>
      <ToastProvider>
        <div className={`min-h-screen bg-background ${appState.theme}`}>
          {appMode === 'main' && (
            <MainInterface
              appState={appState}
              onSwitchProfile={switchProfile}
              onRemoveProfile={removeProfile}
              onToggleTheme={toggleTheme}
              onNotification={addNotification}
              onBackToProfiles={handleBackToProfiles}
              onOpenHealthManager={handleOpenHealthManager}
              onChangeModeSetup={handleChangeModeSetup}
              healthStatus={healthStatus}
              needsOllamaSetup={needsOllamaSetup}
              onOllamaSetupComplete={() => setNeedsOllamaSetup(false)}
            />
          )}
          
          {/* Unified Modal */}
          <Dialog 
            open={modalContent !== null} 
            onOpenChange={(open) => !open && setModalContent(null)}
            className={modalContent === 'health-manager' ? 'max-w-5xl' : ''}
          >
            <div className="relative">
              {modalContent === 'setup-wizard' && (
                <SetupWizard 
                  onProfileCreated={handleProfileCreated}
                  onNotification={addNotification}
                  existingProfiles={appState.profiles}
                  onBackToProfiles={handleBackToProfiles}
                />
              )}
              
              {modalContent === 'profile-manager' && (
                <ProfileManager
                  onProfileSelected={handleProfileSelected}
                  onCreateNew={handleEnterSetupMode}
                  onNotification={addNotification}
                  currentProfileId={appState.currentProfile}
                  onProfilesUpdated={handleProfilesUpdated}
                />
              )}
              
              {modalContent === 'health-manager' && (
                <div className="bg-background p-6">
                  <div className="text-center mb-6">
                    <h1 className="text-2xl font-bold text-foreground mb-2">System Health Monitor</h1>
                    <p className="text-muted-foreground">Monitor API and LLM service status</p>
                  </div>
                  <HealthManager
                    onNotification={addNotification}
                    onHealthStatusUpdate={handleHealthStatusUpdate}
                    setupType={appState.setupType}
                  />
                </div>
              )}
            </div>
          </Dialog>
          
          {/* Mode Switching Loading Screen */}
          {modeSwitching && (
            <div className="fixed inset-0 z-[9999] bg-background/95 backdrop-blur-sm">
              <LoadingScreen
                type="mode-switching"
                title="Switching Mode"
                subtitle="Configuring services and establishing connections..."
                size="fullscreen"
                animated={true}
                showProgress={true}
              />
            </div>
          )}
          
          <NotificationContainer 
            notifications={notifications}
            onRemoveNotification={removeNotification}
          />
          
          {/* Global Download Progress */}
          <GlobalDownloadProgress
            downloads={globalDownloads}
            onCancel={async (downloadId) => {
              console.log('� CRITICAL: CANCEL HANDLER 4 TRIGGERED!!! downloadId:', downloadId)
              console.log('�📥 Cancelling download:', downloadId)
              console.log('🔍 Debug (Handler 4 - Main App) - downloadId:', downloadId)
              console.log('🔍 Debug (Handler 4 - Main App) - appState.setupType:', appState.setupType)
              
              // Show confirmation dialog if cancelling Ollama setup when user is in local mode
              if (downloadId === 'ollama-setup' && appState.setupType === 'local') {
                console.log('🚨 CONFIRMATION TRIGGER (Handler 4 - Main App): Ollama setup cancellation detected in local mode')
                console.log('🚨 - downloadId:', downloadId)
                console.log('🚨 - appState.setupType:', appState.setupType)
                console.log('🚨 - About to show confirmation dialog...')
                
                const confirmed = window.confirm(
                  'Cancel Local LLM Setup?\n\n' +
                  'Ollama installation is required for Local mode to work. ' +
                  'If you cancel now, you will be automatically switched to Basic mode.\n\n' +
                  'You can install Ollama later from Settings → Mode to enable Local LLM.\n\n' +
                  'Do you want to cancel the installation and switch to Basic mode?'
                )
                
                if (!confirmed) {
                  // User chose not to cancel, don't proceed with cancellation
                  return
                }
                
                // User confirmed cancellation, actually switch to Basic mode
                try {
                  await userService.updateUserMode('basic')
                  console.log('✅ Successfully switched to Basic mode after cancellation')
                  
                  addNotification({
                    type: 'info',
                    title: 'Switched to Basic Mode',
                    message: 'Local LLM installation cancelled. You have been switched to Basic mode.',
                    duration: 7000
                  })
                  
                  // Update app state to reflect mode change
                  const updatedUser = await userService.getCurrentUser()
                  setAppState(prev => ({ 
                    ...prev, 
                    setupType: 'basic',
                    user: updatedUser
                  }))
                } catch (error) {
                  console.error('❌ Failed to switch to Basic mode:', error)
                  addNotification({
                    type: 'error',
                    title: 'Mode Switch Failed',
                    message: 'Could not switch to Basic mode automatically. Please check Settings → Mode.',
                    duration: 7000
                  })
                }
              }
              
              // Handle cancellation based on download type
              if (downloadId === 'ollama-setup' && window.electronAPI) {
                window.electronAPI.cancelOllamaInstallation()
              }
              downloadManager.cancelDownload(downloadId)
            }}
            onDismiss={(downloadId) => {
              console.log('📥 Dismissing download:', downloadId)
              downloadManager.removeDownload(downloadId)
            }}
          />
        </div>
      </ToastProvider>
    </NotificationProvider>
  )
}

export default App
