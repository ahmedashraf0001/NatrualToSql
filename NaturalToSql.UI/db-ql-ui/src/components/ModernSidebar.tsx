import React, { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import { 
  Sidebar, 
  SidebarBody, 
  SidebarSection
} from '@/components/ui/modern-sidebar'
import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { ScrollArea } from '@/components/ui/scroll-area'
import { 
  Database, 
  Activity, 
  Clock, 
  Zap,
  Table,
  Eye,
  Wifi,
  WifiOff,
  Plus,
  Loader2,
  Star,
  X,
  ChevronRight,
  CircleDot,
  Shield,
  RefreshCw
} from 'lucide-react'
import { ConnectionProfile } from '@/types'
import { HealthStatus } from '@/types/health'
import { apiService } from '@/services/api'
import { cn } from '@/lib/utils'

interface ModernSidebarProps {
  currentProfile: ConnectionProfile | null
  profiles: ConnectionProfile[]
  onSwitchProfile: (profileId: string) => void
  onCreateProfile: () => void
  onViewHistory: () => void
  onViewSchema: () => void
  onExecuteQuery?: (query: string) => void
  activeTab?: string
  setActiveTab?: (tab: string) => void
  onOpenHealthManager?: () => void
  healthStatus?: HealthStatus | null
  setupType?: 'groq' | 'local' | 'basic' | null
  forceCollapsed?: boolean // Force sidebar to be collapsed (for responsive design)
  windowWidth?: number // Current window width for responsive adjustments
}

const ModernSidebar: React.FC<ModernSidebarProps> = ({
  currentProfile,
  profiles,
  onSwitchProfile,
  onCreateProfile,
  onViewHistory,
  onViewSchema,
  onExecuteQuery,
  activeTab,
  setActiveTab,
  onOpenHealthManager,
  healthStatus,
  setupType,
  forceCollapsed = false,
  windowWidth = 1024
}) => {
  // Determine initial state based on responsive requirements
  const initialOpen = !forceCollapsed && windowWidth >= 1024
  const [open, setOpen] = useState(initialOpen) // Start based on screen size
  const [connectionStatus, setConnectionStatus] = useState<'connected' | 'disconnected' | 'checking'>('checking')
  const [showCreateDialog, setShowCreateDialog] = useState(false)
  const [newQueryText, setNewQueryText] = useState('')
  const [customQueries, setCustomQueries] = useState<string[]>([]) // Store user's custom queries

  // Load custom queries from localStorage on mount
  useEffect(() => {
    const saved = localStorage.getItem('customQueries')
    if (saved) {
      try {
        setCustomQueries(JSON.parse(saved))
      } catch (error) {
        console.error('Failed to load custom queries:', error)
      }
    }
  }, [])

  // Handle responsive behavior - force collapsed state on smaller screens
  useEffect(() => {
    if (forceCollapsed && open) {
      setOpen(false)
    }
  }, [forceCollapsed, open])

  // Save custom query
  const handleSaveCustomQuery = () => {
    if (newQueryText.trim()) {
      const updatedQueries = [...customQueries, newQueryText.trim()]
      setCustomQueries(updatedQueries)
      // Save to localStorage
      localStorage.setItem('customQueries', JSON.stringify(updatedQueries))
      setNewQueryText('')
      setShowCreateDialog(false)
    }
  }

  // Cancel/exit dialog
  const handleCancelDialog = () => {
    setNewQueryText('')
    setShowCreateDialog(false)
  }

  // Remove custom query
  const handleRemoveCustomQuery = (index: number) => {
    const updatedQueries = customQueries.filter((_, i) => i !== index)
    setCustomQueries(updatedQueries)
    localStorage.setItem('customQueries', JSON.stringify(updatedQueries))
  }
  const [isRefreshing, setIsRefreshing] = useState(false)
  const [dbStats, setDbStats] = useState({
    tables: 0,
    views: 0,
    procedures: 0,
    functions: 0
  })

  // Load schema data
  useEffect(() => {
    if (currentProfile) {
      loadDatabaseInfo()
      checkConnectionHealth()
    }
  }, [currentProfile])

  const loadDatabaseInfo = async () => {
    if (!currentProfile) return
    
    try {
      const schemaData = await apiService.getSchema(currentProfile.id)
      
      // Calculate database statistics
      const stats = {
        tables: schemaData.tables?.filter(t => !t.name.startsWith('v_')).length || 0,
        views: schemaData.tables?.filter(t => t.name.startsWith('v_')).length || 0,
        procedures: 0, // Would need additional API endpoint
        functions: 0   // Would need additional API endpoint
      }
      setDbStats(stats)
    } catch (error) {
      console.error('Failed to load schema:', error)
    }
  }

  const refreshData = async () => {
    if (!currentProfile || isRefreshing) return
    
    setIsRefreshing(true)
    try {
      await Promise.all([
        loadDatabaseInfo(),
        checkConnectionHealth()
      ])
    } finally {
      setIsRefreshing(false)
    }
  }

  const checkConnectionHealth = async () => {
    if (!currentProfile) return
    
    setConnectionStatus('checking')
    try {
      // Test connection using the profile
      // This is a simplified check - would need proper health endpoint
      await apiService.getSchema(currentProfile.id)
      setConnectionStatus('connected')
    } catch (error) {
      setConnectionStatus('disconnected')
    }
  }

  const getConnectionStatusIcon = () => {
    switch (connectionStatus) {
      case 'connected':
        return <Wifi className="w-4 h-4 text-green-500" />
      case 'disconnected':
        return <WifiOff className="w-4 h-4 text-red-500" />
      case 'checking':
        return <CircleDot className="w-4 h-4 text-yellow-500 animate-pulse" />
    }
  }

  const getConnectionStatusText = () => {
    switch (connectionStatus) {
      case 'connected':
        return 'Connected'
      case 'disconnected':
        return 'Disconnected'
      case 'checking':
        return 'Checking...'
    }
  }

  // Helper functions for system health status
  const getSystemHealthStatus = () => {
    if (!healthStatus) return 'checking'
    
    const { api, llm } = healthStatus
    
    // In basic mode, only consider API health
    if (setupType === 'basic') {
      if (api.status === 'loading') return 'loading'
      if (api.status === 'healthy') return 'healthy'
      if (api.status === 'down') return 'issues'
      if (api.status === 'degraded') return 'degraded'
      return 'checking'
    }
    
    // For local/groq modes, consider both API and LLM
    // If either component is loading, or LLM is initializing, system is loading
    if (api.status === 'loading' || llm.status === 'loading' || llm.status === 'initializing') {
      return 'loading'
    }
    
    // If both are healthy, system is healthy
    if (api.status === 'healthy' && llm.status === 'healthy') {
      return 'healthy'
    }
    
    // If either is down/error, system has issues
    if (api.status === 'down' || llm.status === 'error') {
      return 'issues'
    }
    
    // If rate limited or degraded, system is degraded
    if (api.status === 'degraded' || llm.status === 'rate_limited') {
      return 'degraded'
    }
    
    return 'checking'
  }

  const getSystemHealthText = () => {
    const status = getSystemHealthStatus()
    
    // Different messages for basic mode vs local/groq modes
    if (setupType === 'basic') {
      switch (status) {
        case 'healthy':
          return 'API Healthy'
        case 'issues':
          return 'API Issues'
        case 'degraded':
          return 'API Degraded'
        case 'loading':
          return 'API Loading...'
        case 'checking':
        default:
          return 'Checking API...'
      }
    }
    
    // For local/groq modes
    switch (status) {
      case 'healthy':
        return 'All Systems Healthy'
      case 'issues':
        return 'Service Issues'
      case 'degraded':
        return 'Rate Limited'
      case 'loading':
        return 'Switching Modes...'
      case 'checking':
      default:
        return 'Checking Status...'
    }
  }

  const getSystemHealthIcon = () => {
    const status = getSystemHealthStatus()
    switch (status) {
      case 'healthy':
        return <Activity className="w-4 h-4 text-green-500" />
      case 'issues':
        return <WifiOff className="w-4 h-4 text-red-500" />
      case 'degraded':
        return <Zap className="w-4 h-4 text-yellow-500" />
      case 'loading':
        return <Loader2 className="w-4 h-4 text-purple-500 animate-spin" />
      case 'checking':
      default:
        return <CircleDot className="w-4 h-4 text-gray-500 animate-pulse" />
    }
  }

  const getSystemHealthBadgeVariant = () => {
    const status = getSystemHealthStatus()
    switch (status) {
      case 'healthy':
        return 'default' as const
      case 'issues':
        return 'destructive' as const
      case 'degraded':
        return 'secondary' as const
      case 'loading':
        return 'secondary' as const
      case 'checking':
      default:
        return 'outline' as const
    }
  }

  const getSystemHealthBarColor = () => {
    const status = getSystemHealthStatus()
    switch (status) {
      case 'healthy':
        return 'bg-green-500'
      case 'issues':
        return 'bg-red-500'
      case 'degraded':
        return 'bg-yellow-500'
      case 'loading':
        return 'bg-purple-500'
      case 'checking':
      default:
        return 'bg-gray-400'
    }
  }

  const quickActions = [
    {
      label: 'New Query',
      icon: <Plus className="w-4 h-4" />,
      action: () => setActiveTab?.('query'),
      active: activeTab === 'query'
    },
    {
      label: 'View Schema',
      icon: <Database className="w-4 h-4" />,
      action: () => {
        onViewSchema()
        setActiveTab?.('schema')
      },
      active: activeTab === 'schema'
    },
    {
      label: 'Query History',
      icon: <Clock className="w-4 h-4" />,
      action: () => {
        onViewHistory()
        setActiveTab?.('history')
      },
      active: activeTab === 'history'
    }
  ]

  const sampleQueries = [
    'Show all tables in the database',
    'List recent orders with customer details',
    'Find products with low inventory',
    'Get monthly sales summary'
  ]

  return (
    <Sidebar open={open} setOpen={setOpen} animate={true}>
      <SidebarBody className="justify-between gap-6 scrollbar-hide">
        <div className="flex flex-col flex-1 overflow-y-auto overflow-x-hidden scrollbar-hide">
          
          {/* Connection Status Header */}
          <SidebarSection>
            <motion.div
              className={cn(
                "p-3 rounded-lg bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-950/20 dark:to-indigo-950/20 border border-blue-200 dark:border-blue-800",
                open ? "flex items-center gap-3" : "flex justify-center"
              )}
              animate={{
                opacity: open ? 1 : 0.8,
              }}
            >
              <motion.div
                className={cn(
                  "flex-shrink-0",
                  !open && "flex justify-center"
                )}
                animate={{
                  scale: open ? 1 : 0.8,
                }}
              >
                {getConnectionStatusIcon()}
              </motion.div>
              
              {open && (
                <>
                  <motion.div
                    className="flex-1 min-w-0"
                    animate={{
                      opacity: open ? 1 : 0,
                      display: open ? "block" : "none",
                    }}
                  >
                    <div className="text-sm font-medium text-foreground">
                      {currentProfile?.databaseName || 'No Database'}
                    </div>
                    <div className="text-xs text-muted-foreground flex items-center gap-1">
                      {getConnectionStatusText()}
                      {currentProfile && (
                        <>
                          <span>•</span>
                          <span className="truncate">{currentProfile.serverName}</span>
                        </>
                      )}
                    </div>
                  </motion.div>

                  {/* Refresh Button - Keep visible in collapsed state but smaller */}
                  <motion.button
                    className="flex-shrink-0 p-1.5 rounded-md hover:bg-background/50 transition-colors"
                    onClick={refreshData}
                    disabled={isRefreshing || !currentProfile}
                    title="Refresh database information"
                    animate={{
                      opacity: 1, // Always visible
                      scale: open ? 1 : 0.9, // Slightly smaller when collapsed
                    }}
                    whileHover={{ scale: open ? 1.1 : 1.0 }}
                    whileTap={{ scale: open ? 0.95 : 0.85 }}
                  >
                    <RefreshCw 
                      className={cn(
                        "w-4 h-4 text-muted-foreground", 
                        isRefreshing && "animate-spin"
                      )} 
                    />
                  </motion.button>
                </>
              )}
            </motion.div>
          </SidebarSection>

          {/* Quick Actions */}
          <SidebarSection title="Quick Actions">
            <div className={cn("space-y-1", !open && "space-y-3")}>
              {quickActions.map((action, index) => (
                <motion.button
                  key={action.label}
                  className={cn(
                    "w-full p-2 rounded-lg transition-colors group",
                    action.active 
                      ? "bg-primary text-primary-foreground shadow-sm" 
                      : "hover:bg-accent hover:text-accent-foreground",
                    open ? "flex items-center gap-3 text-left" : "flex justify-center"
                  )}
                  onClick={action.action}
                  whileHover={{ x: open ? 2 : 0, scale: open ? 1 : 1.05 }} // Scale on hover when collapsed
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: index * 0.1 }}
                  title={open ? undefined : action.label} // Show tooltip when collapsed
                >
                  <div className={cn("flex-shrink-0", !open && "flex justify-center")}>
                    {action.icon}
                  </div>
                  {open && (
                    <motion.span
                      className="flex-1 text-sm font-medium"
                      animate={{
                        opacity: open ? 1 : 0,
                        display: open ? "block" : "none",
                      }}
                    >
                      {action.label}
                    </motion.span>
                  )}
                  {open && action.active && (
                    <ChevronRight className="w-4 h-4 opacity-60" />
                  )}
                </motion.button>
              ))}
            </div>
          </SidebarSection>

          {/* Database Overview */}
          {currentProfile && (
            <SidebarSection title={open ? "Database Overview" : undefined}>
              {open ? (
                <motion.div
                  className="space-y-3"
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.2 }}
                >
                  {/* Stats Grid */}
                  <div className="grid grid-cols-2 gap-2">
                    <Card className="p-3">
                      <div className="flex items-center gap-2">
                        <Table className="w-4 h-4 text-blue-500" />
                        <div>
                          <div className="text-lg font-bold">{dbStats.tables}</div>
                          <div className="text-xs text-muted-foreground">Tables</div>
                        </div>
                      </div>
                    </Card>
                    
                    <Card className="p-3">
                      <div className="flex items-center gap-2">
                        <Eye className="w-4 h-4 text-green-500" />
                        <div>
                          <div className="text-lg font-bold">{dbStats.views}</div>
                          <div className="text-xs text-muted-foreground">Views</div>
                        </div>
                      </div>
                    </Card>
                  </div>

                {/* System Health Monitor */}
                <Card className="p-3 cursor-pointer hover:bg-muted/50 transition-colors" onClick={onOpenHealthManager}>
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      {getSystemHealthIcon()}
                      <span className="text-sm font-medium">System Health</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge 
                        variant={getSystemHealthBadgeVariant()}
                        className="text-xs"
                      >
                        {getSystemHealthText()}
                      </Badge>
                      <ChevronRight className="w-4 h-4 text-muted-foreground" />
                    </div>
                  </div>
                  
                  {/* Health Status Details */}
                  {healthStatus && (
                    <div className="space-y-1 mb-2">
                      <div className="flex items-center justify-between text-xs">
                        <span className="text-muted-foreground">API</span>
                        <span className={cn(
                          "capitalize font-medium",
                          healthStatus.api.status === 'healthy' ? 'text-green-600' :
                          healthStatus.api.status === 'down' ? 'text-red-600' :
                          healthStatus.api.status === 'loading' ? 'text-blue-600' : 'text-yellow-600'
                        )}>
                          {healthStatus.api.status}
                          {healthStatus.api.responseTime && ` (${healthStatus.api.responseTime}ms)`}
                        </span>
                      </div>
                      
                      {/* Only show LLM status if not in basic mode */}
                      {setupType !== 'basic' && (
                        <>
                          <div className="flex items-center justify-between text-xs">
                            <span className="text-muted-foreground">LLM</span>
                            <span className={cn(
                              "capitalize font-medium",
                              healthStatus.llm.status === 'healthy' ? 'text-green-600' :
                              healthStatus.llm.status === 'error' ? 'text-red-600' :
                              healthStatus.llm.status === 'loading' ? 'text-blue-600' : 'text-yellow-600'
                            )}>
                              {healthStatus.llm.status === 'rate_limited' ? 'Rate Limited' : healthStatus.llm.status}
                            </span>
                          </div>
                          
                          {/* Local LLM model info */}
                          {healthStatus.llm.localModel && (
                            <div className="flex items-center justify-between text-xs">
                              <span className="text-muted-foreground">Model</span>
                              <span className="font-medium text-blue-600 truncate max-w-24" title={healthStatus.llm.localModel}>
                                {healthStatus.llm.localModel}
                              </span>
                            </div>
                          )}
                          
                          {/* Rate limit progress bar */}
                          {healthStatus.llm.rateLimitInfo && (
                            <div className="mt-2">
                              <div className="flex justify-between text-xs text-muted-foreground mb-1">
                                <span>Usage</span>
                                <span>{healthStatus.llm.rateLimitInfo.used.toLocaleString()} / {healthStatus.llm.rateLimitInfo.limit.toLocaleString()}</span>
                              </div>
                              <div className="w-full bg-muted rounded-full h-1.5">
                            <div 
                              className={cn(
                                "h-1.5 rounded-full transition-all duration-300",
                                healthStatus.llm.status === 'healthy' ? 'bg-green-500' :
                                healthStatus.llm.status === 'error' ? 'bg-red-500' :
                                healthStatus.llm.status === 'loading' ? 'bg-blue-500' : 'bg-yellow-500'
                              )}
                              style={{ 
                                width: `${Math.min((healthStatus.llm.rateLimitInfo.used / healthStatus.llm.rateLimitInfo.limit) * 100, 100)}%` 
                              }}
                            />
                          </div>
                        </div>
                      )}
                        </>
                      )}
                    </div>
                  )}
                  
                  {/* Overall health bar */}
                  <div className={cn(
                    "h-2 rounded-full transition-all duration-300",
                    getSystemHealthBarColor()
                  )} />
                </Card>
              </motion.div>
              ) : (
                /* Collapsed version - show just essential interactive icons */
                <div className="space-y-4">
                  {/* Health Status Icon - Only interactive element */}
                  <motion.button
                    className="w-full p-2 rounded-lg hover:bg-muted/50 transition-colors"
                    onClick={onOpenHealthManager}
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                    title="System Health"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: 0.2 }}
                  >
                    <div className="flex justify-center">
                      {getSystemHealthIcon()}
                    </div>
                  </motion.button>
                </div>
              )}
            </SidebarSection>
          )}

          {/* Quick Query Templates */}
          {open && (
            <SidebarSection title="Quick Templates">
              <motion.div
                className="space-y-2"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.3 }}
              >
                {/* Default templates */}
                {sampleQueries.slice(0, 3).map((query, index) => (
                  <motion.button
                    key={index}
                    className="w-full text-left p-2 rounded-lg border border-dashed border-border hover:border-primary hover:bg-accent/50 transition-colors group"
                    onClick={() => onExecuteQuery?.(query)}
                    whileHover={{ scale: 1.01 }}
                    whileTap={{ scale: 0.99 }}
                  >
                    <div className="flex items-start gap-2">
                      <Zap className="w-3 h-3 text-yellow-500 mt-0.5 flex-shrink-0" />
                      <span className="text-xs text-muted-foreground group-hover:text-foreground line-clamp-2">
                        {query}
                      </span>
                    </div>
                  </motion.button>
                ))}
                
                {/* Custom queries */}
                {customQueries.map((query, index) => (
                  <motion.button
                    key={`custom-${index}`}
                    className="w-full text-left p-2 rounded-lg border border-dashed border-blue-500/30 hover:border-blue-400 hover:bg-blue-50/5 transition-colors group relative"
                    onClick={() => onExecuteQuery?.(query)}
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: 0.1 }}
                    whileHover={{ scale: 1.01 }}
                    whileTap={{ scale: 0.99 }}
                  >
                    <div className="flex items-start gap-2 pr-6">
                      <Star className="w-3 h-3 text-blue-400 mt-0.5 flex-shrink-0" />
                      <span className="text-xs text-muted-foreground group-hover:text-foreground line-clamp-2">
                        {query}
                      </span>
                    </div>
                    <button
                      onClick={(e) => {
                        e.stopPropagation()
                        handleRemoveCustomQuery(index)
                      }}
                      className="absolute top-1 right-1 p-1 text-gray-500 hover:text-red-400 opacity-0 group-hover:opacity-100 transition-all rounded"
                      title="Remove custom query"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </motion.button>
                ))}
                
                <Button 
                  variant="ghost" 
                  size="sm" 
                  className="w-full text-xs"
                  onClick={() => setShowCreateDialog(true)}
                >
                  <Plus className="w-3 h-3 mr-1" />
                  Create Custom Query
                </Button>
              </motion.div>
            </SidebarSection>
          )}

          {/* Profile Management */}
          {open ? (
            <SidebarSection title={`Profiles (${profiles.length})`}>
              <motion.div
                className="space-y-2"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.4 }}
              >
                <ScrollArea className="max-h-52">
                  <div className="space-y-1">
                    {profiles.map((profile) => (
                      <motion.button
                        key={profile.id}
                        className={cn(
                          "w-full flex items-center gap-2 p-2 rounded-lg transition-colors text-left",
                          profile.id === currentProfile?.id
                            ? "bg-primary/10 border border-primary/20 text-primary"
                            : "hover:bg-accent hover:text-accent-foreground"
                        )}
                        onClick={() => onSwitchProfile(profile.id)}
                        whileHover={{ x: 2 }}
                      >
                        <Database className="w-3 h-3 flex-shrink-0" />
                        <div className="flex-1 min-w-0">
                          <div className="text-xs font-medium truncate">
                            {profile.databaseName}
                          </div>
                          <div className="text-xs text-muted-foreground truncate">
                            {profile.serverName}
                          </div>
                        </div>
                        {profile.id === currentProfile?.id && (
                          <CircleDot className="w-2 h-2 text-primary flex-shrink-0" />
                        )}
                      </motion.button>
                    ))}
                  </div>
                </ScrollArea>
                
                <Button
                  variant="outline"
                  size="sm"
                  className="w-full border-dashed"
                  onClick={onCreateProfile}
                >
                  <Plus className="w-3 h-3 mr-1" />
                  Add Profile
                </Button>
              </motion.div>
            </SidebarSection>
          ) : (
            /* Collapsed profile selector */
            <SidebarSection>
              <div className="space-y-4">
                {profiles.length > 0 && (
                  <motion.div 
                    className="flex flex-col gap-2"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: 0.4 }}
                  >
                    {profiles.slice(0, 3).map((profile) => (
                      <motion.button
                        key={profile.id}
                        className={cn(
                          "p-2 rounded-lg transition-colors",
                          profile.id === currentProfile?.id
                            ? "bg-primary/20 text-primary"
                            : "hover:bg-accent"
                        )}
                        onClick={() => onSwitchProfile(profile.id)}
                        whileHover={{ scale: 1.05 }}
                        whileTap={{ scale: 0.95 }}
                        title={`${profile.databaseName} - ${profile.serverName}`}
                      >
                        <Database className="w-4 h-4 mx-auto" />
                      </motion.button>
                    ))}
                    {profiles.length > 3 && (
                      <div className="text-xs text-muted-foreground text-center">
                        +{profiles.length - 3} more
                      </div>
                    )}
                  </motion.div>
                )}
                
                <motion.button
                  className="w-full p-2 rounded-lg border-2 border-dashed border-border hover:border-primary transition-colors"
                  onClick={onCreateProfile}
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  title="Add Profile"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: 0.5 }}
                >
                  <Plus className="w-4 h-4 mx-auto" />
                </motion.button>
              </div>
            </SidebarSection>
          )}

        </div>

        {/* Footer */}
        <SidebarSection>
          <motion.div
            className="space-y-2"
            animate={{
              opacity: open ? 1 : 0.8,
            }}
          >
            {open ? (
              <div className="text-xs text-muted-foreground text-center p-2 border-t border-border">
                <div className="flex items-center justify-center gap-1 mb-1">
                  <Shield className="w-3 h-3" />
                  <span>NaturalToSQL</span>
                </div>
                <div>Secure Database Interface</div>
              </div>
            ) : (
              <div className="flex justify-center">
                <Database className="w-5 h-5 text-muted-foreground" />
              </div>
            )}
          </motion.div>
        </SidebarSection>

      </SidebarBody>

      {/* Create Custom Query Modal */}
      {showCreateDialog && (
        <motion.div
          className="fixed inset-0 bg-black/50 flex items-center justify-center z-50"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={handleCancelDialog}
        >
          <motion.div
            className="bg-card p-4 sm:p-6 rounded-lg shadow-lg border border-border min-w-[90vw] sm:min-w-[400px] max-w-[95vw] sm:max-w-[700px] w-full mx-4"
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.9, opacity: 0 }}
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="text-base sm:text-lg font-medium mb-4">Create Custom Query</h3>
            <div className="space-y-4">
              <div>
                <label htmlFor="custom-query-input" className="block text-sm font-medium mb-2">
                  Query Description
                </label>
                <textarea
                  id="custom-query-input"
                  value={newQueryText}
                  onChange={(e) => setNewQueryText(e.target.value)}
                  placeholder="Enter your natural language query..."
                  className="w-full p-3 border border-border rounded-lg bg-background text-foreground placeholder-muted-foreground resize-none text-sm"
                  rows={3}
                  autoFocus
                />
              </div>
              <div className="flex flex-col sm:flex-row gap-2 justify-end">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleCancelDialog}
                  className="w-full sm:w-auto"
                >
                  Cancel
                </Button>
                <Button
                  size="sm"
                  onClick={handleSaveCustomQuery}
                  disabled={!newQueryText.trim()}
                  className="w-full sm:w-auto"
                >
                  Save Query
                </Button>
              </div>
            </div>
          </motion.div>
        </motion.div>
      )}
    </Sidebar>
  )
}

export default ModernSidebar
