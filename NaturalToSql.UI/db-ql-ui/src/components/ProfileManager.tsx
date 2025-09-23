import React, { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import { ConnectionProfile, NotificationMessage } from '@/types'
import apiService from '@/services/api'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import LoadingScreen from './LoadingScreen'
import { 
  Database, 
  Plus, 
  Trash2, 
  Cable, 
  Loader2, 
  ArrowLeft, 
  Server,
  Activity,
  Clock,
  Sparkles,
  Zap,
  CheckCircle,
  Search
} from 'lucide-react'

interface ProfileManagerProps {
  onProfileSelected: (profile: ConnectionProfile) => void
  onCreateNew: () => void
  onNotification: (notification: Omit<NotificationMessage, 'id'>) => void
  onBackToMain?: () => void // Optional back button for navigation
  currentProfileId?: string | null
  onProfilesUpdated?: () => void // Callback when profiles are updated (added/deleted)
}

const ProfileManager: React.FC<ProfileManagerProps> = ({
  onProfileSelected,
  onCreateNew,
  onNotification,
  onBackToMain,
  currentProfileId,
  onProfilesUpdated
}) => {
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

  const [profiles, setProfiles] = useState<ConnectionProfile[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [deletingProfile, setDeletingProfile] = useState<string | null>(null)

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

  const cardHoverVariants = {
    rest: { scale: 1, y: 0 },
    hover: { 
      scale: 1.02, 
      y: -4,
      transition: { duration: 0.2 }
    }
  }

  // Load profiles from server
  useEffect(() => {
    loadProfiles()
  }, [])

  const loadProfiles = async () => {
    try {
      setIsLoading(true)
      const serverProfiles = await apiService.getExistingProfiles()
      
      // Filter out invalid profiles
      const validProfiles = serverProfiles.filter(profile => 
        profile && 
        profile.id && 
        profile.id.trim() !== ''
      )
      
      setProfiles(validProfiles)
      
      if (validProfiles.length === 0) {
        onNotification({
          type: 'info',
          title: 'No Profiles Found',
          message: 'Create your first database profile to get started.',
          duration: 3000
        })
      }
    } catch (error) {
      console.error('Failed to load profiles:', error)
      onNotification({
        type: 'error',
        title: 'Failed to Load Profiles',
        message: getErrorMessage(error),
        duration: 5000
      })
    } finally {
      setIsLoading(false)
    }
  }

  const handleDeleteProfile = async (profileId: string) => {
    if (!confirm('Are you sure you want to delete this profile? This action cannot be undone.')) {
      return
    }

    try {
      setDeletingProfile(profileId)
      await apiService.removeProfile(profileId)
      
      // Reload profiles from server
      await loadProfiles()
      
      // Notify parent component that profiles have been updated
      if (onProfilesUpdated) {
        onProfilesUpdated()
      }
      
      onNotification({
        type: 'success',
        title: 'Profile Deleted',
        message: 'Profile has been successfully deleted.',
        duration: 3000
      })
    } catch (error) {
      console.error('Failed to delete profile:', error)
      onNotification({
        type: 'error',
        title: 'Delete Failed',
        message: getErrorMessage(error),
        duration: 5000
      })
    } finally {
      setDeletingProfile(null)
    }
  }

  const getProfileDisplayName = (profile: ConnectionProfile): string => {
    if (profile.name) return profile.name
    return profile.id
  }

  const getProfileDescription = (profile: ConnectionProfile): string => {
    const parts = []
    // Extract database name from connection string
    if (profile.connectionString) {
      const dbMatch = profile.connectionString.match(/(?:Database|Initial Catalog)\s*=\s*([^;]+)/i)
      if (dbMatch) parts.push(dbMatch[1])
    }
    // Try to extract server from connection string
    if (profile.connectionString) {
      const serverMatch = profile.connectionString.match(/(?:Data Source|Server)\s*=\s*([^;]+)/i)
      if (serverMatch) parts.push(serverMatch[1])
    }
    return parts.join(' • ') || 'Database Connection'
  }

  if (isLoading) {
    return (
      <LoadingScreen 
        type="loading"
        title="Loading Profiles"
        subtitle="Fetching your database connections..."
        size="fullscreen"
        animated={true}
        showProgress={true}
      />
    )
  }

  return (
    <motion.div 
      className="min-h-screen bg-gradient-to-br from-background to-muted/20 p-4"
      initial="hidden"
      animate="visible"
      variants={containerVariants}
    >
      {/* Header with navigation */}
      <div className="border-b bg-card/80 backdrop-blur-sm shadow-sm">
        <div className="container mx-auto px-2 py-4 max-w-5xl">
          <motion.div 
            className="flex items-center justify-between"
            variants={itemVariants}
          >
            <div className="flex items-center space-x-4">
              <div className="flex items-center space-x-3">
                <div className="w-10 h-10 rounded-full bg-gradient-to-r from-blue-500 to-indigo-600 flex items-center justify-center">
                  <Database className="w-5 h-5 text-white" />
                </div>
                <div>
                  <h1 className="text-2xl font-bold text-foreground">Database Profiles</h1>
                  <p className="text-sm text-muted-foreground">Manage your database connections</p>
                </div>
              </div>
              <motion.div 
                className="px-3 py-1.5 bg-gradient-to-r from-green-500/10 to-emerald-500/10 border border-green-500/20 rounded-full text-sm font-medium text-green-600 dark:text-green-400"
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ delay: 0.3, type: "spring" }}
              >
                <Activity className="w-3 h-3 inline mr-1" />
                {profiles.length} active profile{profiles.length !== 1 ? 's' : ''}
              </motion.div>
            </div>
            
            <motion.div 
              className="flex items-center space-x-3"
              variants={itemVariants}
            >
              {/* Back to Main Interface button - only show if there are profiles and one is selected */}
              {onBackToMain && currentProfileId && (
                <Button 
                  variant="outline" 
                  onClick={onBackToMain} 
                  className="flex items-center space-x-2 hover:scale-105 transition-transform"
                >
                  <ArrowLeft className="w-4 h-4" />
                  <span>Back to Editor</span>
                </Button>
              )}
              
              {/* Add Profile button - show when there are existing profiles */}
              {profiles.length > 0 && (
                <Button 
                  onClick={onCreateNew} 
                  className="flex items-center space-x-2 bg-gradient-to-r from-blue-500 to-indigo-600 hover:from-blue-600 hover:to-indigo-700 hover:scale-105 transition-all shadow-lg"
                >
                  <Plus className="w-4 h-4" />
                  <span>Add Profile</span>
                  <Sparkles className="w-3 h-3 ml-1" />
                </Button>
              )}
            </motion.div>
          </motion.div>
        </div>
      </div>

      <div className="container mx-auto px-2 py-8 max-w-5xl">
        {/* Enhanced Description Section */}
        <motion.div 
          className="text-center mb-12"
          variants={itemVariants}
        >
          {profiles.length === 0 ? (
            <div className="space-y-3">
              <h2 className="text-xl font-semibold text-foreground">
                Welcome to Your Database Hub
              </h2>
              <p className="text-muted-foreground max-w-md mx-auto">
                Create your first database connection to unlock the power of natural language queries
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              <h2 className="text-xl font-semibold text-foreground">
                Your Database Connections
              </h2>
              <p className="text-muted-foreground max-w-lg mx-auto">
                Select a profile to continue working with your data, or create a new connection to expand your capabilities
              </p>
            </div>
          )}
        </motion.div>

        {/* Profiles Grid */}
        {profiles.length === 0 ? (
          <motion.div
            className="max-w-xl mx-auto"
            variants={itemVariants}
          >
            <Card className="border-dashed border-2 border-muted-foreground/20 bg-gradient-to-br from-card to-muted/20 shadow-xl">
              <CardHeader className="text-center pt-12 pb-6">
                <motion.div 
                  className="mx-auto w-20 h-20 bg-gradient-to-r from-blue-500 to-indigo-600 rounded-2xl flex items-center justify-center mb-6 shadow-lg"
                  whileHover={{ scale: 1.05, rotate: 5 }}
                  transition={{ type: "spring", stiffness: 300 }}
                >
                  <Database className="w-10 h-10 text-white" />
                </motion.div>
                <CardTitle className="text-2xl font-bold bg-gradient-to-r from-foreground to-muted-foreground bg-clip-text text-transparent">
                  No Database Profiles Yet
                </CardTitle>
                <CardDescription className="text-base mt-3 leading-relaxed">
                  Ready to transform how you work with data? Create your first database connection and start asking questions in plain English.
                </CardDescription>
                
                {/* Feature highlights */}
                <div className="grid grid-cols-1 gap-4 mt-8 text-left">
                  {[
                    { icon: Zap, title: "Natural Language Queries", desc: "Ask questions in plain English" },
                    { icon: Server, title: "Multiple Databases", desc: "Support for SQL Server, MySQL, PostgreSQL" },
                    { icon: CheckCircle, title: "Instant Results", desc: "Get answers fast with intelligent SQL generation" }
                  ].map((feature, index) => (
                    <motion.div
                      key={feature.title}
                      className="flex items-start space-x-3 p-3 bg-muted/30 rounded-lg"
                      initial={{ opacity: 0, x: -20 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: 0.5 + index * 0.1 }}
                    >
                      <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
                        <feature.icon className="w-4 h-4 text-primary" />
                      </div>
                      <div>
                        <h4 className="font-medium text-sm text-foreground">{feature.title}</h4>
                        <p className="text-xs text-muted-foreground">{feature.desc}</p>
                      </div>
                    </motion.div>
                  ))}
                </div>
              </CardHeader>
              <CardContent className="pb-12">
                <motion.div
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                >
                  <Button 
                    onClick={onCreateNew} 
                    className="w-full bg-gradient-to-r from-blue-500 to-indigo-600 hover:from-blue-600 hover:to-indigo-700 shadow-lg hover:shadow-xl transition-all" 
                    size="lg"
                  >
                    <Plus className="w-5 h-5 mr-2" />
                    Create Your First Profile
                    <Sparkles className="w-4 h-4 ml-2" />
                  </Button>
                </motion.div>
              </CardContent>
            </Card>
          </motion.div>
        ) : (
          <motion.div 
            className="space-y-8"
            variants={containerVariants}
          >
            {/* Quick Stats */}
            <motion.div 
              className="grid grid-cols-1 sm:grid-cols-3 lg:grid-cols-3 gap-8 mb-12"
              variants={itemVariants}
            >
              <Card className="bg-gradient-to-br from-blue-500/5 to-indigo-500/5 border-blue-500/20">
                <CardContent className="p-6 text-center">
                  <div className="w-12 h-12 rounded-full bg-blue-500/10 flex items-center justify-center mx-auto mb-3">
                    <Database className="w-6 h-6 text-blue-500" />
                  </div>
                  <h3 className="font-semibold text-lg">{profiles.length}</h3>
                  <p className="text-sm text-muted-foreground">Active Profiles</p>
                </CardContent>
              </Card>
              
              <Card className="bg-gradient-to-br from-green-500/5 to-emerald-500/5 border-green-500/20">
                <CardContent className="p-6 text-center">
                  <div className="w-12 h-12 rounded-full bg-green-500/10 flex items-center justify-center mx-auto mb-3">
                    <Activity className="w-6 h-6 text-green-500" />
                  </div>
                  <h3 className="font-semibold text-lg">
                    {profiles.reduce((total, profile) => total + (profile.queries?.length || 0), 0)}
                  </h3>
                  <p className="text-sm text-muted-foreground">Total Queries</p>
                </CardContent>
              </Card>
              
              <Card className="bg-gradient-to-br from-purple-500/5 to-pink-500/5 border-purple-500/20">
                <CardContent className="p-6 text-center">
                  <div className="w-12 h-12 rounded-full bg-purple-500/10 flex items-center justify-center mx-auto mb-3">
                    <Clock className="w-6 h-6 text-purple-500" />
                  </div>
                  <h3 className="font-semibold text-lg">Recent</h3>
                  <p className="text-sm text-muted-foreground">
                    {profiles.length > 0 
                      ? new Date(Math.max(...profiles.map(p => new Date(p.createdUtc).getTime()))).toLocaleDateString()
                      : 'No data'
                    }
                  </p>
                </CardContent>
              </Card>
            </motion.div>

            {/* Existing Profiles */}
            <motion.div 
              className="grid gap-6 grid-cols-1 sm:grid-cols-2"
              variants={containerVariants}
            >
              {profiles.map((profile) => (
                <motion.div
                  key={profile.id}
                  variants={itemVariants}
                  whileHover="hover"
                  initial="rest"
                  animate="rest"
                  transition={{ type: "spring", stiffness: 300 }}
                >
                  <motion.div
                    variants={cardHoverVariants}
                  >
                    <Card 
                      className={`cursor-pointer group transition-all duration-300 hover:shadow-xl ${
                        currentProfileId === profile.id 
                          ? 'ring-2 ring-primary bg-gradient-to-br from-primary/5 to-primary/10 border-primary/30' 
                          : 'hover:ring-2 hover:ring-primary/30 bg-gradient-to-br from-card to-muted/10'
                      }`}
                      onClick={() => onProfileSelected(profile)}
                    >
                      <CardHeader className="pb-4">
                        <div className="flex items-start justify-between">
                          <div className="flex items-start space-x-4 flex-1 min-w-0">
                            <motion.div 
                              className={`p-3 rounded-xl shadow-sm ${
                                currentProfileId === profile.id 
                                  ? 'bg-primary text-primary-foreground' 
                                  : 'bg-gradient-to-br from-primary/10 to-primary/5 text-primary'
                              }`}
                              whileHover={{ scale: 1.05 }}
                              transition={{ type: "spring", stiffness: 400 }}
                            >
                              <Cable className="w-6 h-6" />
                            </motion.div>
                            <div className="flex-1 min-w-0">
                              <CardTitle className="text-lg mb-1 truncate flex items-center space-x-2">
                                <span>{getProfileDisplayName(profile)}</span>
                                {currentProfileId === profile.id && (
                                  <motion.div 
                                    className="w-2 h-2 bg-green-500 rounded-full"
                                    animate={{ scale: [1, 1.2, 1] }}
                                    transition={{ duration: 2, repeat: Infinity }}
                                  />
                                )}
                              </CardTitle>
                              <CardDescription className="text-sm truncate">
                                {getProfileDescription(profile)}
                              </CardDescription>
                              <div className="flex items-center space-x-4 mt-2 text-xs text-muted-foreground">
                                <div className="flex items-center space-x-1">
                                  <Clock className="w-3 h-3" />
                                  <span>{new Date(profile.createdUtc).toLocaleDateString()}</span>
                                </div>
                                <div className="flex items-center space-x-1">
                                  <Search className="w-3 h-3" />
                                  <span>{profile.queries?.length || 0} queries</span>
                                </div>
                              </div>
                            </div>
                          </div>
                          
                          {currentProfileId === profile.id && (
                            <motion.div 
                              className="px-2 py-1 bg-green-500 text-white text-xs rounded-full font-medium shadow-sm"
                              initial={{ scale: 0, opacity: 0 }}
                              animate={{ scale: 1, opacity: 1 }}
                              transition={{ type: "spring", stiffness: 500 }}
                            >
                              Active
                            </motion.div>
                          )}
                        </div>
                      </CardHeader>
                      
                      <CardContent className="pt-0">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center space-x-2 text-sm text-muted-foreground">
                            <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                            <span>Connected & Ready</span>
                          </div>
                          
                          <div className="flex items-center space-x-1 opacity-0 group-hover:opacity-100 transition-opacity">

                            
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={(e) => {
                                e.stopPropagation()
                                handleDeleteProfile(profile.id)
                              }}
                              disabled={deletingProfile === profile.id}
                              className="h-8 w-8 p-0 hover:bg-destructive/10"
                            >
                              {deletingProfile === profile.id ? (
                                <Loader2 className="w-4 h-4 animate-spin" />
                              ) : (
                                <Trash2 className="w-4 h-4 text-destructive" />
                              )}
                            </Button>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  </motion.div>
                </motion.div>
              ))}
            </motion.div>
          </motion.div>
        )}
      </div>
    </motion.div>
  )
}

export default ProfileManager
