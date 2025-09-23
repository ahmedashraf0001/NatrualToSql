import React, { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Card, CardContent, CardHeader } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { 
  Clock, 
  CheckCircle, 
  AlertCircle, 
  Play, 
  Copy, 
  Calendar,
  Timer,
  Database,
  Search,
  Filter,
  FileText,
  RefreshCw,
  Loader2
} from 'lucide-react'
import { useDebounce } from 'use-debounce'
import { apiService } from '@/services/api'

interface QueryHistoryItem {
  id: string
  naturalLanguage: string
  sqlQuery: string
  timestamp: Date
  executionTime?: number
  success: boolean
  error?: string
  rowsAffected?: number
  databaseName: string
}

interface QueryHistoryProps {
  profileId: string | null
  onRunQuery?: (query: string, naturalLanguage: string) => void
  onLoadQuery?: (query: string, naturalLanguage: string) => void
}

const QueryHistory: React.FC<QueryHistoryProps> = ({ profileId, onRunQuery, onLoadQuery }) => {
  const [searchQuery, setSearchQuery] = useState('')
  const [debouncedSearch] = useDebounce(searchQuery, 300)
  const [filterStatus, setFilterStatus] = useState<'all' | 'success' | 'error'>('all')
  const [sortBy, setSortBy] = useState<'timestamp' | 'execution-time'>('timestamp')
  const [historyItems, setHistoryItems] = useState<QueryHistoryItem[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [databaseName, setDatabaseName] = useState<string>('Database')

  // Load query history from API
  const loadQueryHistory = async () => {
    if (!profileId) {
      setHistoryItems([])
      return
    }

    setIsLoading(true)
    setError(null)
    
    try {
      const profileData = await apiService.getProfile(profileId)
      setDatabaseName(profileData.databaseName || 'Database')
      
      if (profileData.queries && Array.isArray(profileData.queries)) {
        // Transform API queries to our QueryHistoryItem format
        const transformedHistory: QueryHistoryItem[] = profileData.queries.map((query: any) => {
          // Parse the result JSON to get execution details
          let success = true
          let executionTime: number | undefined
          let rowsAffected: number | undefined
          let errorMessage: string | undefined

          try {
            if (query.resultJson) {
              const result = JSON.parse(query.resultJson)
              
              executionTime = result.executionMs
              rowsAffected = result.affectedRows
              
              // Determine success based on multiple factors
              // A query is successful if:
              // 1. No error message (or error message is "None")
              // 2. Has execution time (indicating it ran)
              // 3. Has either rows data or affected rows count
              const hasValidErrorMessage = !result.errorMessage || result.errorMessage === 'None'
              const hasExecutionData = result.executionMs !== undefined
              const hasResultData = (result.rows && result.rows.length > 0) || (result.affectedRows !== undefined && result.affectedRows >= 0)
              
              success = hasValidErrorMessage && hasExecutionData && hasResultData
              
              // Set error message if there's a meaningful error
              if (result.errorMessage && result.errorMessage !== 'None') {
                errorMessage = result.errorMessage
                success = false
              }
            }
          } catch (err) {
            console.warn('Failed to parse result JSON:', err)
            success = false
          }

          // Parse timestamp
          let timestamp: Date
          try {
            timestamp = new Date(query.timestampUtc)
            if (isNaN(timestamp.getTime())) {
              timestamp = new Date()
            }
          } catch {
            timestamp = new Date()
          }

          return {
            id: query.id,
            naturalLanguage: query.userQuery || 'Unknown query',
            sqlQuery: query.sqlQuery || '',
            timestamp,
            executionTime,
            success,
            error: errorMessage,
            rowsAffected,
            databaseName: profileData.databaseName || 'Database'
          }
        })
        
        // Sort by timestamp (newest first)
        transformedHistory.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime())
        setHistoryItems(transformedHistory)
      } else {
        setHistoryItems([])
      }
    } catch (err) {
      console.error('Failed to load query history:', err)
      setError('Failed to load query history. Please check your connection and try again.')
      setHistoryItems([])
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    loadQueryHistory()
  }, [profileId])

  const filteredAndSortedItems = historyItems
    .filter(item => {
      const matchesSearch = debouncedSearch === '' || 
        item.naturalLanguage.toLowerCase().includes(debouncedSearch.toLowerCase()) ||
        item.sqlQuery.toLowerCase().includes(debouncedSearch.toLowerCase())
      
      const matchesStatus = filterStatus === 'all' || 
        (filterStatus === 'success' && item.success) ||
        (filterStatus === 'error' && !item.success)
      
      return matchesSearch && matchesStatus
    })
    .sort((a, b) => {
      if (sortBy === 'timestamp') {
        return b.timestamp.getTime() - a.timestamp.getTime()
      } else {
        const aTime = a.executionTime || 0
        const bTime = b.executionTime || 0
        return bTime - aTime
      }
    })

  const formatTimeAgo = (date: Date) => {
    const now = new Date()
    const diffMs = now.getTime() - date.getTime()
    const diffMins = Math.floor(diffMs / (1000 * 60))
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60))
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24))

    if (diffMins < 1) return 'Just now'
    if (diffMins < 60) return `${diffMins}m ago`
    if (diffHours < 24) return `${diffHours}h ago`
    return `${diffDays}d ago`
  }

  const copyQuery = (query: string) => {
    navigator.clipboard.writeText(query)
  }

  return (
    <motion.div 
      className="flex flex-col max-h-full bg-gradient-to-br from-background via-background to-muted/20"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
    >
      {/* Header */}
      <motion.div 
        className="flex-shrink-0 border-b bg-card/50 backdrop-blur-sm p-4"
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
      >
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center space-x-2">
            <Clock className="w-6 h-6 text-primary" />
            <h2 className="text-xl font-bold">Query History</h2>
            <Badge variant="outline">{filteredAndSortedItems.length} queries</Badge>
          </div>
        </div>

        {/* Search and Filters */}
        <div className="flex space-x-4">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground w-4 h-4" />
            <input
              type="text"
              placeholder="Search queries..."
              className="w-full pl-10 pr-4 py-2 rounded-lg border border-border bg-background text-foreground placeholder:text-muted-foreground focus:ring-2 focus:ring-primary focus:border-transparent"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
          
          <div className="flex space-x-2">
            {(['all', 'success', 'error'] as const).map((status) => (
              <motion.div key={status} whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}>
                <Button
                  variant={filterStatus === status ? "default" : "outline"}
                  size="sm"
                  onClick={() => setFilterStatus(status)}
                  className="capitalize"
                >
                  {status === 'success' && <CheckCircle className="w-4 h-4 mr-1" />}
                  {status === 'error' && <AlertCircle className="w-4 h-4 mr-1" />}
                  {status === 'all' && <Filter className="w-4 h-4 mr-1" />}
                  {status}
                </Button>
              </motion.div>
            ))}
          </div>

          <div className="flex space-x-2">
            {(['timestamp', 'execution-time'] as const).map((sort) => (
              <motion.div key={sort} whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}>
                <Button
                  variant={sortBy === sort ? "default" : "outline"}
                  size="sm"
                  onClick={() => setSortBy(sort)}
                >
                  {sort === 'timestamp' ? <Calendar className="w-4 h-4 mr-1" /> : <Timer className="w-4 h-4 mr-1" />}
                  {sort === 'timestamp' ? 'Time' : 'Performance'}
                </Button>
              </motion.div>
            ))}
          </div>
        </div>
      </motion.div>

      {/* History List */}
      <div className="flex-1 min-h-0 p-4">
        <ScrollArea className="h-full" hideScrollbar>
          <div className="space-y-4">
            {isLoading ? (
              <motion.div 
                className="text-center py-12 text-muted-foreground"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
              >
                <Loader2 className="w-8 h-8 mx-auto mb-4 animate-spin" />
                <p>Loading query history...</p>
              </motion.div>
            ) : error ? (
              <motion.div 
                className="text-center py-12"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
              >
                <AlertCircle className="w-12 h-12 mx-auto mb-4 text-red-500 opacity-50" />
                <p className="text-red-600 dark:text-red-400 mb-2">Failed to load query history</p>
                <p className="text-sm text-muted-foreground mb-4">{error}</p>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={loadQueryHistory}
                  className="mt-2"
                >
                  <RefreshCw className="w-4 h-4 mr-2" />
                  Try Again
                </Button>
              </motion.div>
            ) : filteredAndSortedItems.length > 0 ? (
              filteredAndSortedItems.map((item, index) => (
                <motion.div
                  key={item.id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.05 }}
                >
                  <Card className="hover:shadow-md transition-all duration-200 border-l-4 border-l-primary/30">
                    <CardHeader className="pb-3">
                      <div className="flex items-start justify-between">
                        <div className="flex-1 space-y-2">
                          <div className="flex items-center space-x-2">
                            <Badge variant={item.success ? "success" : "destructive"} className="text-xs">
                              {item.success ? (
                                <CheckCircle className="w-3 h-3 mr-1" />
                              ) : (
                                <AlertCircle className="w-3 h-3 mr-1" />
                              )}
                              {item.success ? 'Success' : 'Error'}
                            </Badge>
                            
                            <div className="flex items-center space-x-1 text-xs text-muted-foreground">
                              <Database className="w-3 h-3" />
                              <span>{item.databaseName}</span>
                            </div>
                            
                            <div className="flex items-center space-x-1 text-xs text-muted-foreground">
                              <Clock className="w-3 h-3" />
                              <span>{formatTimeAgo(item.timestamp)}</span>
                            </div>
                            
                            {item.executionTime && (
                              <div className="flex items-center space-x-1 text-xs text-muted-foreground">
                                <Timer className="w-3 h-3" />
                                <span>{item.executionTime}ms</span>
                              </div>
                            )}
                          </div>
                          
                          <div className="text-sm font-medium text-foreground">
                            {item.naturalLanguage}
                          </div>
                        </div>
                        
                        <div className="flex items-center space-x-2 ml-4">
                          <motion.div whileHover={{ scale: 1.1 }} whileTap={{ scale: 0.9 }}>
                            <Button 
                              variant="ghost" 
                              size="sm"
                              onClick={() => copyQuery(item.sqlQuery)}
                              title="Copy SQL"
                            >
                              <Copy className="w-4 h-4" />
                            </Button>
                          </motion.div>
                          
                          {onLoadQuery && (
                            <motion.div whileHover={{ scale: 1.1 }} whileTap={{ scale: 0.9 }}>
                              <Button 
                                variant="ghost" 
                                size="sm"
                                onClick={() => onLoadQuery(item.sqlQuery, item.naturalLanguage)}
                                title="Load in editor"
                              >
                                <FileText className="w-4 h-4" />
                              </Button>
                            </motion.div>
                          )}
                          
                          {onRunQuery && item.success && (
                            <motion.div whileHover={{ scale: 1.1 }} whileTap={{ scale: 0.9 }}>
                              <Button 
                                variant="ghost" 
                                size="sm"
                                onClick={() => onRunQuery(item.sqlQuery, item.naturalLanguage)}
                                title="Run query"
                              >
                                <Play className="w-4 h-4" />
                              </Button>
                            </motion.div>
                          )}
                        </div>
                      </div>
                    </CardHeader>
                    
                    <CardContent className="pt-0">
                      <div className="space-y-3">
                        <div className="p-3 rounded-lg bg-muted/30 border font-mono text-sm">
                          <pre className="whitespace-pre-wrap text-xs overflow-x-auto">
                            {item.sqlQuery}
                          </pre>
                        </div>
                        
                        {item.success && item.rowsAffected !== undefined && (
                          <div className="text-xs text-muted-foreground">
                            {item.rowsAffected} rows affected
                          </div>
                        )}
                        
                        {!item.success && item.error && (
                          <div className="p-2 rounded bg-red-500/10 border border-red-500/20">
                            <div className="text-sm text-red-600 dark:text-red-400">
                              {item.error}
                            </div>
                          </div>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                </motion.div>
              ))
            ) : (
              <motion.div 
                className="text-center py-12 text-muted-foreground"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
              >
                <Clock className="w-12 h-12 mx-auto mb-4 opacity-50" />
                <p>No queries found {debouncedSearch || filterStatus !== 'all' ? 'matching your criteria' : `for ${databaseName}`}</p>
                <p className="text-sm mt-2">
                  {debouncedSearch || filterStatus !== 'all' 
                    ? 'Try adjusting your search or filters' 
                    : 'Start by running some queries to see them here'
                  }
                </p>
              </motion.div>
            )}
          </div>
        </ScrollArea>
      </div>
    </motion.div>
  )
}

export default QueryHistory
