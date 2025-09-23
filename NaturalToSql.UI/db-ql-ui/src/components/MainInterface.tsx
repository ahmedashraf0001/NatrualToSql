import React, { useState, useEffect, useRef, useCallback } from 'react'
import { AppState, NotificationMessage } from '@/types'
import { HealthStatus } from '@/types/health'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import QueryEditor from '@/components/QueryEditor'
import SchemaExplorer from '@/components/SchemaExplorer'
import QueryHistory from '@/components/QueryHistory'
import TitleBar from '@/components/TitleBar'
import ModernSidebar from '@/components/ModernSidebar'
import { NotificationInbox } from '@/components/shared/NotificationInbox'
import ModeChangeModal from '@/components/ModeChangeModal'
import OllamaInstallModal from '@/components/OllamaInstallModal'
import { Database, Moon, Sun, ChevronDown, Users, RefreshCw, Zap, Brain, Code2, CheckCircle } from 'lucide-react'

interface MainInterfaceProps {
  appState: AppState
  onSwitchProfile: (profileId: string) => void
  onRemoveProfile: (profileId: string) => void
  onToggleTheme: () => void
  onNotification: (notification: Omit<NotificationMessage, 'id'>) => void
  onBackToProfiles?: () => void
  onOpenHealthManager?: () => void
  onChangeModeSetup?: (mode: 'groq' | 'local' | 'basic', apiKey?: string) => Promise<void>
  healthStatus?: HealthStatus | null
  needsOllamaSetup?: boolean
  onOllamaSetupComplete?: () => void
}

const MainInterface: React.FC<MainInterfaceProps> = ({
  appState,
  onSwitchProfile,
  onRemoveProfile: _onRemoveProfile,
  onToggleTheme,
  onNotification: _onNotification,
  onBackToProfiles,
  onOpenHealthManager,
  onChangeModeSetup,
  healthStatus: propHealthStatus,
  needsOllamaSetup,
  onOllamaSetupComplete
}) => {
  const [activeTab, setActiveTab] = useState<'query' | 'schema' | 'history'>('query')
  const [showProfileDropdown, setShowProfileDropdown] = useState(false)
  const [showModeDropdown, setShowModeDropdown] = useState(false)
  const [showModeChangeModal, setShowModeChangeModal] = useState(false)
  const [targetModeForModal, setTargetModeForModal] = useState<'groq' | 'local' | 'basic' | undefined>(undefined)
  const [windowWidth, setWindowWidth] = useState(typeof window !== 'undefined' ? window.innerWidth : 1024)
  const [preloadedQuery, setPreloadedQuery] = useState<{sql: string, naturalLanguage: string, shouldExecute: boolean, isNewQuery?: boolean} | null>(null)
  
  // State preservation for QueryEditor
  const [preservedQueryEditorState, setPreservedQueryEditorState] = useState<{
    naturalLanguageInput: string
    sqlQuery: string
    queryResult?: any
    queryAnalysis?: any
    queryParameters?: any[]
  }>({
    naturalLanguageInput: '',
    sqlQuery: '',
    queryResult: undefined,
    queryAnalysis: undefined,
    queryParameters: undefined
  })

  // Handle query editor state changes
  const handleQueryEditorStateChange = useCallback((state: {
    naturalLanguageInput: string
    sqlQuery: string
    queryResult?: any
    queryAnalysis?: any
    queryParameters?: any[]
  }) => {
    setPreservedQueryEditorState(state)
  }, [])

  // Clear query editor state when mode changes
  useEffect(() => {
    console.log('Mode change detected, clearing query editor state')
    setPreservedQueryEditorState({
      naturalLanguageInput: '',
      sqlQuery: '',
      queryResult: undefined,
      queryAnalysis: undefined,
      queryParameters: undefined
    })
  }, [appState.setupType])
  const dropdownRef = useRef<HTMLDivElement>(null)
  const modeDropdownRef = useRef<HTMLDivElement>(null)

  // Ollama install modal state
  const [showOllamaModal, setShowOllamaModal] = useState(false)
  const [ollamaProgress, setOllamaProgress] = useState(0)
  const [ollamaStep, setOllamaStep] = useState('checking')
  const [ollamaMessage, setOllamaMessage] = useState('')
  const [ollamaError, setOllamaError] = useState<string | undefined>(undefined)
  const [ollamaSubProgress, setOllamaSubProgress] = useState<number | undefined>(undefined)
  const [ollamaTotalSize, setOllamaTotalSize] = useState<string | undefined>(undefined)
  const [ollamaCancellable, setOllamaCancellable] = useState(false)
  const [ollamaTimeEstimate, setOllamaTimeEstimate] = useState<string | undefined>(undefined)
  const [ollamaSpeed, setOllamaSpeed] = useState<string | undefined>(undefined)
  const [installationCancelled, setInstallationCancelled] = useState(false)
  
  // Listen for progress events from main process
  useEffect(() => {
    if (!window.electronAPI) {
      console.log('🚫 No electronAPI available for progress events');
      return;
    }
    
    const handler = (data: any) => {
      console.log('🎯 RECEIVED PROGRESS EVENT IN RENDERER:', JSON.stringify(data, null, 2));
      console.log('📊 Received progress event:', {
        step: data.step,
        progress: data.progress,
        subProgress: data.subProgress,
        message: data.message,
        timestamp: new Date().toISOString()
      });
      
      // Check current state using useRef pattern to avoid stale closure
      setInstallationCancelled(currentCancelled => {
        console.log('🔍 Current cancellation state:', currentCancelled);
        if (currentCancelled) {
          console.log('🚫 Ignoring progress event after cancellation:', data);
          return currentCancelled;
        }
        
        // Always update UI state regardless of modal visibility
        // The modal will show the latest state when it opens
        console.log('🔄 Updating UI state with progress data');
        setOllamaStep(data.step);
        setOllamaMessage(data.message);
        setOllamaProgress(data.progress);
        setOllamaSubProgress(data.subProgress);
        setOllamaTotalSize(data.totalSize);
        setOllamaCancellable(data.cancellable || false);
        setOllamaTimeEstimate(data.timeEstimate);
        setOllamaSpeed(data.downloadSpeed);
        if (data.error) setOllamaError(data.message || 'Unknown error');
        
        // Auto-show modal if it's not already shown and we have meaningful progress
        setShowOllamaModal(currentModalState => {
          console.log('🔍 Current modal state:', currentModalState, 'Should auto-show?', !currentModalState && data.step && data.step !== 'complete');
          if (!currentModalState && data.step && data.step !== 'complete') {
            console.log('🔄 Auto-showing modal due to progress event');
            return true;
          }
          return currentModalState;
        });
        
        return currentCancelled;
      });
    };
    
    console.log('📡 Setting up ollama-install-progress event listener');
    window.electronAPI.on('ollama-install-progress', handler);
    
    return () => {
      console.log('🧹 Cleaning up ollama-install-progress event listener');
      window.electronAPI?.removeListener('ollama-install-progress', handler);
    };
  }, []); // Remove dependencies to prevent recreation

  const currentProfile = appState.profiles.find(p => p.id === appState.currentProfile)

  // Handle window resize to prevent overflow issues
  useEffect(() => {
    const handleResize = () => {
      setWindowWidth(window.innerWidth)
    }

    window.addEventListener('resize', handleResize)
    return () => window.removeEventListener('resize', handleResize)
  }, [])

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setShowProfileDropdown(false)
      }
      if (modeDropdownRef.current && !modeDropdownRef.current.contains(event.target as Node)) {
        setShowModeDropdown(false)
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [])

  // Auto-show Ollama setup modal when needed
  useEffect(() => {
    if (needsOllamaSetup && !showOllamaModal) {
      console.log('🦙 Auto-showing Ollama setup modal in main interface')
      setInstallationCancelled(false) // Reset cancellation flag
      setShowOllamaModal(true)
      setOllamaProgress(5)
      setOllamaStep('checking')
      setOllamaMessage('🔍 Checking Ollama status...')
      setOllamaError(undefined)
      setOllamaCancellable(false)
      
      // Start the installation process
      startOllamaInstallation()
    }
  }, [needsOllamaSetup, showOllamaModal])

  // Function to start Ollama installation
  const startOllamaInstallation = async () => {
    try {
      if (!window.electronAPI) {
        throw new Error('Electron API not available');
      }

      // Check for cancellation before starting
      if (installationCancelled) {
        console.log('🚫 Installation cancelled before starting')
        return;
      }

      console.log('🦙 Starting automatic Ollama installation from main interface...')
      
      // Check Ollama status
      setOllamaStep('checking')
      setOllamaMessage('🔍 Checking Ollama status...')
      setOllamaProgress(20)
      
      const timeoutPromise = new Promise((_, reject) =>
        setTimeout(() => reject(new Error('Operation timed out after 30 seconds')), 30000)
      );
      
      const status = await Promise.race([
        window.electronAPI.checkOllamaStatus(),
        timeoutPromise
      ]) as any;
      console.log('Ollama status:', status)
      setOllamaProgress(40)
      
      if (!status.ollamaInstalled || !status.modelInstalled) {
        // Check for cancellation before starting installation
        if (installationCancelled) {
          console.log('🚫 Installation cancelled before Ollama setup')
          return;
        }
        
        console.log('Starting Ollama installation...')
        setOllamaStep('starting')
        setOllamaMessage('Installing Ollama and model...')
        setOllamaProgress(50)
        
        // Start installation
        console.log('🚀 Calling installOllamaSetup from MainInterface...')
        const result = await window.electronAPI.installOllamaSetup();
        console.log('📋 Installation result:', result)
        
        if (!result.success) {
          console.error('❌ Installation failed:', result.error)
          setOllamaError(result.error || 'Installation failed');
          return;
        }
        
        // Installation successful, now start the model
        console.log('✅ Installation successful, starting model...')
        
        // Check for cancellation before starting model
        if (installationCancelled) {
          console.log('🚫 Installation cancelled before model start')
          return;
        }
        
        setOllamaStep('starting')
        setOllamaMessage('Starting qwen3:8b model...')
        setOllamaProgress(90)
        
        const startResult = await window.electronAPI.startOllamaModel();
        console.log('Start model result:', startResult)
        
        if (startResult.success) {
          setOllamaProgress(100)
          setOllamaStep('complete')
          setOllamaMessage('Setup completed successfully!')
          await new Promise(resolve => setTimeout(resolve, 1000))
        } else {
          console.warn('Model start had issues but continuing:', startResult.error)
          setOllamaProgress(100)
          setOllamaStep('complete')
          setOllamaMessage('Installation completed, model may still be loading')
          await new Promise(resolve => setTimeout(resolve, 1000))
        }
      } else if (!status.modelRunning) {
        // Check for cancellation before starting model
        if (installationCancelled) {
          console.log('🚫 Installation cancelled before model start')
          return;
        }
        
        console.log('Model installed but not running, starting...')
        setOllamaStep('starting')
        setOllamaMessage('Starting qwen3:8b model...')
        setOllamaProgress(70)
        
        const startResult = await window.electronAPI.startOllamaModel();
        console.log('Start model result:', startResult)
        
        if (startResult.success) {
          setOllamaProgress(100)
          setOllamaStep('complete')
          setOllamaMessage('Model started successfully!')
          await new Promise(resolve => setTimeout(resolve, 1000))
        } else {
          console.warn('Model start had issues but continuing:', startResult.error)
          setOllamaProgress(100)
          setOllamaStep('complete')
          setOllamaMessage('Model start initiated (may still be loading)')
          await new Promise(resolve => setTimeout(resolve, 1000))
        }
      } else {
        console.log('Model already running, proceeding...')
        setOllamaStep('complete')
        setOllamaMessage('Ollama is ready!')
        setOllamaProgress(100)
        await new Promise(resolve => setTimeout(resolve, 500))
      }
      
      console.log('🦙 Setup completed, closing modal...')
      setShowOllamaModal(false);
      
      // Mark setup as complete
      if (onOllamaSetupComplete) {
        onOllamaSetupComplete();
      }
      
      // Switch to local mode
      if (onChangeModeSetup) {
        await onChangeModeSetup('local');
      }
    } catch (error) {
      console.error('Error in automatic Ollama setup:', error)
      
      // Check if the error is due to cancellation
      const errorMessage = error instanceof Error ? error.message : 'Unknown error'
      if (errorMessage.includes('cancelled') || installationCancelled) {
        console.log('🚫 Installation was cancelled, not showing error')
        // Don't show error for cancellation, just close the modal
        setShowOllamaModal(false);
        if (onOllamaSetupComplete) {
          onOllamaSetupComplete();
        }
        return;
      }
      
      // Only show error for actual failures, not cancellations
      setOllamaError(`Setup failed: ${errorMessage}`)
    }
  }

  // Determine if we should show sidebar based on window width
  // On very small screens (< 768px), hide sidebar completely and use mobile navigation
  // On medium+ screens (>= 768px), show sidebar (collapsed on medium, full on large)
  const showSidebar = windowWidth >= 768 // md breakpoint - show sidebar

  return (
    <div className="min-h-screen bg-background flex flex-col" style={{ height: '100vh' }}>
      {/* Custom Title Bar */}
      <TitleBar />
      
      {/* Header */}
      <header className="border-b bg-card">
        <div className="flex items-center justify-between px-6 py-3">
          <div className="flex items-center space-x-4">
            {/* App Title */}
            <div className="flex items-center space-x-3">
              <Database className="w-6 h-6 text-primary" />
              <div>
                <h1 className="text-xl font-bold text-foreground">NaturalToSQL</h1>
                <p className="text-xs text-muted-foreground">Convert natural language to SQL queries</p>
              </div>
            </div>
            
            {/* Current Profile Info */}
            {currentProfile && (
              <div className="flex items-center space-x-2 text-sm text-muted-foreground border-l pl-4 ml-4">
                <Database className="w-4 h-4" />
                <span>{currentProfile.databaseName}</span>
                <span className="text-xs opacity-60">•</span>
                <span className="text-xs">{currentProfile.serverName}</span>
              </div>
            )}
          </div>

          <div className="flex items-center space-x-2">
            {/* Navigation tabs when sidebar is hidden */}
            {!showSidebar && currentProfile && (
              <div className="flex items-center space-x-1 mr-4">
                <Button
                  variant={activeTab === 'query' ? 'default' : 'ghost'}
                  size="sm"
                  onClick={() => setActiveTab('query')}
                >
                  Query
                </Button>
                <Button
                  variant={activeTab === 'schema' ? 'default' : 'ghost'}
                  size="sm"
                  onClick={() => setActiveTab('schema')}
                >
                  Schema
                </Button>
                <Button
                  variant={activeTab === 'history' ? 'default' : 'ghost'}
                  size="sm"
                  onClick={() => setActiveTab('history')}
                >
                  History
                </Button>
              </div>
            )}

            {/* Manage Profiles Button - Always show to allow creating new profiles */}
            {onBackToProfiles && (
              <Button
                variant="outline"
                size="sm"
                onClick={onBackToProfiles}
              >
                <Users className="w-4 h-4 mr-2" />
                {appState.profiles.length <= 1 ? 'Add Profile' : `Manage Profiles (${appState.profiles.length})`}
              </Button>
            )}

            {/* Profile Dropdown */}
            {appState.profiles.length > 0 && (
              <div className="relative" ref={dropdownRef}>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setShowProfileDropdown(!showProfileDropdown)}
                  className="min-w-[200px] justify-between"
                >
                  <div className="flex items-center space-x-2">
                    <Database className="w-4 h-4" />
                    <span>{currentProfile?.databaseName || 'Select Profile'}</span>
                  </div>
                  <ChevronDown className="w-4 h-4" />
                </Button>
                
                {showProfileDropdown && (
                  <div className="absolute top-full left-0 mt-1 w-full bg-popover border rounded-md shadow-lg z-50">
                    <div className="p-1">
                      {appState.profiles.map((profile) => (
                        <button
                          key={profile.id}
                          className={`w-full px-3 py-2 text-left text-sm rounded-sm hover:bg-accent hover:text-accent-foreground flex items-center space-x-2 ${
                            profile.id === appState.currentProfile ? 'bg-accent text-accent-foreground' : ''
                          }`}
                          onClick={() => {
                            onSwitchProfile(profile.id)
                            setShowProfileDropdown(false)
                          }}
                        >
                          <Database className="w-4 h-4" />
                          <div>
                            <div className="font-medium">{profile.databaseName}</div>
                            <div className="text-xs text-muted-foreground">{profile.serverName}</div>
                          </div>
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Mode Switching Button */}
            <div className="relative" ref={modeDropdownRef}>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowModeDropdown(!showModeDropdown)}
                className="flex items-center space-x-2"
                title="Change AI/LLM Mode"
              >
                {appState.setupType === 'groq' && (
                  <>
                    <Zap className="w-4 h-4" />
                    <span className="hidden sm:inline">Groq AI</span>
                  </>
                )}
                {appState.setupType === 'local' && (
                  <>
                    <Brain className="w-4 h-4" />
                    <span className="hidden sm:inline">Local LLM</span>
                  </>
                )}
                {appState.setupType === 'basic' && (
                  <>
                    <Code2 className="w-4 h-4" />
                    <span className="hidden sm:inline">Basic Mode</span>
                  </>
                )}
                <ChevronDown className="w-3 h-3" />
              </Button>
              
              {showModeDropdown && (
                <div className="absolute top-full right-0 mt-1 w-56 bg-popover border rounded-md shadow-lg z-50">
                  <div className="p-1">
                    <button
                      className={`w-full px-3 py-2 text-left text-sm rounded-sm hover:bg-accent hover:text-accent-foreground flex items-center space-x-3 ${
                        appState.setupType === 'groq' ? 'bg-accent text-accent-foreground' : ''
                      }`}
                      onClick={async () => {
                        console.log('Groq dropdown clicked, current setupType:', appState.setupType, 'Is groq:', appState.setupType === 'groq')
                        setShowModeDropdown(false)
                        if (appState.setupType === 'groq') {
                          console.log('Already in Groq mode, returning early')
                          return // Already in this mode
                        }
                        
                        // Check if API key is already configured
                        const hasApiKey = appState.user?.apiKey && appState.user.apiKey.trim() !== ''
                        console.log('Has API key configured:', hasApiKey, 'API key:', appState.user?.apiKey ? `${appState.user.apiKey.substring(0, 8)}...` : 'none')
                        
                        if (hasApiKey && appState.user) {
                          // API key is configured, switch directly
                          console.log('API key exists, switching directly to Groq mode')
                          if (onChangeModeSetup) {
                            await onChangeModeSetup('groq', appState.user.apiKey)
                          }
                        } else {
                          // No API key configured, open modal for configuration
                          console.log('No API key configured, opening modal')
                          setTargetModeForModal('groq') // Pre-select Groq mode
                          setShowModeChangeModal(true)
                        }
                      }}
                    >
                      <Zap className="w-4 h-4 text-orange-500" />
                      <div>
                        <div className="font-medium">Groq AI</div>
                        <div className="text-xs text-muted-foreground">Fast cloud-based AI</div>
                      </div>
                      {appState.setupType === 'groq' && (
                        <div className="ml-auto">
                          <CheckCircle className="w-4 h-4 text-green-500" />
                        </div>
                      )}
                    </button>
                    
                    <button
                      className={`w-full px-3 py-2 text-left text-sm rounded-sm hover:bg-accent hover:text-accent-foreground flex items-center space-x-3 ${
                        appState.setupType === 'local' ? 'bg-accent text-accent-foreground' : ''
                      }`}
                      onClick={async () => {
                        setShowModeDropdown(false)
                        if (appState.setupType === 'local') return // Already in this mode
                        
                        // Reset cancellation flag for manual mode switch
                        setInstallationCancelled(false)
                        
                        // Show the progress modal immediately
                        setShowOllamaModal(true)
                        setOllamaProgress(5)
                        setOllamaStep('checking')
                        setOllamaMessage('Checking Ollama status...')
                        setOllamaError(undefined)
                        
                        try {
                          if (!window.electronAPI) {
                            console.error('window.electronAPI is not available')
                            setOllamaError('Electron API not available')
                            return;
                          }
                          
                          if (!window.electronAPI.checkOllamaStatus) {
                            console.error('checkOllamaStatus method not available')
                            console.log('Available methods:', Object.keys(window.electronAPI))
                            setOllamaError('Ollama status check not available. Please restart the app.')
                            return;
                          }
                          
                          console.log('Checking Ollama status...')
                          setOllamaProgress(20)
                          
                          // Add timeout to prevent hanging
                          const timeoutPromise = new Promise((_, reject) => 
                            setTimeout(() => reject(new Error('Operation timed out after 30 seconds')), 30000)
                          );
                          
                          const status = await Promise.race([
                            window.electronAPI.checkOllamaStatus(),
                            timeoutPromise
                          ]) as any;
                          console.log('Ollama status:', status)
                          setOllamaProgress(40)
                          
                          if (!status.ollamaInstalled || !status.modelInstalled) {
                            console.log('Starting Ollama installation...')
                            setOllamaStep('starting')
                            setOllamaMessage('Installing Ollama and model...')
                            setOllamaProgress(50)
                            
                            // Start installation
                            console.log('🚀 Calling installOllamaSetup from MainInterface...')
                            const result = await window.electronAPI.installOllamaSetup();
                            console.log('📋 Installation result:', result)
                            
                            if (!result.success) {
                              console.error('❌ Installation failed:', result.error)
                              setOllamaError(result.error || 'Installation failed');
                              return;
                            }
                            
                            // Installation successful, now start the model
                            console.log('✅ Installation successful, starting model...')
                            setOllamaStep('starting')
                            setOllamaMessage('Starting qwen3:8b model...')
                            setOllamaProgress(90)
                            
                            const startResult = await window.electronAPI.startOllamaModel();
                            console.log('Start model result:', startResult)
                            
                            if (startResult.success) {
                              setOllamaProgress(100)
                              setOllamaStep('complete')
                              setOllamaMessage('Setup completed successfully!')
                              await new Promise(resolve => setTimeout(resolve, 1000))
                            } else {
                              console.warn('Model start had issues but continuing:', startResult.error)
                              setOllamaProgress(100)
                              setOllamaStep('complete')
                              setOllamaMessage('Installation completed, model may still be loading')
                              await new Promise(resolve => setTimeout(resolve, 1000))
                            }
                          } else if (!status.modelRunning) {
                            console.log('Model installed but not running, starting...')
                            setOllamaStep('starting')
                            setOllamaMessage('Starting qwen3:8b model...')
                            setOllamaProgress(70)
                            
                            const startResult = await window.electronAPI.startOllamaModel();
                            console.log('Start model result:', startResult)
                            
                            if (startResult.success) {
                              setOllamaProgress(100)
                              setOllamaStep('complete')
                              setOllamaMessage('Model started successfully!')
                              await new Promise(resolve => setTimeout(resolve, 1000))
                            } else {
                              console.warn('Model start had issues but continuing:', startResult.error)
                              setOllamaProgress(100)
                              setOllamaStep('complete')
                              setOllamaMessage('Model start initiated (may still be loading)')
                              await new Promise(resolve => setTimeout(resolve, 1000))
                            }
                          } else {
                            console.log('Model already running, proceeding...')
                            setOllamaStep('complete')
                            setOllamaMessage('Ollama is ready!')
                            setOllamaProgress(100)
                            await new Promise(resolve => setTimeout(resolve, 500))
                          }
                          
                          console.log('Closing modal and switching mode...')
                          setShowOllamaModal(false);
                          if (onChangeModeSetup) {
                            await onChangeModeSetup('local');
                          }
                        } catch (error) {
                          console.error('Error in local mode setup:', error)
                          setOllamaError(`Setup failed: ${error instanceof Error ? error.message : 'Unknown error'}`)
                        }
                      }}
                    >
                      <Brain className="w-4 h-4 text-blue-500" />
                      <div>
                        <div className="font-medium">Local LLM</div>
                        <div className="text-xs text-muted-foreground">Self-hosted model</div>
                      </div>
                      {appState.setupType === 'local' && (
                        <div className="ml-auto">
                          <CheckCircle className="w-4 h-4 text-green-500" />
                        </div>
                      )}
                    </button>
                    
                    <button
                      className={`w-full px-3 py-2 text-left text-sm rounded-sm hover:bg-accent hover:text-accent-foreground flex items-center space-x-3 ${
                        appState.setupType === 'basic' ? 'bg-accent text-accent-foreground' : ''
                      }`}
                      onClick={async () => {
                        setShowModeDropdown(false)
                        if (appState.setupType === 'basic') return // Already in this mode
                        if (onChangeModeSetup) {
                          await onChangeModeSetup('basic')
                        }
                      }}
                    >
                      <Code2 className="w-4 h-4 text-green-500" />
                      <div>
                        <div className="font-medium">Basic Mode</div>
                        <div className="text-xs text-muted-foreground">SQL editor only</div>
                      </div>
                      {appState.setupType === 'basic' && (
                        <div className="ml-auto">
                          <CheckCircle className="w-4 h-4 text-green-500" />
                        </div>
                      )}
                    </button>
                    
                    {/* Settings button for the current mode */}
                    <div className="border-t my-1"></div>
 
                  </div>
                </div>
              )}
            </div>

            <Button
              variant="ghost"
              size="icon"
              onClick={onToggleTheme}
            >
              {appState.theme === 'light' ? (
                <Moon className="w-4 h-4" />
              ) : (
                <Sun className="w-4 h-4" />
              )}
            </Button>

            <NotificationInbox />

            <Button
              variant="ghost"
              size="icon"
              onClick={() => window.location.reload()}
              title="Reload App"
            >
              <RefreshCw className="w-4 h-4" />
            </Button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <div className="flex flex-1 min-h-0">
        {/* Modern Sidebar - Show on medium screens and up, collapsed on medium, full on large */}
        {showSidebar && (
          <ModernSidebar
            currentProfile={currentProfile || null}
            profiles={appState.profiles}
            onSwitchProfile={onSwitchProfile}
            onCreateProfile={onBackToProfiles || (() => {})}
            onViewHistory={() => setActiveTab('history')}
            onViewSchema={() => setActiveTab('schema')}
            onExecuteQuery={(query) => {
              // Switch to query tab and populate natural language query
              setActiveTab('query')
              setPreloadedQuery({
                sql: '',
                naturalLanguage: query,
                shouldExecute: false
              });
            }}
            activeTab={activeTab}
            setActiveTab={(tab) => {
              if (tab === 'query' || tab === 'schema' || tab === 'history') {
                setActiveTab(tab)
              }
            }}
            onOpenHealthManager={onOpenHealthManager}
            healthStatus={propHealthStatus}
            setupType={appState.setupType}
            forceCollapsed={windowWidth < 1024} // Force collapsed on medium screens
            windowWidth={windowWidth}
          />
        )}

        {/* Main Panel */}
        <main className="flex-1 min-w-0 p-6 overflow-auto scrollbar-hide">
          {/* Show responsive message when sidebar is hidden on very small screens */}
          {!showSidebar && !currentProfile && (
            <div className="mb-4 p-3 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg">
              <p className="text-sm text-blue-700 dark:text-blue-300">
                💡 <strong>Small screen detected:</strong> Navigation moved to header. Increase window width to see the sidebar.
              </p>
            </div>
          )}
          
          {!currentProfile ? (
            <div className="flex items-center justify-center h-full">
              <Card className="w-96">
                <CardHeader>
                  <CardTitle>
                    {appState.profiles.length === 0 ? 'No Profiles Found' : 'No Profile Selected'}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-muted-foreground mb-4">
                    {appState.profiles.length === 0 
                      ? 'Get started by creating your first database profile to connect to your database.'
                      : 'Please select a database profile from the sidebar to get started.'
                    }
                  </p>
                  {onBackToProfiles && (
                    <Button onClick={onBackToProfiles} className="w-full">
                      {appState.profiles.length === 0 ? 'Create First Profile' : 'View All Profiles'}
                    </Button>
                  )}
                </CardContent>
              </Card>
            </div>
          ) : (
            <div className="h-full flex flex-col min-h-0">
              {/* Tab Content */}
              {activeTab === 'query' && (
                <QueryEditor 
                  currentProfile={currentProfile}
                  theme={appState.theme}
                  setupType={appState.setupType}
                  preloadedQuery={preloadedQuery}
                  onQueryLoaded={() => setPreloadedQuery(null)}
                  healthStatus={propHealthStatus}
                  preservedState={preservedQueryEditorState}
                  onStateChange={handleQueryEditorStateChange}
                />
              )}

              {activeTab === 'schema' && (
                <SchemaExplorer profileId={currentProfile?.id || null} />
              )}

              {activeTab === 'history' && (
                <QueryHistory 
                  profileId={currentProfile?.id || null}
                  onLoadQuery={(sql, naturalLanguage) => {
                    setPreloadedQuery({ sql, naturalLanguage, shouldExecute: false })
                    setActiveTab('query')
                  }}
                  onRunQuery={(sql, naturalLanguage) => {
                    setPreloadedQuery({ sql, naturalLanguage, shouldExecute: true })
                    setActiveTab('query')
                  }}
                />
              )}
            </div>
          )}
        </main>
      </div>

      {/* Mode Change Modal */}
      <ModeChangeModal
        isOpen={showModeChangeModal}
        currentMode={appState.setupType || 'basic'}
        targetMode={targetModeForModal}
        onClose={() => {
          setTargetModeForModal(undefined)
          setShowModeChangeModal(false)
        }}
        onModeChanged={async (mode, apiKey) => {
          if (onChangeModeSetup) {
            await onChangeModeSetup(mode, apiKey)
          }
        }}
        onNotification={_onNotification}
      />

      {/* Ollama Install Modal */}
      <OllamaInstallModal
        isOpen={showOllamaModal}
        progress={ollamaProgress}
        step={ollamaStep}
        message={ollamaMessage}
        error={ollamaError}
        subProgress={ollamaSubProgress}
        totalSize={ollamaTotalSize}
        cancellable={ollamaCancellable}
        timeEstimate={ollamaTimeEstimate}
        downloadSpeed={ollamaSpeed}
        onCancel={async () => {
          console.log('🚫 OllamaInstallModal cancel button clicked')
          console.log('🔍 Current appState.setupType:', appState.setupType)
          console.log('🔍 onChangeModeSetup available:', !!onChangeModeSetup)
          
          // Show confirmation dialog if user is in local mode setup
          if (appState.setupType === 'local') {
            console.log('🚫 User is in local mode - showing confirmation dialog')
            const confirmed = window.confirm(
              'Cancel Local LLM Setup?\n\n' +
              'Ollama installation is required for Local mode to work. ' +
              'If you cancel now, you will be automatically switched to Basic mode.\n\n' +
              'You can install Ollama later from Settings → Mode to enable Local LLM.\n\n' +
              'Do you want to cancel the installation and switch to Basic mode?'
            )
            
            console.log('🚫 User confirmation result:', confirmed)
            
            if (!confirmed) {
              // User chose not to cancel, don't proceed with cancellation
              console.log('🚫 User chose not to cancel after confirmation - aborting cancellation')
              return
            }
            
            // User confirmed cancellation, switch to Basic mode
            if (onChangeModeSetup) {
              try {
                console.log('🔄 Switching to Basic mode after cancellation confirmation')
                await onChangeModeSetup('basic')
                console.log('✅ Successfully switched to Basic mode after cancellation')
              } catch (error) {
                console.error('❌ Failed to switch to Basic mode:', error)
              }
            }
          } else {
            console.log('🚫 User is not in local mode (setupType:', appState.setupType, ') - skipping confirmation')
          }
          
          setInstallationCancelled(true)
          
          // Actually cancel the download via electron API
          if (window.electronAPI?.cancelOllamaInstallation) {
            try {
              console.log('🚫 Calling electron cancelOllamaInstallation API')
              await window.electronAPI.cancelOllamaInstallation()
              console.log('🚫 Electron cancellation completed from modal cancel button')
            } catch (error) {
              console.error('Failed to cancel via electron API from modal cancel:', error)
            }
          } else {
            console.warn('🚫 cancelOllamaInstallation API not available')
          }
        }}
        onClose={async () => {
          console.log('🦙 User closed/cancelled Ollama setup modal')
          
          // Set cancellation flag to ignore further progress events
          setInstallationCancelled(true)
          
          // If installation is still running, make sure to cancel it
          if (ollamaCancellable && ollamaStep !== 'complete' && !ollamaError) {
            console.log('🚫 Modal closed during installation - ensuring cancellation...')
            try {
              if (window.electronAPI?.cancelOllamaInstallation) {
                await window.electronAPI.cancelOllamaInstallation();
                console.log('🚫 Background installation cancelled successfully')
              }
            } catch (error) {
              console.error('Failed to cancel background installation:', error);
            }
          }
          
          setShowOllamaModal(false)
          
          // Mark setup as complete even if cancelled, so we don't show it again
          if (onOllamaSetupComplete) {
            onOllamaSetupComplete();
          }
        }}
      />
    </div>
  )
}

export default MainInterface
