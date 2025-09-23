import React, { useState, useCallback, useRef, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import Editor from '@monaco-editor/react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { useToast } from '@/components/ui/toast'
import { useNotifications } from '@/contexts/NotificationContext'
import { cn } from '@/lib/utils'
import { apiService } from '@/services/api'
import { userService } from '@/services/user'
import { ConvertQueryRequest, ExecuteQueryRequest } from '@/types'
import { HealthStatus } from '@/types/health'
import { 
  Play, 
  Download, 
  Copy, 
  Clock, 
  Database, 
  Loader2,
  Sparkles,
  Zap,
  Brain,
  CheckCircle,
  AlertCircle,
  Maximize2,
  Minimize2,
  RotateCcw,
  History,
  FileText,
  FileSpreadsheet,
  ChevronDown,
  Settings,
  Search,
  ChevronUp,
  Code,
  ArrowUpDown,
  Edit3,
  Plus,
  Save,
  Trash2
} from 'lucide-react'

// Export utility functions
const exportToCSV = (columns: string[], rows: any[][], filename: string) => {
  const csvContent = [
    columns.join(','),
    ...rows.map(row => 
      row.map(cell => {
        const value = String(cell ?? '')
        // Escape quotes and wrap in quotes if contains comma, newline, or quote
        if (value.includes(',') || value.includes('\n') || value.includes('"')) {
          return `"${value.replace(/"/g, '""')}"`
        }
        return value
      }).join(',')
    )
  ].join('\n')

  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
  const link = document.createElement('a')
  const url = URL.createObjectURL(blob)
  link.setAttribute('href', url)
  link.setAttribute('download', filename)
  link.style.visibility = 'hidden'
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  URL.revokeObjectURL(url)
}

const exportToJSON = (columns: string[], rows: any[][], filename: string) => {
  const data = rows.map(row => {
    const obj: Record<string, any> = {}
    columns.forEach((col, index) => {
      obj[col] = row[index]
    })
    return obj
  })

  const jsonContent = JSON.stringify(data, null, 2)
  const blob = new Blob([jsonContent], { type: 'application/json;charset=utf-8;' })
  const link = document.createElement('a')
  const url = URL.createObjectURL(blob)
  link.setAttribute('href', url)
  link.setAttribute('download', filename)
  link.style.visibility = 'hidden'
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  URL.revokeObjectURL(url)
}

const exportToExcel = (columns: string[], rows: any[][], filename: string) => {
  // Create Excel-compatible HTML table
  const htmlContent = `
    <html>
      <head>
        <meta charset="UTF-8">
        <style>
          table { border-collapse: collapse; width: 100%; }
          th, td { border: 1px solid #ddd; padding: 8px; text-align: left; }
          th { background-color: #f2f2f2; font-weight: bold; }
        </style>
      </head>
      <body>
        <table>
          <thead>
            <tr>${columns.map(col => `<th>${col}</th>`).join('')}</tr>
          </thead>
          <tbody>
            ${rows.map(row => 
              `<tr>${row.map(cell => `<td>${String(cell ?? 'NULL')}</td>`).join('')}</tr>`
            ).join('')}
          </tbody>
        </table>
      </body>
    </html>
  `

  const blob = new Blob([htmlContent], { type: 'application/vnd.ms-excel;charset=utf-8;' })
  const link = document.createElement('a')
  const url = URL.createObjectURL(blob)
  link.setAttribute('href', url)
  link.setAttribute('download', filename)
  link.style.visibility = 'hidden'
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  URL.revokeObjectURL(url)
}

// Utility function to determine if a query is a read command (SELECT, WITH, EXEC, VALUES)
// If it's not a read command, it's considered a write command (INSERT, UPDATE, DELETE, etc.)
const isQueryCommand = (sql: string): boolean => {
  const trimmedSql = sql.trim()
  if (!trimmedSql) return true // Default to read for empty queries
  
  const firstWord = trimmedSql.split(/\s+/)[0]?.toUpperCase()
  return firstWord === "SELECT" || firstWord === "WITH" || firstWord === "EXEC" || firstWord === "VALUES"
}

interface QueryEditorProps {
  currentProfile?: {
    id: string
    name: string
    databaseName?: string
    serverName?: string
  }
  theme: 'light' | 'dark'
  setupType?: 'groq' | 'local' | 'basic' | null
  preloadedQuery?: {
    sql: string
    naturalLanguage: string
    shouldExecute: boolean
    isNewQuery?: boolean
  } | null
  onQueryLoaded?: () => void
  healthStatus?: HealthStatus | null
  preservedState?: {
    naturalLanguageInput: string
    sqlQuery: string
    queryResult?: any
    queryAnalysis?: any
    queryParameters?: any[]
  }
  onStateChange?: (state: {
    naturalLanguageInput: string
    sqlQuery: string
    queryResult?: any
    queryAnalysis?: any
    queryParameters?: any[]
  }) => void
}

interface QueryResult {
  columns: string[]
  rows: any[][]
  executionTime: number
  rowsAffected: number
}

interface QueryHistory {
  id: string
  query: string
  naturalLanguage: string
  timestamp: Date
  executionTime?: number
  success: boolean
  error?: string
  parameters?: { [key: string]: string }
}

const QueryEditor: React.FC<QueryEditorProps> = ({ currentProfile, theme, setupType, preloadedQuery, onQueryLoaded, healthStatus, preservedState, onStateChange }) => {
  const [naturalLanguageInput, setNaturalLanguageInput] = useState(preservedState?.naturalLanguageInput || '')
  const [sqlQuery, setSqlQuery] = useState(preservedState?.sqlQuery || '')
  const [isGenerating, setIsGenerating] = useState(false)
  const [isExecuting, setIsExecuting] = useState(false)
  const [queryResult, setQueryResult] = useState<QueryResult | null>(preservedState?.queryResult || null)
  const [queryHistory, setQueryHistory] = useState<QueryHistory[]>([])
  const [autoGenerate, setAutoGenerate] = useState(true)
  const [allowWriteOperations, setAllowWriteOperations] = useState(false)
  const [isLoadingHistory, setIsLoadingHistory] = useState(false)
  const [queryAnalysis, setQueryAnalysis] = useState<{
    intent: string
    confidence: number
    mode: string
    explanation: string
    safe: boolean
    tables: string[]
    columns: string[]
  } | null>(preservedState?.queryAnalysis || null)
  const [showExportMenu, setShowExportMenu] = useState(false)
  const [editingParam, setEditingParam] = useState<string | null>(null)
  const [editingValue, setEditingValue] = useState('')
  const [smartSuggestions, setSmartSuggestions] = useState<Array<{text: string, icon: string, category: string}>>([])
  const [lastRequestTime, setLastRequestTime] = useState<number>(0) // Add rate limiting
  const [isThrottled, setIsThrottled] = useState(false) // Show throttling status
  const [isTyping, setIsTyping] = useState(false) // Track if user is actively typing
  const [queryParameters, setQueryParameters] = useState<any[] | null>(preservedState?.queryParameters || null) // Store parameters from conversion response
  const [rateLimitTimer, setRateLimitTimer] = useState<NodeJS.Timeout | null>(null) // Timer for rate limit countdown
  const [timeRemaining, setTimeRemaining] = useState<number>(0) // Seconds remaining until rate limit reset
  
  // Use global notification context
  const { addNotification } = useNotifications()
  
  // Debug useEffect to track queryParameters changes
  useEffect(() => {
    console.log('🔄 queryParameters state changed:', queryParameters)
  }, [queryParameters])
  
  // Shared dimensions for Results and History cards
  const baseCardHeight = 300 // Base height for both cards (reduced from 400)
  const minCardWidth = 50 // Minimum width percentage (same as History when side-by-side)
  const minCardHeight = 300 // Minimum height (same as History card)
  
  const [resultsHeight, setResultsHeight] = useState(baseCardHeight) // Resizable results height
  const [resultsWidth, setResultsWidth] = useState(50) // Results width as percentage (50% = half width)
  const [isResizingResults, setIsResizingResults] = useState(false) // Track resize state
  const [isResizingWidth, setIsResizingWidth] = useState(false) // Track width resize state
  const [resizeStartY, setResizeStartY] = useState(0) // Track initial mouse Y position
  const [resizeStartHeight, setResizeStartHeight] = useState(0) // Track initial height
  
  // Table functionality state
  const [searchTerm, setSearchTerm] = useState('') // Search filter
  const [sortColumn, setSortColumn] = useState<string | null>(null) // Currently sorted column
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc') // Sort direction
  
  // Fullscreen state for results
  const [isResultsFullscreen, setIsResultsFullscreen] = useState(false)
  
  const { addToast } = useToast()

  // Debug: Monitor queryParameters changes
  useEffect(() => {
    console.log('🔄 queryParameters state changed to:', queryParameters?.length || 0, 'parameters')
    if (queryParameters && queryParameters.length > 0) {
      console.log('📋 Current parameters:', queryParameters.map(p => `${p.name}=${p.value}`).join(', '))
    }
  }, [queryParameters])

  // State preservation: Notify parent component when key state changes
  useEffect(() => {
    if (onStateChange) {
      onStateChange({
        naturalLanguageInput,
        sqlQuery,
        queryResult,
        queryAnalysis,
        queryParameters: queryParameters || undefined
      })
    }
  }, [naturalLanguageInput, sqlQuery, queryResult, queryAnalysis, queryParameters])

  // Reset state when preserved state is cleared (mode switching)
  useEffect(() => {
    if (preservedState && 
        preservedState.naturalLanguageInput === '' && 
        preservedState.sqlQuery === '' && 
        !preservedState.queryResult && 
        !preservedState.queryAnalysis && 
        !preservedState.queryParameters) {
      // Clear all local state when mode switches
      setNaturalLanguageInput('')
      setSqlQuery('')
      setQueryResult(null)
      setQueryAnalysis(null)
      setQueryParameters(null)
    }
  }, [preservedState])

  // Helper function to detect @param patterns in SQL with better type inference
  const detectSqlParameters = useCallback((sql: string): Array<{name: string, type: string}> => {
    if (!sql) return []
    
    const paramPattern = /@(\w+)/g
    const matches = sql.match(paramPattern)
    if (!matches) return []
    
    // Remove duplicates and infer types based on context
    const uniqueParams = [...new Set(matches)]
    
    return uniqueParams.map(param => {
      const paramName = param.substring(1) // Remove @ prefix
      let inferredType = 'varchar' // Default type
      
      // Try to infer type from SQL context
      const contextPattern = new RegExp(`@${paramName}\\s*(?:=|IN|LIKE|>|<|>=|<=|!=|<>)\\s*`, 'gi')
      const match = sql.match(contextPattern)
      
      if (match) {
        const context = match[0].toLowerCase()
        // Simple type inference based on operators
        if (context.includes('like')) {
          inferredType = 'varchar'
        } else if (context.includes('in')) {
          inferredType = 'array'
        } else if (context.includes('>') || context.includes('<')) {
          inferredType = 'number'
        }
      }
      
      // Check if parameter appears in date-related contexts
      if (sql.toLowerCase().includes(`date(`) && sql.toLowerCase().includes(paramName.toLowerCase())) {
        inferredType = 'date'
      }
      
      // Check if parameter appears in COUNT, SUM, etc.
      if (sql.toLowerCase().match(new RegExp(`(count|sum|avg|max|min)\\s*\\([^)]*@${paramName.toLowerCase()}`, 'i'))) {
        inferredType = 'number'
      }
      
      return {
        name: paramName,
        type: inferredType
      }
    })
  }, [])

  // Check if parameters should be displayed
  const shouldShowParameters = useCallback(() => {
    // Show if we have parameters from the API response
    if (queryParameters && queryParameters.length > 0) {
      return true
    }
    
    // Show if we detect @param patterns in the SQL
    if (sqlQuery) {
      const detectedParams = detectSqlParameters(sqlQuery)
      if (detectedParams.length > 0) {
        return true
      }
    }
    
    // Show if write mode is enabled (as requested)
    if (allowWriteOperations) {
      return true
    }
    
    return false
  }, [queryParameters, sqlQuery, allowWriteOperations, detectSqlParameters])

  // Get combined parameters for display
  const getDisplayParameters = useCallback(() => {
    console.log('📋 getDisplayParameters called - queryParameters:', queryParameters)
    
    const combinedParams: Array<{name: string, value: any, type: string, source: 'api' | 'detected' | 'placeholder' | 'manual'}> = []
    
    // Add parameters from API response or manual entries
    if (queryParameters && queryParameters.length > 0) {
      console.log('🔗 Adding stored parameters:', queryParameters)
      queryParameters.forEach(param => {
        combinedParams.push({
          name: param.name?.replace('@', '') || 'unknown',
          value: param.value,
          type: param.type || 'varchar',
          source: param.source || 'api'
        })
      })
    } else {
      console.log('❌ No stored parameters found')
    }
    
    // Add detected parameters from SQL that aren't already in stored parameters
    if (sqlQuery) {
      const detectedParams = detectSqlParameters(sqlQuery)
      detectedParams.forEach(detected => {
        const exists = combinedParams.some(existing => existing.name === detected.name)
        if (!exists) {
          combinedParams.push({
            name: detected.name,
            value: null,
            type: detected.type,
            source: 'detected'
          })
        }
      })
    }
    
    // Remove parameters that are no longer in the SQL query (unless they're manually added)
    const currentSqlParams = sqlQuery ? detectSqlParameters(sqlQuery).map(p => p.name) : []
    const filteredParams = combinedParams.filter(param => {
      const isInSql = currentSqlParams.includes(param.name)
      const isManual = param.source === 'manual'
      return isInSql || isManual
    })
    
    // If in write mode but no parameters detected, show placeholder info
    if (allowWriteOperations && filteredParams.length === 0) {
      filteredParams.push({
        name: 'example_param',
        value: 'Use @param_name in your SQL',
        type: 'info',
        source: 'placeholder'
      })
    }
    
    return filteredParams
  }, [queryParameters, sqlQuery, allowWriteOperations, detectSqlParameters])

  // Parameter management functions
  const updateParameterValue = useCallback((paramName: string, newValue: any) => {
    console.log(`🔧 Updating parameter ${paramName} to:`, newValue)
    
    const updatedParameters = queryParameters ? [...queryParameters] : []
    const existingIndex = updatedParameters.findIndex(p => p.name?.replace('@', '') === paramName || p.name === paramName)
    
    if (existingIndex >= 0) {
      // Update existing parameter
      updatedParameters[existingIndex] = {
        ...updatedParameters[existingIndex],
        value: newValue
      }
    } else {
      // Add new parameter
      updatedParameters.push({
        name: paramName.startsWith('@') ? paramName : `@${paramName}`,
        value: newValue,
        type: 'varchar',
        source: 'manual'
      })
    }
    
    setQueryParameters(updatedParameters)
  }, [queryParameters])

  const addNewParameter = useCallback(() => {
    console.log('➕ Adding new parameter')
    const newParamName = `param${(queryParameters?.length || 0) + 1}`
    
    const updatedParameters = queryParameters ? [...queryParameters] : []
    updatedParameters.push({
      name: `@${newParamName}`,
      value: '',
      type: 'varchar',
      source: 'manual'
    })
    
    setQueryParameters(updatedParameters)
  }, [queryParameters])

  const removeParameter = useCallback((paramName: string) => {
    console.log(`🗑️ Removing parameter: "${paramName}"`)
    console.log(`🗑️ Current queryParameters:`, queryParameters)
    
    if (!queryParameters) {
      console.log(`🗑️ No queryParameters to remove from`)
      return
    }

    const updatedParameters = queryParameters.filter(p => {
      // Normalize both names for comparison (remove @ if present)
      const storedName = (p.name || '').replace('@', '')
      const targetName = paramName.replace('@', '')
      const shouldKeep = storedName !== targetName
      
      console.log(`🗑️ Comparing stored "${storedName}" vs target "${targetName}" - keep: ${shouldKeep}`)
      return shouldKeep
    })
    
    console.log(`🗑️ Updated parameters (${updatedParameters.length} remaining):`, updatedParameters)
    console.log(`🗑️ About to call setQueryParameters...`)
    setQueryParameters(updatedParameters)
    console.log(`🗑️ setQueryParameters called!`)
  }, [queryParameters])

  const syncParametersWithSQL = useCallback(() => {
    console.log('🔄 Syncing parameters with SQL changes')
    
    if (!sqlQuery) {
      setQueryParameters([])
      return
    }
    
    const detectedParams = detectSqlParameters(sqlQuery)
    const currentParams = queryParameters || []
    const updatedParams: any[] = []
    
    // Keep existing parameter values for detected parameters
    detectedParams.forEach(detected => {
      const existing = currentParams.find(p => 
        p.name?.replace('@', '') === detected.name || p.name === detected.name
      )
      
      if (existing) {
        updatedParams.push({
          ...existing,
          name: detected.name.startsWith('@') ? detected.name : `@${detected.name}`,
          type: detected.type
        })
      } else {
        updatedParams.push({
          name: detected.name.startsWith('@') ? detected.name : `@${detected.name}`,
          value: null,
          type: detected.type,
          source: 'detected'
        })
      }
    })
    
    // Keep manually added parameters even if not in SQL
    currentParams.forEach(param => {
      if (param.source === 'manual') {
        const alreadyAdded = updatedParams.some(p => 
          p.name?.replace('@', '') === param.name?.replace('@', '')
        )
        if (!alreadyAdded) {
          updatedParams.push(param)
        }
      }
    })
    
    setQueryParameters(updatedParams)
  }, [sqlQuery, queryParameters, detectSqlParameters])

  // Results card resize handlers
  const handleResultsResizeStart = (e: React.MouseEvent) => {
    e.preventDefault()
    setIsResizingResults(true)
    setResizeStartY(e.clientY)
    setResizeStartHeight(resultsHeight)
  }

  const handleResultsResize = useCallback((e: MouseEvent) => {
    if (!isResizingResults) return
    
    const deltaY = e.clientY - resizeStartY
    const newHeight = resizeStartHeight + deltaY
    
    // Use minimum and maximum height constraints
    if (newHeight >= minCardHeight && newHeight <= 800) {
      setResultsHeight(newHeight)
    }
  }, [isResizingResults, minCardHeight, resizeStartY, resizeStartHeight])

  const handleResultsResizeEnd = useCallback(() => {
    setIsResizingResults(false)
  }, [])

  // Width resize handlers
  const handleWidthResizeStart = (e: React.MouseEvent) => {
    e.preventDefault()
    setIsResizingWidth(true)
  }

  const handleWidthResize = useCallback((e: MouseEvent) => {
    if (!isResizingWidth) return
    
    const container = document.querySelector('.results-history-container')
    if (!container) return
    
    const containerRect = container.getBoundingClientRect()
    const newWidthPercent = ((e.clientX - containerRect.left) / containerRect.width) * 100
    
    // Constrain width between minimum card width and 100%
    if (newWidthPercent >= minCardWidth && newWidthPercent <= 100) {
      setResultsWidth(newWidthPercent)
    }
  }, [isResizingWidth, minCardWidth])

  const handleWidthResizeEnd = useCallback(() => {
    setIsResizingWidth(false)
  }, [])

  // Reset function for results size
  const resetResultsSize = useCallback(() => {
    setResultsHeight(baseCardHeight)
    setResultsWidth(50)
  }, [baseCardHeight])

  React.useEffect(() => {
    if (isResizingResults) {
      document.addEventListener('mousemove', handleResultsResize)
      document.addEventListener('mouseup', handleResultsResizeEnd)
      document.body.style.cursor = 'row-resize'
      document.body.style.userSelect = 'none'
    } else {
      document.removeEventListener('mousemove', handleResultsResize)
      document.removeEventListener('mouseup', handleResultsResizeEnd)
      document.body.style.cursor = ''
      document.body.style.userSelect = ''
    }

    return () => {
      document.removeEventListener('mousemove', handleResultsResize)
      document.removeEventListener('mouseup', handleResultsResizeEnd)
      document.body.style.cursor = ''
      document.body.style.userSelect = ''
    }
  }, [isResizingResults, handleResultsResize, handleResultsResizeEnd])

  React.useEffect(() => {
    if (isResizingWidth) {
      document.addEventListener('mousemove', handleWidthResize)
      document.addEventListener('mouseup', handleWidthResizeEnd)
      document.body.style.cursor = 'col-resize'
      document.body.style.userSelect = 'none'
    } else {
      document.removeEventListener('mousemove', handleWidthResize)
      document.removeEventListener('mouseup', handleWidthResizeEnd)
      document.body.style.cursor = ''
      document.body.style.userSelect = ''
    }

    return () => {
      document.removeEventListener('mousemove', handleWidthResize)
      document.removeEventListener('mouseup', handleWidthResizeEnd)
      document.body.style.cursor = ''
      document.body.style.userSelect = ''
    }
  }, [isResizingWidth, handleWidthResize, handleWidthResizeEnd])
  
  // Table sorting and filtering functions
  const handleSort = (columnName: string) => {
    if (sortColumn === columnName) {
      // Toggle direction if same column
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc')
    } else {
      // New column, start with ascending
      setSortColumn(columnName)
      setSortDirection('asc')
    }
  }

  const filteredAndSortedRows = useCallback(() => {
    if (!queryResult?.rows) return []

    let filtered = queryResult.rows

    // Apply search filter
    if (searchTerm.trim()) {
      filtered = filtered.filter(row => 
        row.some(cell => 
          String(cell).toLowerCase().includes(searchTerm.toLowerCase())
        )
      )
    }

    // Apply sorting
    if (sortColumn && queryResult.columns.includes(sortColumn)) {
      const columnIndex = queryResult.columns.indexOf(sortColumn)
      filtered = [...filtered].sort((a, b) => {
        const aVal = String(a[columnIndex] || '')
        const bVal = String(b[columnIndex] || '')
        
        // Try to parse as numbers for numeric sorting
        const aNum = parseFloat(aVal)
        const bNum = parseFloat(bVal)
        
        if (!isNaN(aNum) && !isNaN(bNum)) {
          return sortDirection === 'asc' ? aNum - bNum : bNum - aNum
        }
        
        // String sorting
        return sortDirection === 'asc' 
          ? aVal.localeCompare(bVal)
          : bVal.localeCompare(aVal)
      })
    }

    return filtered
  }, [queryResult, searchTerm, sortColumn, sortDirection])
  
  const editorRef = useRef<any>(null)
  const resizeTimeoutRef = useRef<NodeJS.Timeout | null>(null)
  const exportMenuRef = useRef<HTMLDivElement>(null)
  const currentRequestRef = useRef<string>('') // Track current request to prevent duplicates
  const loadingFromHistoryRef = useRef<boolean>(false) // Track when loading from history to prevent auto-generation
  const programmaticUpdateRef = useRef<boolean>(false) // Track when SQL is updated programmatically

  // Smart suggestions based on context
  const getSmartSuggestions = () => {
    const input = naturalLanguageInput.toLowerCase().trim()
    
    // Define suggestion categories
    const suggestions = {
      starters: [
        { text: "Show all", icon: "👁️", category: "Basic" },
        { text: "Find", icon: "🔍", category: "Basic" },
        { text: "Get", icon: "📥", category: "Basic" },
        { text: "List", icon: "📋", category: "Basic" },
        { text: "Count", icon: "🔢", category: "Aggregation" },
        { text: "Sum of", icon: "➕", category: "Aggregation" },
        { text: "Average", icon: "📊", category: "Aggregation" }
      ],
      entities: [
        { text: "customers", icon: "👥", category: "Tables" },
        { text: "orders", icon: "🛒", category: "Tables" },
        { text: "products", icon: "📦", category: "Tables" },
        { text: "users", icon: "👤", category: "Tables" },
        { text: "sales", icon: "💰", category: "Tables" },
        { text: "employees", icon: "👔", category: "Tables" },
        { text: "inventory", icon: "📊", category: "Tables" }
      ],
      conditions: [
        { text: "where status is active", icon: "✅", category: "Filters" },
        { text: "where amount > 100", icon: "💰", category: "Filters" },
        { text: "where date is today", icon: "📅", category: "Filters" },
        { text: "where name contains", icon: "🔤", category: "Filters" },
        { text: "where id is not null", icon: "🚫", category: "Filters" },
        { text: "where category equals", icon: "🏷️", category: "Filters" }
      ],
      timeFilters: [
        { text: "this month", icon: "📅", category: "Time" },
        { text: "last 30 days", icon: "⏰", category: "Time" },
        { text: "this year", icon: "🗓️", category: "Time" },
        { text: "last week", icon: "📆", category: "Time" },
        { text: "today", icon: "🌅", category: "Time" },
        { text: "yesterday", icon: "🌄", category: "Time" }
      ],
      sorting: [
        { text: "order by name", icon: "🔤", category: "Sorting" },
        { text: "order by date", icon: "📅", category: "Sorting" },
        { text: "order by amount", icon: "💰", category: "Sorting" },
        { text: "order by created date", icon: "⏰", category: "Sorting" },
        { text: "sort by popularity", icon: "⭐", category: "Sorting" }
      ],
      grouping: [
        { text: "group by category", icon: "📊", category: "Grouping" },
        { text: "group by month", icon: "📅", category: "Grouping" },
        { text: "group by department", icon: "🏢", category: "Grouping" },
        { text: "group by status", icon: "🔖", category: "Grouping" }
      ],
      limits: [
        { text: "top 10", icon: "🔟", category: "Limits" },
        { text: "top 5", icon: "5️⃣", category: "Limits" },
        { text: "first 20", icon: "🔢", category: "Limits" },
        { text: "limit to 50", icon: "📏", category: "Limits" }
      ],
      joins: [
        { text: "join with orders", icon: "🔗", category: "Joins" },
        { text: "join with customers", icon: "👥", category: "Joins" },
        { text: "inner join", icon: "⚡", category: "Joins" },
        { text: "left join", icon: "⬅️", category: "Joins" }
      ],
      advanced: [
        { text: "distinct values", icon: "🎯", category: "Advanced" },
        { text: "between dates", icon: "📅", category: "Advanced" },
        { text: "contains text", icon: "🔍", category: "Advanced" },
        { text: "is not null", icon: "✅", category: "Advanced" },
        { text: "having count > 1", icon: "📊", category: "Advanced" }
      ]
    }

    // Determine context-aware suggestions
    if (!input) {
      // Show starters when empty
      return suggestions.starters.slice(0, 8)
    }

    const contextualSuggestions = []

    // If input starts with basic commands, suggest entities
    if (input.match(/^(show|find|get|list|count|sum)/)) {
      contextualSuggestions.push(...suggestions.entities.slice(0, 4))
    }

    // If input contains entities, suggest conditions or time filters
    if (input.match(/(customers|orders|products|users|sales|employees)/)) {
      if (!input.includes('where') && !input.includes('this') && !input.includes('last')) {
        contextualSuggestions.push(...suggestions.conditions.slice(0, 3))
        contextualSuggestions.push(...suggestions.timeFilters.slice(0, 3))
      }
    }

    // If input has conditions, suggest sorting or grouping
    if (input.includes('where') || input.includes('this month') || input.includes('last')) {
      if (!input.includes('order by') && !input.includes('group by')) {
        contextualSuggestions.push(...suggestions.sorting.slice(0, 2))
        contextualSuggestions.push(...suggestions.grouping.slice(0, 2))
      }
    }

    // If input mentions counting or aggregation, suggest grouping
    if (input.match(/(count|sum|average|total)/)) {
      contextualSuggestions.push(...suggestions.grouping.slice(0, 3))
    }

    // If input is getting long, suggest limits
    if (input.length > 20 && !input.includes('top') && !input.includes('limit')) {
      contextualSuggestions.push(...suggestions.limits.slice(0, 2))
    }

    // If input mentions multiple tables or relationships, suggest joins
    if (input.match(/(and|with|from.*and|customers.*orders|orders.*customers)/)) {
      contextualSuggestions.push(...suggestions.joins.slice(0, 2))
    }

    // Always include some advanced options
    contextualSuggestions.push(...suggestions.advanced.slice(0, 2))

    // Remove duplicates and limit to 12 suggestions
    const uniqueSuggestions = contextualSuggestions
      .filter((suggestion, index, self) => 
        index === self.findIndex(s => s.text === suggestion.text)
      )
      .slice(0, 12)

    // If no contextual suggestions, show a mix of all categories
    if (uniqueSuggestions.length < 6) {
      const fallback = [
        ...suggestions.starters.slice(0, 2),
        ...suggestions.entities.slice(0, 2),
        ...suggestions.conditions.slice(0, 2),
        ...suggestions.timeFilters.slice(0, 2),
        ...suggestions.sorting.slice(0, 2),
        ...suggestions.limits.slice(0, 2)
      ]
      return fallback.filter((suggestion, index, self) => 
        index === self.findIndex(s => s.text === suggestion.text)
      ).slice(0, 12)
    }

    return uniqueSuggestions
  }

  // Handle window resize for Monaco Editor
  useEffect(() => {
    const handleResize = () => {
      if (resizeTimeoutRef.current) {
        clearTimeout(resizeTimeoutRef.current)
      }
      
      resizeTimeoutRef.current = setTimeout(() => {
        if (editorRef.current) {
          editorRef.current.layout()
        }
      }, 100)
    }

    window.addEventListener('resize', handleResize)
    
    return () => {
      window.removeEventListener('resize', handleResize)
      if (resizeTimeoutRef.current) {
        clearTimeout(resizeTimeoutRef.current)
      }
    }
  }, [])

  // Close export menu when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (exportMenuRef.current && !exportMenuRef.current.contains(event.target as Node)) {
        setShowExportMenu(false)
      }
    }

    if (showExportMenu) {
      document.addEventListener('mousedown', handleClickOutside)
      return () => document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [showExportMenu])

  // Update smart suggestions when input changes
  useEffect(() => {
    setSmartSuggestions(getSmartSuggestions())
  }, [naturalLanguageInput])

  // Track typing state to prevent auto-generation during active typing
  useEffect(() => {
    setIsTyping(true)
    
    // Clear the previous request ref when user starts typing new content
    const trimmedInput = naturalLanguageInput.trim()
    if (trimmedInput !== currentRequestRef.current) {
      currentRequestRef.current = '' // Clear to allow new generation
    }
    
    const typingTimer = setTimeout(() => {
      setIsTyping(false)
    }, 1000) // Consider user "done typing" after 1 second of inactivity
    
    return () => clearTimeout(typingTimer)
  }, [naturalLanguageInput])

  // Trigger editor layout update when parameters panel shows/hides
  useEffect(() => {
    const timer = setTimeout(() => {
      if (editorRef.current) {
        editorRef.current.layout()
      }
    }, 600) // Delay to allow animation to complete

    return () => clearTimeout(timer)
  }, [shouldShowParameters()])

  // Notification system using toast and global context
  const showNotification = useCallback((notification: { type: 'success' | 'error' | 'warning' | 'info', title: string, message: string, duration?: number }) => {
    // Add to toast
    addToast(notification)
    
    // Add to global notification inbox
    addNotification({
      type: notification.type,
      title: notification.title,
      message: notification.message
    })
  }, [addToast, addNotification])

  // Rate limit timer logic
  useEffect(() => {
    if (healthStatus?.llm?.status === 'rate_limited' && healthStatus?.llm?.rateLimitInfo?.resetTime) {
      const resetTime = new Date(healthStatus.llm.rateLimitInfo.resetTime).getTime()
      const now = Date.now()
      const remainingMs = Math.max(0, resetTime - now)
      const remainingSeconds = Math.ceil(remainingMs / 1000)
      
      setTimeRemaining(remainingSeconds)
      
      if (remainingSeconds > 0) {
        const timer = setInterval(() => {
          setTimeRemaining(prev => {
            if (prev <= 1) {
              clearInterval(timer)
              return 0
            }
            return prev - 1
          })
        }, 1000)
        
        setRateLimitTimer(timer)
        
        return () => {
          clearInterval(timer)
          setRateLimitTimer(null)
        }
      }
    } else {
      setTimeRemaining(0)
      if (rateLimitTimer) {
        clearInterval(rateLimitTimer)
        setRateLimitTimer(null)
      }
    }
  }, [healthStatus?.llm?.status, healthStatus?.llm?.rateLimitInfo?.resetTime, rateLimitTimer])

  // Helper function to check if LLM is rate limited
  const isLLMRateLimited = useCallback(() => {
    return healthStatus?.llm?.status === 'rate_limited' && timeRemaining > 0
  }, [healthStatus?.llm?.status, timeRemaining])

  // Helper function to format time remaining
  const formatTimeRemaining = useCallback((seconds: number) => {
    if (seconds <= 0) return '0s'
    const minutes = Math.floor(seconds / 60)
    const remainingSeconds = seconds % 60
    if (minutes > 0) {
      return `${minutes}m ${remainingSeconds}s`
    }
    return `${remainingSeconds}s`
  }, [])

  // Load query history from profile
  const loadQueryHistory = useCallback(async () => {
    if (!currentProfile) {
      setQueryHistory([])
      return
    }

    setIsLoadingHistory(true)
    try {
      // Fetch the full profile data which includes queries
      const profileData = await apiService.getProfile(currentProfile.id)
      
      if (profileData.queries && Array.isArray(profileData.queries)) {
        // Transform API queries to our QueryHistory format
        const transformedHistory: QueryHistory[] = profileData.queries.map((query: any) => {
          let executionTime: number | undefined
          let success = true
          let error: string | undefined
          let parameters: { [key: string]: string } | undefined

          // Parse resultJson if available
          if (query.resultJson) {
            try {
              const result = JSON.parse(query.resultJson)
              executionTime = result.executionMs
              
              // Extract parameters from the result
              if (result.parameters && typeof result.parameters === 'object') {
                parameters = result.parameters
              }
              
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
                error = result.errorMessage
                success = false
              }
            } catch (e) {
              console.warn('Failed to parse resultJson:', e)
              success = false
              error = 'Failed to parse query result'
            }
          }

          return {
            id: query.id || Date.now().toString(),
            query: query.sqlQuery || query.sql || query.query || '', // Use sqlQuery from API
            naturalLanguage: query.userQuery || query.naturalLanguage || '',
            timestamp: query.timestampUtc ? new Date(query.timestampUtc) : new Date(),
            executionTime,
            success,
            error,
            parameters
          }
        })
        
        // Sort by timestamp (newest first)
        transformedHistory.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime())
        setQueryHistory(transformedHistory)
      } else {
        setQueryHistory([])
      }
    } catch (error) {
      console.error('Failed to load query history:', error)
      showNotification({
        type: 'error',
        title: 'Failed to Load History',
        message: 'Could not load query history from profile',
        duration: 3000
      })
      setQueryHistory([])
    } finally {
      setIsLoadingHistory(false)
    }
  }, [currentProfile, showNotification])

  // Load query history when profile changes
  useEffect(() => {
    loadQueryHistory()
  }, [loadQueryHistory])

  // Handle preloaded queries from QueryHistory
  useEffect(() => {
    if (preloadedQuery) {
      // Set flag to prevent auto-generation while loading from history
      loadingFromHistoryRef.current = true
      
      // Load the query data into the editor
      if (preloadedQuery.shouldExecute) {
        // For "Run Query" - clear natural language to avoid auto-generation, then execute
        setNaturalLanguageInput('')
      } else {
        // For "Load in editor" - load both for editing
        setNaturalLanguageInput(preloadedQuery.naturalLanguage)
      }
      
      // Clear duplicate request tracking for quick templates (no SQL content)
      // This allows auto-generation to work even if the same natural language was used before
      if (!preloadedQuery.sql || preloadedQuery.sql.trim() === '') {
        currentRequestRef.current = '' // Clear to allow fresh auto-generation
      }
      
      // Set flag to indicate this is a programmatic update
      programmaticUpdateRef.current = true
      setSqlQuery(preloadedQuery.sql)
      setQueryAnalysis(null) // Clear analysis when loading from history
      setQueryParameters(null) // Clear parameters when loading from history
      
      // Reset programmatic flag after initial setup to allow auto-generation responses
      setTimeout(() => {
        programmaticUpdateRef.current = false
      }, 50) // Reset quickly after initial setup
      
      // Show notification for new custom query
      if (preloadedQuery.isNewQuery) {
        showNotification({
          type: 'info',
          title: 'Ready to Create!',
          message: 'Start typing your query in natural language and AI will generate the SQL for you.',
          duration: 4000
        })
      }
      
      // Clear the flag with different timing based on content type
      const hasActualSqlContent = preloadedQuery.sql && preloadedQuery.sql.trim() !== ''
      if (hasActualSqlContent) {
        // For actual SQL content (history items), wait longer to prevent auto-generation interference
        setTimeout(() => {
          loadingFromHistoryRef.current = false
        }, 3000)
      } else {
        // For quick templates (natural language only), clear quickly to allow auto-generation
        setTimeout(() => {
          loadingFromHistoryRef.current = false
        }, 100)
      }
      
      // If shouldExecute is true, auto-execute the query
      if (preloadedQuery.shouldExecute && currentProfile) {
        // Small delay to ensure state updates are applied
        setTimeout(() => {
          executeQuery()
        }, 100)
      }
      
      // Notify parent that query has been loaded
      if (onQueryLoaded) {
        onQueryLoaded()
      }
    }
  }, [preloadedQuery, currentProfile, onQueryLoaded])

  // Handle escape key to exit fullscreen
  useEffect(() => {
    const handleEscapeKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && isResultsFullscreen) {
        setIsResultsFullscreen(false)
      }
    }

    document.addEventListener('keydown', handleEscapeKey)
    return () => document.removeEventListener('keydown', handleEscapeKey)
  }, [isResultsFullscreen])

  // Real AI query generation using API
  const generateSQLFromNaturalLanguage = useCallback(async (input: string, isManual: boolean = false) => {
    if (!input.trim() || !currentProfile) return

    // For manual generation, always allow it regardless of duplicate status
    if (!isManual) {
      // Prevent duplicate requests for the same input (only for auto-generation)
      if (currentRequestRef.current === input.trim()) {
        console.log('Request skipped: Duplicate request for same input')
        return
      }

      // Rate limiting: prevent requests more frequent than every 2 seconds
      const now = Date.now()
      if (now - lastRequestTime < 2000) {
        console.log('Rate limiting: Request skipped, too frequent')
        setIsThrottled(true)
        // Clear throttling indicator after the rate limit period
        setTimeout(() => setIsThrottled(false), 2000 - (now - lastRequestTime))
        return
      }
    }

    currentRequestRef.current = input.trim()
    setIsGenerating(true)
    setLastRequestTime(Date.now())
    setIsThrottled(false)

    // Show special notification for local mode
    if (setupType === 'local') {
      showNotification({
        type: 'info',
        title: 'Local AI Processing',
        message: 'Generating SQL using local AI model. This may take longer depending on your PC specifications. Please be patient.',
        duration: 8000
      })
    }
    
    try {
      const userId = userService.getUserId()
      if (!userId) {
        throw new Error('User ID not found. Please complete initial setup.')
      }

      const request: ConvertQueryRequest = {
        UserId: userId,
        profileId: currentProfile.id,
        query: input,
        allowWriteOperations: allowWriteOperations
      }

      // Use extended timeout for local mode (5 minutes), normal timeout for others
      const timeoutMs = setupType === 'local' ? 300000 : 30000
      const response = setupType === 'local' 
        ? await apiService.convertQueryWithTimeout(request, timeoutMs)
        : await apiService.convertQuery(request)
      
      // Console log the full API response for debugging
      console.log('🔍 Full Convert API Response:', JSON.stringify(response, null, 2))
      console.log('🔍 Response keys:', Object.keys(response))
      console.log('🔍 Response.parameters type:', typeof response.parameters)
      console.log('🔍 Response.parameters isArray:', Array.isArray(response.parameters))
      
      // Check for issues first (warnings/notices, not necessarily errors)
      if (response.issues && response.issues.length > 0) {
        console.log('⚠️ API response has issues (warnings):', response.issues)
        
        // Check if this is specifically about destructive operations
        const hasDestructiveIssue = response.issues.some((issue: string) => 
          issue.toLowerCase().includes('destructive') || 
          issue.toLowerCase().includes('allow_destructive') ||
          issue.toLowerCase().includes('write operations')
        )
        
        if (hasDestructiveIssue) {
          showNotification({
            type: 'warning',
            title: 'Write Operations Required',
            message: 'This query requires write operations (INSERT, UPDATE, DELETE). Please enable "Write Mode" to allow these operations.',
            duration: 8000
          })
        } else {
          // Other issues - treat as warnings/notices
          showNotification({
            type: 'warning',
            title: 'Query Generated with Warnings',
            message: response.issues.join('. '),
            duration: 6000
          })
        }
        
        // If there's SQL, the conversion was successful despite warnings
        // Continue to process SQL and parameters normally
        console.log('✅ Conversion successful despite warnings - proceeding with SQL and parameter processing')
      }
      
      // Process SQL and parameters (whether there were issues or not)
      if (response.sql) {
        console.log('✅ Processing successful API response')
        console.log('🔍 Convert Response - SQL:', response.sql.substring(0, 100) + '...')
        console.log('🔍 Convert Response - Parameters received:', response.parameters)
        console.log('🔍 Convert Response - Parameters length:', response.parameters?.length || 0)
        console.log('🔍 Convert Response - Has issues/warnings:', !!(response.issues && response.issues.length > 0))
        console.log('🔍 Convert Response - Parameters details:', response.parameters?.map(p => ({
          name: p.name,
          value: p.value,
          type: typeof p.value,
          source_text: p.source_text
        })))
        
        // Store parameters first and ensure they persist
        const receivedParameters = response.parameters || null
        console.log('💾 Received parameters from API:', receivedParameters)
        
        // Only set SQL if it wasn't already set in the issues section
        if (!programmaticUpdateRef.current) {
          // Set flag to indicate this is a programmatic update
          programmaticUpdateRef.current = true
          
          // Update SQL query first
          setSqlQuery(response.sql)
        }
        
        // Set parameters immediately after SQL, then restore them in a timeout
        // This dual approach handles both immediate state and any potential clearing
        setQueryParameters(receivedParameters)
        console.log('💾 setQueryParameters called immediately with:', receivedParameters)
        
        // Also restore parameters after a brief delay to ensure they survive any state updates
        setTimeout(() => {
          console.log('⏰ Parameter restoration timeout triggered')
          console.log('⏰ receivedParameters:', receivedParameters)
          
          // Always restore the received parameters, regardless of current state
          if (receivedParameters && receivedParameters.length > 0) {
            console.log('🔄 Force restoring parameters after SQL update:', receivedParameters)
            setQueryParameters(receivedParameters)
          }
          
          // Clear the programmatic flag after restoration
          programmaticUpdateRef.current = false
        }, 100) // Increased timeout to 100ms for more reliability
        
        // Store query analysis information
        setQueryAnalysis({
          intent: response.intent || 'Unknown',
          confidence: response.confidence || 0,
          mode: allowWriteOperations ? 'Write' : 'Read-Only',
          explanation: response.explanation || 'No explanation provided',
          safe: response.safe || false,
          tables: response.tables || [],
          columns: response.columns || []
        })
        
        // Show notification based on whether there were issues
        if (response.issues && response.issues.length > 0) {
          // Conversion succeeded but with warnings
          showNotification({
            type: 'success',
            title: 'SQL Generated Successfully!',
            message: `Generated SQL query with ${response.confidence}% confidence. Note: ${response.issues.length} warning(s) require attention.`,
            duration: 5000
          })
        } else {
          // Clean success with no warnings
          showNotification({
            type: 'success',
            title: 'SQL Generated Successfully!',
            message: `Generated SQL query with ${response.confidence}% confidence`,
            duration: 3000
          })
        }
      } else {
        console.error('Failed to generate SQL: No SQL in response', response)
        setQueryAnalysis(null)
        showNotification({
          type: 'error',
          title: 'SQL Generation Failed',
          message: 'The API did not return a valid SQL query',
          duration: 5000
        })
      }
    } catch (error: any) {
      console.error('Failed to generate SQL:', error)
      setQueryAnalysis(null)
      
      // Handle the specific API error format
      let notificationTitle = 'SQL Generation Error'
      let notificationMessage = 'Failed to generate SQL query'
      
      if (error.source && error.errors) {
        // This is an API error with the format you provided
        notificationTitle = `${error.source} (${error.statusCode})`
        
        // Extract the main error message
        if (error.errors.errorMessage) {
          notificationMessage = error.errors.errorMessage
        } else if (typeof error.errors === 'string') {
          notificationMessage = error.errors
        } else if (Array.isArray(error.errors) && error.errors.length > 0) {
          notificationMessage = error.errors[0]
        }
      } else if (error.message) {
        // Standard JavaScript error
        notificationMessage = error.message
      }
      
      showNotification({
        type: 'error',
        title: notificationTitle,
        message: notificationMessage,
        duration: 6000
      })
    } finally {
      setIsGenerating(false)
      // Don't clear currentRequestRef.current here - keep it to prevent duplicate requests
      // Only clear it when user changes input or manually triggers generation
    }
  }, [currentProfile, showNotification, lastRequestTime, setLastRequestTime, setIsThrottled, allowWriteOperations])

  // Auto-generate SQL when natural language input changes
  React.useEffect(() => {
    if (autoGenerate && naturalLanguageInput.trim() && currentProfile && !isTyping && !loadingFromHistoryRef.current) {
      const debounceTimer = setTimeout(() => {
        // Only generate if we're not already generating, input has meaningful length, and not duplicate
        const trimmedInput = naturalLanguageInput.trim()
        if (!isGenerating && 
            trimmedInput.length > 5 && // Minimum 6 characters
            trimmedInput !== currentRequestRef.current && // Not the same as current/last request
            !loadingFromHistoryRef.current) { // Not loading from history
          console.log('Auto-generate triggered for:', trimmedInput.substring(0, 50) + '...')
          generateSQLFromNaturalLanguage(trimmedInput, false) // false = auto-generation
        } else if (trimmedInput === currentRequestRef.current) {
          console.log('Auto-generate skipped: Same input as previous request')
        } else if (isGenerating) {
          console.log('Auto-generate skipped: Already generating')
        } else if (trimmedInput.length <= 5) {
          console.log('Auto-generate skipped: Input too short')
        } else if (loadingFromHistoryRef.current) {
          console.log('Auto-generate skipped: Loading from history')
        }
      }, 2000) // 2 seconds debounce for better rate limiting
      
      return () => clearTimeout(debounceTimer)
    } else if (isTyping) {
      console.log('Auto-generate paused: User is actively typing')
    }
  }, [naturalLanguageInput, autoGenerate, currentProfile, isGenerating, isTyping, generateSQLFromNaturalLanguage])

  // Real query execution using API
  const executeQuery = async () => {
    if (!sqlQuery.trim() || !currentProfile) return

    setIsExecuting(true)
    
    // Prepare user query value for consistent use throughout the function
    const userQueryValue = naturalLanguageInput.trim()
    
    console.log('🚀 Execute Query - queryParameters state:', queryParameters)
    
    try {
      // Transform parameters from array format to Record format
      let transformedParameters: Record<string, any> | null = null
      if (queryParameters && Array.isArray(queryParameters) && queryParameters.length > 0) {
        console.log('✅ Transforming parameters:', queryParameters)
        transformedParameters = {}
        queryParameters.forEach((param: any) => {
          if (param.name && param.value !== undefined) {
            // Remove the @ prefix if present since the backend might expect parameters without it
            const paramName = param.name.startsWith('@') ? param.name.substring(1) : param.name
            
            // Convert all parameter values to strings - SQL parameter system expects string values
            const stringValue = String(param.value)
            transformedParameters![paramName] = stringValue
            
            console.log(`📝 Parameter: ${paramName} = ${param.value} (${typeof param.value}) -> "${stringValue}" (string)`)
          }
        })
      } else {
        console.log('❌ No parameters to transform - queryParameters:', queryParameters)
      }
      
      console.log('📦 Final transformedParameters:', transformedParameters)
      
      const userId = userService.getUserId()
      if (!userId) {
        throw new Error('User ID not found. Please complete initial setup.')
      }
      
      const request: ExecuteQueryRequest = {
        UserId: userId,
        profileId: currentProfile.id,
        sql: sqlQuery,
        userQuery: userQueryValue || "None",
        parameters: transformedParameters, // Use transformed parameters
        mode: allowWriteOperations ? 'Write' : 'ReadOnly'
      }

      const result = await apiService.executeQuery(request)
      
      // Transform API result to our local interface
      const apiResult = result as any // API response might have different field names
      const queryResult: QueryResult = {
        columns: apiResult.columns || [],
        rows: apiResult.rows || [],
        executionTime: apiResult.executionTime || apiResult.executionMs || 0,
        rowsAffected: apiResult.rowCount || apiResult.affectedRows || 0
      }
      
      setQueryResult(queryResult)
      
      // Reset search and sort when new results come in
      setSearchTerm('')
      setSortColumn(null)
      setSortDirection('asc')
      
      showNotification({
        type: 'success',
        title: 'Query Executed Successfully!',
        message: queryResult.columns.length > 0 && queryResult.rows.length > 0
          ? `Retrieved ${queryResult.rows.length} rows in ${queryResult.executionTime}ms`
          : queryResult.rowsAffected > 0
            ? `${queryResult.rowsAffected} rows affected in ${queryResult.executionTime}ms`
            : `Query completed in ${queryResult.executionTime}ms`,
        duration: 3000
      })
      
      // Add to history
      const historyEntry: QueryHistory = {
        id: Date.now().toString(),
        query: sqlQuery,
        naturalLanguage: userQueryValue || "None",
        timestamp: new Date(),
        executionTime: result.executionTime,
        success: true,
        parameters: queryParameters && queryParameters.length > 0 
          ? queryParameters.reduce((acc, param) => {
              if (param.value) {
                acc[param.name] = param.value
              }
              return acc
            }, {} as { [key: string]: string })
          : undefined
      }
      
      setQueryHistory(prev => [historyEntry, ...prev.slice(0, 49)]) // Keep last 50
      
      // Refresh history from profile to get the latest data
      setTimeout(() => {
        loadQueryHistory()
      }, 1000) // Small delay to ensure backend has processed the query
      
    } catch (error: any) {
      console.error('Query execution failed:', error)
      
      // Handle the specific API error format from the backend
      let notificationTitle = 'Query Execution Failed'
      let notificationMessage = 'Failed to execute query'
      let errorDetails = ''
      
      if (error.source && error.errors) {
        // This is an API error with the format you provided
        notificationTitle = `${error.source} (${error.statusCode})`
        
        // Extract the main error message
        if (error.errors.errorMessage) {
          notificationMessage = error.errors.errorMessage
        } else if (typeof error.errors === 'string') {
          notificationMessage = error.errors
        } else if (Array.isArray(error.errors) && error.errors.length > 0) {
          notificationMessage = error.errors[0]
        }
        
        // Create detailed error information for history
        errorDetails = error.errors.errorMessage || notificationMessage
      } else if (error.message) {
        // Standard JavaScript error
        notificationMessage = error.message
        errorDetails = error.message
      } else {
        // Fallback for unknown error types
        notificationMessage = 'An unknown error occurred'
        errorDetails = 'Unknown error'
      }
      
      // Show error notification with enhanced details
      showNotification({
        type: 'error',
        title: notificationTitle,
        message: notificationMessage,
        duration: 8000 // Longer duration for errors
      })
      
      // Add error to history with proper error message
      const historyEntry: QueryHistory = {
        id: Date.now().toString(),
        query: sqlQuery,
        naturalLanguage: userQueryValue || "None",
        timestamp: new Date(),
        success: false,
        error: errorDetails,
        parameters: queryParameters && queryParameters.length > 0 
          ? queryParameters.reduce((acc, param) => {
              if (param.value) {
                acc[param.name] = param.value
              }
              return acc
            }, {} as { [key: string]: string })
          : undefined
      }
      
      setQueryHistory(prev => [historyEntry, ...prev.slice(0, 49)])
      
      // Refresh history from profile to get the latest data
      setTimeout(() => {
        loadQueryHistory()
      }, 1000) // Small delay to ensure backend has processed the query
    } finally {
      setIsExecuting(false)
    }
  }

  const copyQuery = () => {
    navigator.clipboard.writeText(sqlQuery)
    showNotification({
      type: 'success',
      title: 'Query Copied!',
      message: 'SQL query has been copied to clipboard',
      duration: 2000
    })
  }

  const loadFromHistory = (historyItem: QueryHistory) => {
    console.log('📜 Loading from history:', historyItem)
    
    // Scroll to top when loading from history
    // Target the QueryEditor's main scrollable container
    const queryEditorContainer = document.getElementById('query-editor-scroll-container')
    if (queryEditorContainer) {
      queryEditorContainer.scrollTo({ top: 0, behavior: 'smooth' })
    } else {
      // Fallback to window scroll if container not found
      window.scrollTo({ top: 0, behavior: 'smooth' })
    }
    
    setNaturalLanguageInput(historyItem.naturalLanguage)
    // Set flag to indicate this is a programmatic update
    programmaticUpdateRef.current = true
    setSqlQuery(historyItem.query)
    setQueryAnalysis(null) // Clear analysis when loading from history
    
    // Load parameters if they exist
    if (historyItem.parameters && Object.keys(historyItem.parameters).length > 0) {
      console.log('📜 Loading parameters from history:', historyItem.parameters)
      
      // Transform parameters from the history format to our parameter format
      const transformedParameters = Object.entries(historyItem.parameters).map(([key, value]) => ({
        name: key,
        type: 'string', // Default to string type
        value: value,
        source: 'api' as const // Mark as API sourced since it came from history
      }))
      
      setQueryParameters(transformedParameters)
    } else {
      console.log('📜 No parameters in history item')
      setQueryParameters(null) // Clear parameters when loading from history
    }
    
    // Determine if this is a write operation and set the write mode accordingly
    const isReadQuery = isQueryCommand(historyItem.query)
    const shouldAllowWrites = !isReadQuery
    
    console.log('📜 Query type analysis:', {
      query: historyItem.query.substring(0, 50) + '...',
      isReadQuery,
      shouldAllowWrites,
      currentWriteMode: allowWriteOperations
    })
    
    // Only change write mode if it's different from current
    if (allowWriteOperations !== shouldAllowWrites) {
      console.log(`📜 Changing write mode from ${allowWriteOperations} to ${shouldAllowWrites}`)
      setAllowWriteOperations(shouldAllowWrites)
      
      // Show notification about mode change
      showNotification({
        type: 'info',
        title: `Switched to ${shouldAllowWrites ? 'Write' : 'Read-Only'} Mode`,
        message: `Query loaded requires ${shouldAllowWrites ? 'write operations' : 'read-only access'}`,
        duration: 3000
      })
    }
  }

  // Handle manual SQL changes
  const handleSqlChange = (value: string | undefined) => {
    const newSql = value || ''
    setSqlQuery(newSql)
    
    console.log('🔄 handleSqlChange called')
    console.log('🔄 - programmaticUpdateRef.current:', programmaticUpdateRef.current)
    console.log('🔄 - SQL changed:', newSql !== sqlQuery)
    console.log('🔄 - newSql length:', newSql.length)
    console.log('🔄 - queryAnalysis exists:', !!queryAnalysis)
    
    // Detect if this is a manual edit
    const isManualEdit = !programmaticUpdateRef.current && 
                        newSql !== sqlQuery && 
                        newSql.trim() !== ''
    
    if (isManualEdit) {
      console.log('🔄 Manual SQL edit detected - syncing parameters with SQL')
      setQueryAnalysis(null) // Clear analysis for manual edits
      
      // Instead of clearing parameters, sync them with the new SQL
      // This preserves existing parameter values while adding/removing based on SQL changes
      setTimeout(() => {
        syncParametersWithSQL()
      }, 100) // Small delay to ensure SQL state is updated
    } else {
      console.log('📌 Programmatic SQL update - keeping parameters as-is')
      console.log('📌 - Reasons: programmatic=' + programmaticUpdateRef.current + 
                  ', sql unchanged=' + (newSql === sqlQuery) + 
                  ', empty sql=' + (newSql.trim() === ''))
    }
    
    // Reset the programmatic update flag after a delay to handle race conditions
    setTimeout(() => {
      programmaticUpdateRef.current = false
    }, 100)
  }

  // Handle write mode toggle with warning
  const handleWriteModeToggle = () => {
    const newWriteMode = !allowWriteOperations
    setAllowWriteOperations(newWriteMode)
    
    if (newWriteMode) {
      showNotification({
        type: 'warning',
        title: 'Write Mode Enabled',
        message: 'You can now execute INSERT, UPDATE, and DELETE operations. Use with caution!',
        duration: 6000
      })
    } else {
      showNotification({
        type: 'info',
        title: 'Read-Only Mode',
        message: 'Only SELECT queries will be allowed.',
        duration: 3000
      })
    }
  }

  // Handle export functionality
  const handleExport = (format: 'csv' | 'json' | 'excel') => {
    if (!queryResult?.columns || !queryResult?.rows) {
      showNotification({
        type: 'error',
        title: 'Export Failed',
        message: 'No data available to export',
        duration: 4000
      })
      return
    }

    const timestamp = new Date().toISOString().slice(0, 19).replace(/:/g, '-')
    const filename = `query-results-${timestamp}`

    try {
      const columns = queryResult.columns
      const rows = queryResult.rows

      switch (format) {
        case 'csv':
          exportToCSV(columns, rows, `${filename}.csv`)
          break
        case 'json':
          exportToJSON(columns, rows, `${filename}.json`)
          break
        case 'excel':
          exportToExcel(columns, rows, `${filename}.xls`)
          break
      }

      showNotification({
        type: 'success',
        title: 'Export Successful',
        message: `Data exported as ${format.toUpperCase()}`,
        duration: 3000
      })

      setShowExportMenu(false)
    } catch (error) {
      console.error('Export error:', error)
      showNotification({
        type: 'error',
        title: 'Export Failed',
        message: 'An error occurred while exporting data',
        duration: 4000
      })
    }
  }

  return (
    <>
      {/* Main Container */}
      <motion.div 
        className="flex flex-col bg-background h-full w-full"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
      >
        {/* Fixed Header */}
        <motion.div 
          className="flex-shrink-0 border-b border-border bg-card p-3 md:p-4 lg:p-6"
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
        >
          <div className="max-w-7xl mx-auto">
            <div className="flex flex-col space-y-3 lg:flex-row lg:items-center lg:justify-between lg:space-y-0">
              {/* Left: Title and Profile */}
              <div className="flex flex-col space-y-2 sm:flex-row sm:items-center sm:space-y-0 sm:space-x-4 lg:space-x-6">
                <div className="flex items-center space-x-3">
                  <div className="p-2 bg-blue-600 rounded-lg">
                    <Brain className="w-4 h-4 sm:w-5 sm:h-5 text-white" />
                  </div>
                  <div>
                    <h1 className="text-lg sm:text-xl font-semibold text-foreground">
                      AI SQL Studio
                    </h1>
                    <p className="text-xs sm:text-sm text-muted-foreground">Natural language to SQL converter</p>
                  </div>
                </div>
                
                {currentProfile && (
                  <div className="flex items-center space-x-2 px-3 py-1.5 bg-muted rounded-md border border-border">
                    <Database className="w-4 h-4 text-primary" />
                    <span className="text-sm font-medium text-foreground truncate">
                      {currentProfile.databaseName || 'Database'}
                    </span>
                  </div>
                )}
              </div>

              {/* Right: Controls */}
              <div className="flex items-center space-x-2 sm:space-x-3">
                <Button
                  variant={autoGenerate ? "default" : "outline"}
                  size="sm"
                  onClick={() => setAutoGenerate(!autoGenerate)}
                  className="text-xs sm:text-sm"
                >
                  <Zap className="w-3 h-3 sm:w-4 sm:h-4 mr-1 sm:mr-2" />
                  <span className="hidden sm:inline">Auto-Generate</span>
                  <span className="sm:hidden">Auto</span>
                </Button>
                
                <Button
                  variant={allowWriteOperations ? "destructive" : "outline"}
                  size="sm"
                  onClick={handleWriteModeToggle}
                  className="text-xs sm:text-sm"
                  title={allowWriteOperations ? "Write operations enabled (INSERT, UPDATE, DELETE)" : "Read-only mode (SELECT only)"}
                >
                  <Database className="w-3 h-3 sm:w-4 sm:h-4 mr-1 sm:mr-2" />
                  <span className="hidden lg:inline">
                    {allowWriteOperations ? 'Write Mode' : 'Read-Only'}
                  </span>
                  <span className="lg:hidden">
                    {allowWriteOperations ? 'Write' : 'Read'}
                  </span>
                </Button>
              </div>
            </div>
          </div>
        </motion.div>

        {/* Scrollable Main Content */}
        <div className="flex-1 overflow-auto scrollbar-hide" id="query-editor-scroll-container">
          <div className="max-w-6xl mx-auto p-3 sm:p-4 md:p-6 lg:p-8 space-y-4 sm:space-y-5 lg:space-y-6">
            
            {/* Natural Language Input Section - Hidden in basic mode */}
            {setupType !== 'basic' && (
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.2 }}
                className="space-y-4"
              >
              <div className="flex items-center space-x-2">
                <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center">
                  <span className="text-white font-semibold text-sm">1</span>
                </div>
                <h2 className="text-lg font-semibold text-foreground">Describe your query</h2>
                {isGenerating && (
                  <div className="flex items-center space-x-2">
                    <Loader2 className="w-4 h-4 animate-spin text-blue-600" />
                    <span className="text-sm text-muted-foreground">
                      {setupType === 'local' ? 'Processing with local AI (may take longer)...' : 'Generating...'}
                    </span>
                  </div>
                )}
                {!isGenerating && isThrottled && autoGenerate && (
                  <div className="flex items-center space-x-2">
                    <Clock className="w-4 h-4 text-orange-500" />
                    <span className="text-sm text-orange-600">
                      Rate limited - Auto-generate will resume shortly
                    </span>
                  </div>
                )}
                {!isGenerating && !isThrottled && isTyping && autoGenerate && naturalLanguageInput.trim() && (
                  <div className="flex items-center space-x-2">
                    <div className="w-4 h-4 flex items-center justify-center">
                      <div className="w-2 h-2 bg-primary rounded-full animate-pulse"></div>
                    </div>
                    <span className="text-sm text-primary">
                      Typing... Auto-generate will trigger when you pause
                    </span>
                  </div>
                )}
              </div>
              
              <Card className="border border-border shadow-sm bg-card">
                <CardContent className="p-6">
                  <div className="space-y-4">
                    {/* Rate Limit Warning */}
                    {isLLMRateLimited() && (
                      <div className="bg-orange-50 dark:bg-orange-900/20 border border-orange-200 dark:border-orange-800 rounded-lg p-4 mb-4">
                        <div className="flex items-center space-x-3">
                          <Clock className="w-5 h-5 text-orange-500" />
                          <div className="flex-1">
                            <h4 className="text-sm font-medium text-orange-800 dark:text-orange-200">
                              LLM Service Rate Limited
                            </h4>
                            <p className="text-sm text-orange-700 dark:text-orange-300 mt-1">
                              You've reached the rate limit for the LLM service. Query generation will resume in:
                            </p>
                            <div className="mt-2">
                              <div className="inline-flex items-center space-x-2 bg-orange-100 dark:bg-orange-900/50 px-3 py-1 rounded-full">
                                <Clock className="w-4 h-4 text-orange-600" />
                                <span className="text-sm font-mono font-medium text-orange-800 dark:text-orange-200">
                                  {formatTimeRemaining(timeRemaining)}
                                </span>
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>
                    )}

                    <textarea
                      className={cn(
                        "w-full h-24 sm:h-28 md:h-32 p-3 sm:p-4 border border-border rounded-lg bg-card text-foreground placeholder:text-muted-foreground resize-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors text-sm sm:text-base",
                        isLLMRateLimited() && "opacity-60 cursor-not-allowed bg-muted"
                      )}
                      placeholder={isLLMRateLimited() 
                        ? "Query generation is temporarily unavailable due to rate limiting..."
                        : "Describe what data you want to retrieve in natural language...\n\nExamples:\n• Show me all users who placed orders last month\n• Count total active customers\n• Find top 10 products by revenue\n• Get all customers from New York with their order history"
                      }
                      value={naturalLanguageInput}
                      onChange={(e) => setNaturalLanguageInput(e.target.value)}
                      disabled={isLLMRateLimited()}
                    />
                    
                    {/* Smart Query Suggestions */}
                    <div className="space-y-3">
                      <div className="flex items-center justify-between">
                        <div className="text-sm font-medium text-foreground">
                          {naturalLanguageInput.trim() ? 'Continue with:' : 'Quick suggestions:'}
                        </div>
                        {naturalLanguageInput.trim() && (
                          <div className="text-xs text-muted-foreground">
                            Smart suggestions based on your query
                          </div>
                        )}
                      </div>
                      <div className="flex flex-wrap gap-2">
                        {smartSuggestions.map((suggestion, index) => (
                          <button
                            key={index}
                            onClick={() => {
                              const currentText = naturalLanguageInput.trim()
                              const newText = currentText ? `${currentText} ${suggestion.text}` : suggestion.text
                              setNaturalLanguageInput(newText)
                            }}
                            className="group flex items-center space-x-1.5 px-3 py-1.5 text-xs bg-muted text-foreground rounded-md border border-border hover:bg-accent hover:border-accent-foreground transition-all duration-200 hover:scale-105"
                            title={`${suggestion.category}: ${suggestion.text}`}
                          >
                            <span className="text-xs">{suggestion.icon}</span>
                            <span>{suggestion.text}</span>
                            <div className="text-xs opacity-0 group-hover:opacity-70 transition-opacity px-1 py-0.5 bg-muted rounded text-[10px]">
                              {suggestion.category}
                            </div>
                          </button>
                        ))}
                      </div>
                      
                      {/* Category indicator */}
                      {naturalLanguageInput.trim() && (
                        <div className="flex items-center space-x-2 text-xs text-muted-foreground">
                          <span>💡</span>
                          <span>Suggestions adapt as you type - try adding more details!</span>
                        </div>
                      )}
                    </div>

                    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between space-y-3 sm:space-y-0">
                      <div className="flex flex-col sm:flex-row sm:items-center space-y-3 sm:space-y-0 sm:space-x-4">
                        <Button
                          onClick={() => generateSQLFromNaturalLanguage(naturalLanguageInput, true)}
                          disabled={!naturalLanguageInput.trim() || isGenerating}
                          className="bg-blue-600 hover:bg-blue-700 text-white px-6"
                        >
                          {isGenerating ? (
                            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                          ) : (
                            <Sparkles className="w-4 h-4 mr-2" />
                          )}
                          Generate SQL
                        </Button>
                        
                        {sqlQuery && (
                          <div className="flex items-center space-x-2 text-green-600">
                            <CheckCircle className="w-5 h-5" />
                            <span className="text-sm font-medium">SQL generated successfully!</span>
                          </div>
                        )}
                      </div>
                      
                      {naturalLanguageInput.trim() && (
                        <Button 
                          variant="outline" 
                          size="sm"
                          onClick={() => {
                            setNaturalLanguageInput('')
                            setSqlQuery('')
                            setQueryAnalysis(null)
                            setQueryParameters(null)
                          }}
                        >
                          <RotateCcw className="w-4 h-4 mr-2" />
                          Clear
                        </Button>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
            )}

            {/* SQL Editor Section */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3 }}
              className="space-y-4"
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-2">
                  <div className="w-8 h-8 bg-green-600 rounded-lg flex items-center justify-center">
                    <span className="text-white font-semibold text-sm">2</span>
                  </div>
                  <h2 className="text-lg font-semibold text-foreground">Review and edit SQL</h2>
                  {sqlQuery && (
                    <span className="text-sm text-muted-foreground">
                      {sqlQuery.split('\n').length} lines
                    </span>
                  )}
                  {/* Mode indicator */}
                  <div className={`px-2 py-1 rounded-full text-xs font-medium ${
                    allowWriteOperations 
                      ? 'bg-destructive/20 text-destructive' 
                      : 'bg-green-500/10 text-green-600 dark:text-green-400'
                  }`}>
                    {allowWriteOperations ? 'Write Mode' : 'Read-Only'}
                  </div>
                </div>
                
                <div className="flex flex-wrap items-center gap-2 sm:gap-3">
                  <Button 
                    variant="outline" 
                    size="sm" 
                    onClick={copyQuery} 
                    disabled={!sqlQuery}
                    className="text-xs sm:text-sm"
                  >
                    <Copy className="w-3 h-3 sm:w-4 sm:h-4 mr-1 sm:mr-2" />
                    <span className="hidden sm:inline">Copy</span>
                    <span className="sm:hidden">Copy</span>
                  </Button>
                  <Button 
                    onClick={executeQuery} 
                    disabled={!sqlQuery.trim() || isExecuting}
                    className="bg-green-600 hover:bg-green-700 text-white text-xs sm:text-sm"
                    size="sm"
                  >
                    {isExecuting ? (
                      <Loader2 className="w-3 h-3 sm:w-4 sm:h-4 mr-1 sm:mr-2 animate-spin" />
                    ) : (
                      <Play className="w-3 h-3 sm:w-4 sm:h-4 mr-1 sm:mr-2" />
                    )}
                    <span className="hidden sm:inline">Execute</span>
                    <span className="sm:hidden">Run</span>
                  </Button>
                </div>
              </div>
              
              {/* SQL Editor and Parameters Side by Side */}
              <div className="flex flex-col xl:flex-row gap-3 sm:gap-4 lg:gap-6 w-full">
                {/* SQL Editor */}
                <motion.div 
                  className="flex-1 min-w-0 order-2 xl:order-1"
                  layout="size"
                  transition={{ duration: 0.4, ease: [0.25, 0.46, 0.45, 0.94] }}
                >
                  <Card className="border border-border shadow-sm bg-card">
                    <CardContent className="p-0">
                      <div className="h-48 sm:h-56 lg:h-64 xl:h-72 rounded-lg overflow-hidden">
                        <Editor
                          height="100%"
                          defaultLanguage="sql"
                          value={sqlQuery || '-- Your generated SQL query will appear here\n-- Start by describing your query in natural language above'}
                          onChange={handleSqlChange}
                          theme={theme === 'dark' ? 'vs-dark' : 'vs'}
                          options={{
                            minimap: { enabled: false },
                            scrollBeyondLastLine: false,
                            fontSize: 14,
                            lineNumbers: 'on',
                            roundedSelection: false,
                            wordWrap: 'on',
                            scrollbar: {
                              vertical: 'auto',
                              horizontal: 'auto',
                              useShadows: false,
                              verticalHasArrows: true,
                              horizontalHasArrows: true,
                              arrowSize: 11,
                              verticalScrollbarSize: 14,
                              horizontalScrollbarSize: 14
                            },
                            automaticLayout: true,
                            padding: { top: 16, bottom: 16 },
                            suggestOnTriggerCharacters: true,
                            quickSuggestions: true,
                            renderLineHighlight: 'line',
                            selectionHighlight: false,
                            renderWhitespace: 'none',
                            fontFamily: 'JetBrains Mono, Monaco, Consolas, "Liberation Mono", "Courier New", monospace',
                            fontLigatures: true,
                            smoothScrolling: true,
                            cursorSmoothCaretAnimation: 'on',
                            renderValidationDecorations: 'on'
                          }}
                          onMount={(editor) => {
                            editorRef.current = editor
                            // Force initial layout after mount
                            setTimeout(() => {
                              if (editor) {
                                editor.layout()
                              }
                            }, 100)
                          }}
                        />
                      </div>
                    </CardContent>
                  </Card>
                </motion.div>

                {/* Parameters Panel with AnimatePresence */}
                <AnimatePresence mode="wait">
                  {shouldShowParameters() && (
                    <motion.div
                      key="parameters-panel"
                      initial={{ opacity: 0, width: 0, scale: 0.9 }}
                      animate={{ 
                        opacity: 1, 
                        width: "auto", 
                        scale: 1,
                        transition: { 
                          duration: 0.4, 
                          ease: [0.25, 0.46, 0.45, 0.94],
                          width: { duration: 0.4, ease: [0.25, 0.46, 0.45, 0.94] }
                        }
                      }}
                      exit={{ 
                        opacity: 0, 
                        width: 0, 
                        scale: 0.9,
                        transition: { 
                          duration: 0.4, 
                          ease: [0.25, 0.46, 0.45, 0.94],
                          width: { duration: 0.4, ease: [0.25, 0.46, 0.45, 0.94] }
                        }
                      }}
                      className="flex-shrink-0 w-full sm:w-[30rem] lg:w-[34rem] xl:w-[38rem] overflow-hidden order-1 xl:order-2"
                    >
                      <Card className="border border-orange-200 shadow-sm bg-card h-48 sm:h-56 lg:h-64 xl:h-72 overflow-hidden">
                        <CardContent className="p-5 h-full flex flex-col">
                          <motion.div 
                            className="flex items-center space-x-2 mb-4"
                            initial={{ opacity: 0, y: -10 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ 
                              opacity: 0, 
                              y: -10,
                              transition: { duration: 0.3, ease: "easeInOut" }
                            }}
                            transition={{ delay: 0.1, duration: 0.3 }}
                          >
                            <motion.div 
                              className="w-6 h-6 bg-orange-600 rounded-md flex items-center justify-center"
                              whileHover={{ scale: 1.1 }}
                              whileTap={{ scale: 0.95 }}
                              exit={{ 
                                scale: 0.9, 
                                transition: { duration: 0.2 }
                              }}
                            >
                              <Settings className="w-4 h-4 text-white" />
                            </motion.div>
                            <h3 className="text-sm font-semibold text-foreground">Parameters</h3>
                            {allowWriteOperations && (
                              <motion.div 
                                className="px-2 py-1 rounded text-xs font-medium bg-orange-500/10 text-orange-600 dark:text-orange-400"
                                initial={{ scale: 0, opacity: 0 }}
                                animate={{ scale: 1, opacity: 1 }}
                                exit={{ 
                                  scale: 0, 
                                  opacity: 0,
                                  transition: { duration: 0.25, ease: "easeInOut" }
                                }}
                                transition={{ delay: 0.2, type: "spring", stiffness: 300 }}
                              >
                                Write Mode
                              </motion.div>
                            )}
                          </motion.div>
                          
                          <motion.div 
                            className="flex-1 overflow-y-auto space-y-4 pr-1"
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ 
                              opacity: 0,
                              transition: { duration: 0.3, ease: "easeInOut" }
                            }}
                            transition={{ delay: 0.15, duration: 0.3 }}
                          >
                            <AnimatePresence mode="popLayout">
                              {getDisplayParameters().map((param, index) => (
                                <motion.div
                                  key={`${param.name}-${index}`}
                                  initial={{ opacity: 0, y: 15, scale: 0.95 }}
                                  animate={{ opacity: 1, y: 0, scale: 1 }}
                                  exit={{ 
                                    opacity: 0, 
                                    y: 15, 
                                    scale: 0.95,
                                    transition: { 
                                      duration: 0.35, 
                                      ease: "easeInOut",
                                      delay: (getDisplayParameters().length - 1 - index) * 0.05 // Reverse stagger for exit
                                    }
                                  }}
                                  transition={{ 
                                    delay: index * 0.08,
                                    duration: 0.35,
                                    type: "spring",
                                    stiffness: 400,
                                    damping: 25
                                  }}
                                  layout
                                  layoutId={`param-${param.name}`} // Helps with layout animations
                                  className={`p-4 rounded-lg border text-xs transition-colors duration-200 ${
                                    param.source === 'api' 
                                      ? 'bg-blue-500/10 border-blue-500/20 dark:bg-blue-500/10 dark:border-blue-500/20' 
                                      : param.source === 'detected'
                                      ? 'bg-yellow-500/10 border-yellow-500/20 dark:bg-yellow-500/10 dark:border-yellow-500/20'
                                      : param.source === 'manual'
                                      ? 'bg-green-500/10 border-green-500/20 dark:bg-green-500/10 dark:border-green-500/20'
                                      : 'bg-muted border-border'
                                  }`}
                                  whileHover={{ 
                                    scale: 1.02,
                                    transition: { duration: 0.2 }
                                  }}
                                >
                                  <div className="space-y-3">
                                    <div className="flex items-center justify-between">
                                      <span className="font-mono text-sm font-semibold text-foreground">
                                        @{param.name}
                                      </span>
                                      <div className="flex items-center gap-1">
                                        {param.source !== 'placeholder' && (
                                          <>
                                            <motion.div whileHover={{ scale: 1.1 }} whileTap={{ scale: 0.9 }}>
                                              <Button
                                                variant="ghost"
                                                size="sm"
                                                onClick={() => {
                                                  if (editingParam === param.name) {
                                                    updateParameterValue(param.name, editingValue)
                                                    setEditingParam(null)
                                                    setEditingValue('')
                                                  } else {
                                                    setEditingParam(param.name)
                                                    setEditingValue(param.value || '')
                                                  }
                                                }}
                                                className="h-auto p-1"
                                              >
                                                {editingParam === param.name ? <Save className="w-3 h-3" /> : <Edit3 className="w-3 h-3" />}
                                              </Button>
                                            </motion.div>
                                            <motion.div whileHover={{ scale: 1.1 }} whileTap={{ scale: 0.9 }}>
                                              <Button
                                                variant="ghost"
                                                size="sm"
                                                onClick={() => {
                                                  navigator.clipboard.writeText(`@${param.name}`)
                                                  addToast({
                                                    type: 'success',
                                                    title: 'Copied',
                                                    message: `Parameter @${param.name} copied`,
                                                    duration: 2000
                                                  })
                                                }}
                                                className="h-auto p-1"
                                              >
                                                <Copy className="w-3 h-3" />
                                              </Button>
                                            </motion.div>
                                            {(param.source === 'manual' || param.source === 'detected') && param.value && (
                                              <motion.div whileHover={{ scale: 1.1 }} whileTap={{ scale: 0.9 }}>
                                                <Button
                                                  variant="ghost"
                                                  size="sm"
                                                  onClick={() => {
                                                    console.log(`🔥 Delete button clicked for param:`, param.name)
                                                    console.log(`🔥 Full param object:`, param)
                                                    removeParameter(param.name)
                                                  }}
                                                  className="h-auto p-1 text-red-600 dark:text-red-400 hover:text-red-700 dark:hover:text-red-300"
                                                >
                                                  <Trash2 className="w-3 h-3" />
                                                </Button>
                                              </motion.div>
                                            )}
                                          </>
                                        )}
                                      </div>
                                    </div>
                                    
                                    <div className="flex items-center space-x-2">
                                      <motion.span 
                                        className={`px-2 py-1 rounded text-xs font-medium ${
                                          param.source === 'api' 
                                            ? 'bg-blue-500/10 text-blue-600 dark:text-blue-400' 
                                            : param.source === 'detected'
                                            ? 'bg-yellow-500/10 text-yellow-600 dark:text-yellow-400'
                                            : param.source === 'manual'
                                            ? 'bg-green-500/10 text-green-600 dark:text-green-400'
                                            : 'bg-muted text-muted-foreground'
                                        }`}
                                        initial={{ scale: 0, opacity: 0 }}
                                        animate={{ scale: 1, opacity: 1 }}
                                        exit={{ 
                                          scale: 0.8, 
                                          opacity: 0,
                                          transition: { duration: 0.15, ease: "easeIn" }
                                        }}
                                        transition={{ delay: index * 0.08 + 0.15, duration: 0.25 }}
                                      >
                                        {param.type}
                                      </motion.span>
                                      <motion.span 
                                        className={`px-2 py-1 rounded text-xs font-medium ${
                                          param.source === 'api' 
                                            ? 'bg-blue-500/10 text-blue-600 dark:text-blue-400' 
                                            : param.source === 'detected'
                                            ? 'bg-yellow-500/10 text-yellow-600 dark:text-yellow-400'
                                            : param.source === 'manual'
                                            ? 'bg-green-500/10 text-green-600 dark:text-green-400'
                                            : 'bg-muted text-muted-foreground'
                                        }`}
                                        initial={{ scale: 0, opacity: 0 }}
                                        animate={{ scale: 1, opacity: 1 }}
                                        exit={{ 
                                          scale: 0.8, 
                                          opacity: 0,
                                          transition: { duration: 0.15, ease: "easeIn", delay: 0.02 }
                                        }}
                                        transition={{ delay: index * 0.08 + 0.2, duration: 0.25 }}
                                      >
                                        {param.source === 'api' ? 'API' : param.source === 'detected' ? 'Detected' : param.source === 'manual' ? 'Manual' : 'Example'}
                                      </motion.span>
                                    </div>
                                    
                                    <motion.div 
                                      className="space-y-1"
                                      initial={{ opacity: 0, y: 5 }}
                                      animate={{ opacity: 1, y: 0 }}
                                      exit={{ 
                                        opacity: 0, 
                                        y: -5,
                                        transition: { duration: 0.2, ease: "easeIn" }
                                      }}
                                      transition={{ delay: index * 0.08 + 0.25, duration: 0.25 }}
                                    >
                                      {editingParam === param.name ? (
                                        <Input
                                          value={editingValue}
                                          onChange={(e) => setEditingValue(e.target.value)}
                                          onBlur={() => {
                                            // Auto-save when user leaves the input field
                                            if (editingValue.trim() !== '') {
                                              updateParameterValue(param.name, editingValue)
                                            }
                                            setEditingParam(null)
                                            setEditingValue('')
                                          }}
                                          onKeyDown={(e) => {
                                            if (e.key === 'Enter') {
                                              updateParameterValue(param.name, editingValue)
                                              setEditingParam(null)
                                              setEditingValue('')
                                            } else if (e.key === 'Escape') {
                                              setEditingParam(null)
                                              setEditingValue('')
                                            }
                                          }}
                                          className="font-mono text-sm py-2.5"
                                          placeholder="Enter parameter value..."
                                          autoFocus
                                        />
                                      ) : (
                                        <div 
                                          className={`p-3 rounded border font-mono text-sm cursor-pointer hover:bg-muted transition-colors ${
                                            param.source === 'placeholder'
                                              ? 'bg-muted border-border text-muted-foreground italic'
                                              : 'bg-card border-border text-foreground'
                                          }`}
                                          onClick={() => {
                                            if (param.source !== 'placeholder') {
                                              setEditingParam(param.name)
                                              setEditingValue(param.value || '')
                                            }
                                          }}
                                        >
                                          {param.value || (param.source === 'detected' ? 'Click to set value' : param.value)}
                                        </div>
                                      )}
                                    </motion.div>
                                    
                                    {param.source === 'detected' && !param.value && editingParam !== param.name && (
                                      <motion.div 
                                        className="text-xs text-yellow-600"
                                        initial={{ opacity: 0, x: -10 }}
                                        animate={{ opacity: 1, x: 0 }}
                                        exit={{ 
                                          opacity: 0, 
                                          x: -5,
                                          transition: { duration: 0.15, ease: "easeIn" }
                                        }}
                                        transition={{ delay: index * 0.08 + 0.3, duration: 0.25 }}
                                      >
                                        ⚠️ No value provided - click to edit
                                      </motion.div>
                                    )}
                                    
                                    {param.source === 'placeholder' && (
                                      <motion.div 
                                        className="text-xs text-muted-foreground"
                                        initial={{ opacity: 0, x: -10 }}
                                        animate={{ opacity: 1, x: 0 }}
                                        exit={{ 
                                          opacity: 0, 
                                          x: -5,
                                          transition: { duration: 0.15, ease: "easeIn" }
                                        }}
                                        transition={{ delay: index * 0.08 + 0.3, duration: 0.25 }}
                                      >
                                        💡 Use @param syntax in queries
                                      </motion.div>
                                    )}
                                  </div>
                                </motion.div>
                              ))}
                            </AnimatePresence>
                            
                            {/* Add Parameter Button */}
                            {allowWriteOperations && (
                              <motion.div
                                initial={{ opacity: 0, y: 10 }}
                                animate={{ opacity: 1, y: 0 }}
                                exit={{ opacity: 0, y: -10 }}
                                transition={{ delay: 0.2 }}
                                className="pt-2"
                              >
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={addNewParameter}
                                  className="w-full border-dashed border-2 hover:border-solid text-muted-foreground hover:text-foreground"
                                >
                                  <Plus className="w-4 h-4 mr-2" />
                                  Add Parameter
                                </Button>
                              </motion.div>
                            )}
                            
                            {getDisplayParameters().length === 0 && allowWriteOperations && (
                              <motion.div 
                                className="text-center py-6 text-muted-foreground"
                                initial={{ opacity: 0, scale: 0.9 }}
                                animate={{ opacity: 1, scale: 1 }}
                                exit={{ 
                                  opacity: 0, 
                                  scale: 0.9,
                                  transition: { duration: 0.3, ease: "easeInOut" }
                                }}
                                transition={{ delay: 0.2, type: "spring", stiffness: 200 }}
                              >
                                <motion.div
                                  animate={{ 
                                    rotate: [0, 5, -5, 0],
                                    scale: [1, 1.1, 1]
                                  }}
                                  transition={{ 
                                    duration: 2,
                                    repeat: Infinity,
                                    repeatDelay: 3
                                  }}
                                  exit={{ 
                                    rotate: 0, 
                                    scale: 0.9,
                                    transition: { duration: 0.25, ease: "easeInOut" }
                                  }}
                                >
                                  <Settings className="w-6 h-6 mx-auto mb-2 opacity-50" />
                                </motion.div>
                                <p className="text-xs">No parameters detected</p>
                                <p className="text-xs mt-1">Use @param_name syntax or add manually</p>
                              </motion.div>
                            )}
                          </motion.div>
                        </CardContent>
                      </Card>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            </motion.div>

            {/* Query Analysis Section */}
            {queryAnalysis && (
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.35 }}
                className="space-y-4"
              >
                <div className="flex items-center space-x-2">
                  <div className="w-8 h-8 bg-indigo-600 rounded-lg flex items-center justify-center">
                    <Brain className="w-5 h-5 text-white" />
                  </div>
                  <h2 className="text-lg font-semibold text-foreground">Query Analysis</h2>
                </div>
                
                <Card className="border border-border shadow-sm bg-card">
                  <CardContent className="p-4 lg:p-6">
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
                      {/* Intent */}
                      <div className="space-y-2">
                        <label className="text-sm font-medium text-foreground">Intent</label>
                        <div className="p-3 bg-blue-500/10 rounded-lg border border-blue-500/20">
                          <span className="text-blue-600 dark:text-blue-400 font-medium capitalize">
                            {queryAnalysis.intent}
                          </span>
                        </div>
                      </div>

                      {/* Confidence */}
                      <div className="space-y-2">
                        <label className="text-sm font-medium text-foreground">Confidence</label>
                        <div className="p-3 bg-green-500/10 rounded-lg border border-green-500/20">
                          <div className="flex items-center space-x-2">
                            <span className="text-green-600 dark:text-green-400 font-medium">
                              {queryAnalysis.confidence}%
                            </span>
                            <div className="flex-1 bg-green-500/20 rounded-full h-2">
                              <div 
                                className="bg-green-600 dark:bg-green-400 h-2 rounded-full transition-all duration-300"
                                style={{ width: `${queryAnalysis.confidence}%` }}
                              />
                            </div>
                          </div>
                        </div>
                      </div>

                      {/* Mode */}
                      <div className="space-y-2">
                        <label className="text-sm font-medium text-foreground">Mode</label>
                        <div className={`p-3 rounded-lg border ${
                          queryAnalysis.mode === 'Write' 
                            ? 'bg-red-500/10 border-red-500/20' 
                            : 'bg-muted border-border'
                        }`}>
                          <span className={`font-medium ${
                            queryAnalysis.mode === 'Write' 
                              ? 'text-red-600 dark:text-red-400' 
                              : 'text-foreground'
                          }`}>
                            {queryAnalysis.mode}
                          </span>
                        </div>
                      </div>

                      {/* Safety */}
                      <div className="space-y-2">
                        <label className="text-sm font-medium text-foreground">Safety</label>
                        <div className={`p-3 rounded-lg border ${
                          queryAnalysis.safe 
                            ? 'bg-green-500/10 border-green-500/20' 
                            : 'bg-yellow-500/10 border-yellow-500/20'
                        }`}>
                          <div className="flex items-center space-x-2">
                            {queryAnalysis.safe ? (
                              <CheckCircle className="w-4 h-4 text-green-600 dark:text-green-400" />
                            ) : (
                              <AlertCircle className="w-4 h-4 text-yellow-600 dark:text-yellow-400" />
                            )}
                            <span className={`font-medium ${
                              queryAnalysis.safe 
                                ? 'text-green-600 dark:text-green-400' 
                                : 'text-yellow-600 dark:text-yellow-400'
                            }`}>
                              {queryAnalysis.safe ? 'Safe' : 'Caution'}
                            </span>
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Explanation */}
                    <div className="space-y-3">
                      <label className="text-sm font-medium text-foreground">Explanation</label>
                      <div className="p-4 bg-muted rounded-lg border border-border">
                        <p className="text-foreground leading-relaxed">
                          {queryAnalysis.explanation}
                        </p>
                      </div>
                    </div>

                    {/* Tables and Columns */}
                    {(queryAnalysis.tables.length > 0 || queryAnalysis.columns.length > 0) && (
                      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mt-6">
                        {/* Tables */}
                        {queryAnalysis.tables.length > 0 && (
                          <div className="space-y-3">
                            <label className="text-sm font-medium text-foreground">
                              Tables ({queryAnalysis.tables.length})
                            </label>
                            <div className="flex flex-wrap gap-2">
                              {queryAnalysis.tables.map((table, index) => (
                                <span 
                                  key={index}
                                  className="px-3 py-1 bg-purple-500/10 text-purple-600 dark:text-purple-400 rounded-full text-sm font-medium"
                                >
                                  {table}
                                </span>
                              ))}
                            </div>
                          </div>
                        )}

                        {/* Columns */}
                        {queryAnalysis.columns.length > 0 && (
                          <div className="space-y-3">
                            <label className="text-sm font-medium text-foreground">
                              Columns ({queryAnalysis.columns.length})
                            </label>
                            <div className="flex flex-wrap gap-2">
                              {queryAnalysis.columns.map((column, index) => (
                                <span 
                                  key={index}
                                  className="px-3 py-1 bg-orange-500/10 text-orange-600 dark:text-orange-400 rounded-full text-sm font-medium"
                                >
                                  {column}
                                </span>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    )}
                  </CardContent>
                </Card>
              </motion.div>
            )}

            {/* Results and History Section */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.45 }}
              className="results-history-container relative"
              style={{
                display: 'grid',
                gridTemplateColumns: resultsWidth >= 80 
                  ? '1fr' // When Results is very wide, stack History below
                  : `${resultsWidth}% 1fr`, // Normal side-by-side layout
                gap: '1rem',
                gridTemplateRows: resultsWidth >= 80 ? 'auto auto' : 'auto'
              }}
            >
              {/* Fullscreen Backdrop */}
              <AnimatePresence>
                {isResultsFullscreen && (
                  <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.3 }}
                    className="fixed inset-0 z-[9998] bg-black/40 backdrop-blur-sm"
                    onClick={() => setIsResultsFullscreen(false)}
                  />
                )}
              </AnimatePresence>
              
              {/* Query Results */}
              {isResultsFullscreen ? (
                <motion.div 
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.95 }}
                  transition={{ duration: 0.3, ease: "easeOut" }}
                  className={cn(
                    "space-y-4 min-w-0 relative",
                    "fixed inset-6 z-[9999] bg-card rounded-2xl shadow-2xl border border-border overflow-hidden"
                  )}
                  onClick={(e: React.MouseEvent) => e.stopPropagation()}
                >
                  <div className="h-full overflow-auto scrollbar-hide flex flex-col">
                    <div className="p-6 pb-4 flex-shrink-0">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center space-x-2">
                          <div className="w-8 h-8 bg-purple-600 rounded-lg flex items-center justify-center flex-shrink-0">
                            <span className="text-white font-semibold text-sm">4</span>
                          </div>
                          <h2 className="text-lg font-semibold text-foreground">Results</h2>
                          {queryResult && (
                            <span className="text-sm text-muted-foreground">
                              {queryResult.rows.length} rows
                            </span>
                          )}
                        </div>
                        <div className="flex items-center space-x-1">
                          <button
                            onClick={() => setIsResultsFullscreen(!isResultsFullscreen)}
                            className="p-1.5 text-muted-foreground hover:text-foreground hover:bg-muted rounded-md transition-colors"
                            title={isResultsFullscreen ? "Exit fullscreen" : "Enter fullscreen"}
                          >
                            {isResultsFullscreen ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
                          </button>
                          <button
                            onClick={resetResultsSize}
                            className="p-1.5 text-muted-foreground hover:text-foreground hover:bg-muted rounded-md transition-colors"
                            title="Reset results size"
                          >
                            <RotateCcw className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    </div>
                    
                    <div className="px-6 pb-6 flex-1 min-h-0">
                      <Card 
                        data-results-card
                        className="border border-border shadow-sm bg-card overflow-hidden"
                        style={{ height: '100%' }}
                      >
                      <CardContent className="p-4 lg:p-6 h-full flex flex-col">
                        {queryResult ? (
                          <div className="flex flex-col h-full space-y-4">
                            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between p-3 bg-blue-50 rounded-lg border border-blue-100 space-y-2 sm:space-y-0">
                              <div className="text-sm text-blue-900 font-medium">
                                {queryResult.columns.length > 0 && queryResult.rows.length > 0 
                                  ? `${queryResult.rows.length} rows returned`
                                  : queryResult.rowsAffected > 0 
                                    ? `${queryResult.rowsAffected} rows affected`
                                    : 'Query completed'
                                } • {queryResult.executionTime}ms
                              </div>
                              {/* Only show export for queries that return data */}
                              {queryResult.columns.length > 0 && queryResult.rows.length > 0 && (
                                <div className="relative" ref={exportMenuRef}>
                                  <button
                                    onClick={() => setShowExportMenu(!showExportMenu)}
                                    className="flex items-center space-x-2 px-3 py-1.5 text-sm font-medium text-foreground bg-card border border-border rounded-md hover:bg-accent transition-colors"
                                  >
                                    <Download className="w-4 h-4" />
                                    <span>Export</span>
                                    <ChevronDown className="w-3 h-3" />
                                  </button>
                                  {showExportMenu && (
                                    <div className="absolute right-0 top-full mt-1 w-48 bg-card border border-border rounded-md shadow-lg z-10">
                                      <div className="py-1">
                                        <button
                                          onClick={() => handleExport('csv')}
                                          className="flex items-center space-x-2 w-full px-4 py-2 text-sm text-foreground hover:bg-accent transition-colors"
                                        >
                                          <FileText className="w-4 h-4" />
                                          <span>Export as CSV</span>
                                        </button>
                                        <button
                                          onClick={() => handleExport('json')}
                                          className="flex items-center space-x-2 w-full px-4 py-2 text-sm text-foreground hover:bg-accent transition-colors"
                                        >
                                          <FileText className="w-4 h-4" />
                                          <span>Export as JSON</span>
                                        </button>
                                        <button
                                          onClick={() => handleExport('excel')}
                                          className="flex items-center space-x-2 w-full px-4 py-2 text-sm text-foreground hover:bg-accent transition-colors"
                                        >
                                          <FileSpreadsheet className="w-4 h-4" />
                                          <span>Export as Excel</span>
                                        </button>
                                      </div>
                                    </div>
                                  )}
                                </div>
                              )}
                            </div>
                            
                            {/* Show table for SELECT queries that return data */}
                            <div className="flex-1 min-h-0">
                              {queryResult.columns.length > 0 && queryResult.rows.length > 0 ? (
                                <div className="border border-border rounded-lg overflow-hidden bg-card h-full flex flex-col">
                                  {/* Search Bar */}
                                  <div className="p-3 border-b border-border bg-muted">
                                    <div className="relative">
                                      <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground w-4 h-4" />
                                      <input
                                        type="text"
                                        placeholder="Search in results..."
                                        value={searchTerm}
                                        onChange={(e) => setSearchTerm(e.target.value)}
                                        className="w-full pl-10 pr-4 py-2 text-sm border border-border rounded-md bg-background text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary"
                                      />
                                      {searchTerm && (
                                        <div className="absolute right-3 top-1/2 transform -translate-y-1/2 text-xs text-muted-foreground">
                                          {filteredAndSortedRows().length} of {queryResult.rows.length} rows
                                        </div>
                                      )}
                                    </div>
                                  </div>
                                  
                                  <div className="flex-1 overflow-auto">
                                    <table className="w-full text-sm">
                                      <thead className="sticky top-0 bg-muted border-b border-border">
                                        <tr>
                                          {queryResult.columns.map((col) => (
                                            <th
                                              key={col}
                                              className="text-left p-3 font-medium text-foreground border-r border-border last:border-r-0 min-w-[120px]"
                                            >
                                              <button
                                                onClick={() => handleSort(col)}
                                                className="flex items-center justify-between w-full text-left hover:bg-accent rounded px-2 py-1 transition-colors"
                                              >
                                                <span className="truncate pr-2">{col}</span>
                                                <div className="flex-shrink-0">
                                                  {sortColumn === col ? (
                                                    sortDirection === 'asc' ? (
                                                      <ChevronUp className="w-3 h-3" />
                                                    ) : (
                                                      <ChevronDown className="w-3 h-3" />
                                                    )
                                                  ) : (
                                                    <ArrowUpDown className="w-3 h-3 opacity-50" />
                                                  )}
                                                </div>
                                              </button>
                                            </th>
                                          ))}
                                        </tr>
                                      </thead>
                                      <tbody className="bg-background">
                                        {filteredAndSortedRows().slice(0, 100).map((row, i) => (
                                          <tr
                                            key={i}
                                            className="border-b border-border hover:bg-muted/50 transition-colors"
                                          >
                                            {row.map((cell, j) => (
                                              <td
                                                key={j}
                                                className="p-3 border-r border-border last:border-r-0 text-foreground"
                                                title={String(cell)}
                                              >
                                                <div className="max-w-[200px] truncate">
                                                  {cell ?? "NULL"}
                                                </div>
                                              </td>
                                            ))}
                                          </tr>
                                        ))}
                                      </tbody>
                                    </table>
                                    
                                    {/* No results message */}
                                    {filteredAndSortedRows().length === 0 && searchTerm && (
                                      <div className="flex flex-col items-center justify-center py-8 text-muted-foreground">
                                        <Search className="w-8 h-8 mb-2 opacity-50" />
                                        <p className="text-sm">No results found for "{searchTerm}"</p>
                                        <button
                                          onClick={() => setSearchTerm('')}
                                          className="text-xs text-primary hover:underline mt-1"
                                        >
                                          Clear search
                                        </button>
                                      </div>
                                    )}
                                  </div>
                                </div>
                              ) : (
                                /* Show modification result for INSERT/UPDATE/DELETE queries */
                                <div className="flex flex-col items-center justify-center py-12 text-center">
                                  <div className="flex items-center justify-center w-16 h-16 bg-green-500/10 rounded-full mb-4">
                                    {queryResult.rowsAffected > 0 ? (
                                      <CheckCircle className="w-8 h-8 text-green-600 dark:text-green-400" />
                                    ) : (
                                      <AlertCircle className="w-8 h-8 text-muted-foreground" />
                                    )}
                                  </div>
                                  <h3 className="text-lg font-semibold text-foreground mb-2">
                                    {queryResult.rowsAffected > 0 ? 'Query Executed Successfully' : 'Query Completed'}
                                  </h3>
                                  <div className="space-y-1 text-muted-foreground">
                                    {queryResult.rowsAffected > 0 ? (
                                      <p className="text-lg font-medium text-green-600 dark:text-green-400">
                                        {queryResult.rowsAffected} row{queryResult.rowsAffected !== 1 ? 's' : ''} affected
                                      </p>
                                    ) : (
                                      <p>No rows were modified</p>
                                    )}
                                    <p className="text-sm">
                                      Execution time: {queryResult.executionTime}ms
                                    </p>
                                  </div>
                                </div>
                              )}
                            </div>
                          </div>
                        ) : (
                          <div className="flex flex-col items-center justify-center h-48 lg:h-64 text-muted-foreground">
                            <Database className="w-12 h-12 lg:w-16 lg:h-16 mb-4 opacity-30" />
                            <h3 className="text-base lg:text-lg font-medium mb-2 text-foreground">No results yet</h3>
                            <p className="text-center text-sm lg:text-base text-muted-foreground">Execute a query to see results here</p>
                          </div>
                        )}
                      </CardContent>
                    </Card>
                  </div>
                </div>
                </motion.div>
              ) : (
                <div 
                  className="space-y-4 min-w-0 relative"
                  style={{ 
                    gridColumn: resultsWidth >= 80 ? '1' : '1',
                    gridRow: resultsWidth >= 80 ? '1' : 'auto'
                  }}
                >
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-2">
                        <div className="w-8 h-8 bg-purple-600 rounded-lg flex items-center justify-center flex-shrink-0">
                          <span className="text-white font-semibold text-sm">4</span>
                        </div>
                        <h2 className="text-lg font-semibold text-foreground">Results</h2>
                        {queryResult && (
                          <span className="text-sm text-muted-foreground">
                            {queryResult.rows.length} rows
                          </span>
                        )}
                      </div>
                      <div className="flex items-center space-x-1">
                        <button
                          onClick={() => setIsResultsFullscreen(!isResultsFullscreen)}
                          className="p-1.5 text-muted-foreground hover:text-foreground hover:bg-muted rounded-md transition-colors"
                          title={isResultsFullscreen ? "Exit fullscreen" : "Enter fullscreen"}
                        >
                          {isResultsFullscreen ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
                        </button>
                        <button
                          onClick={resetResultsSize}
                          className="p-1.5 text-muted-foreground hover:text-foreground hover:bg-muted rounded-md transition-colors"
                          title="Reset results size"
                        >
                          <RotateCcw className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                    
                    <div className="relative">
                      <Card 
                        data-results-card
                        className="border border-border shadow-sm bg-card overflow-hidden"
                        style={{ height: `${resultsHeight}px` }}
                      >
                        <CardContent className="p-4 lg:p-6 h-full flex flex-col">
                          {queryResult ? (
                            <div className="flex flex-col h-full space-y-4">
                              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between p-3 bg-blue-500/10 dark:bg-blue-500/10 rounded-lg border border-blue-500/20 dark:border-blue-500/20 space-y-2 sm:space-y-0">
                                <div className="text-sm text-blue-900 dark:text-blue-300 font-medium">
                                  {queryResult.columns.length > 0 && queryResult.rows.length > 0 
                                    ? `${queryResult.rows.length} rows returned`
                                    : queryResult.rowsAffected > 0 
                                      ? `${queryResult.rowsAffected} rows affected`
                                      : 'Query completed'
                                  } • {queryResult.executionTime}ms
                                </div>
                                {/* Only show export for queries that return data */}
                                {queryResult.columns.length > 0 && queryResult.rows.length > 0 && (
                                  <div className="relative" ref={exportMenuRef}>
                                    <button
                                      onClick={() => setShowExportMenu(!showExportMenu)}
                                      className="flex items-center space-x-2 px-3 py-1.5 text-sm font-medium text-foreground bg-card border border-border rounded-md hover:bg-accent transition-colors"
                                    >
                                      <Download className="w-4 h-4" />
                                      <span>Export</span>
                                      <ChevronDown className="w-3 h-3" />
                                    </button>
                                    {showExportMenu && (
                                      <div className="absolute right-0 top-full mt-1 w-48 bg-card border border-border rounded-md shadow-lg z-10">
                                        <div className="py-1">
                                          <button
                                            onClick={() => handleExport('csv')}
                                            className="flex items-center space-x-2 w-full text-left px-4 py-2 text-sm text-foreground hover:bg-muted"
                                          >
                                            <FileText className="w-4 h-4" />
                                            <span>Export as CSV</span>
                                          </button>
                                          <button
                                            onClick={() => handleExport('json')}
                                            className="flex items-center space-x-2 w-full text-left px-4 py-2 text-sm text-foreground hover:bg-muted"
                                          >
                                            <Code className="w-4 h-4" />
                                            <span>Export as JSON</span>
                                          </button>
                                        </div>
                                      </div>
                                    )}
                                  </div>
                                )}
                              </div>

                              {queryResult.columns.length > 0 && queryResult.rows.length > 0 ? (
                                <div className="flex-1 min-h-0 bg-muted rounded-lg border border-border">
                                  <div className="h-full flex flex-col">
                                    {/* Search and filter controls - only show if table has more than 5 rows or 3 columns */}
                                    {(queryResult.rows.length > 5 || queryResult.columns.length > 3) && (
                                      <div className="p-4 border-b border-border">
                                        <div className="flex items-center space-x-4">
                                          <div className="flex-1 relative">
                                            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                                            <input
                                              type="text"
                                              placeholder="Search results..."
                                              value={searchTerm}
                                              onChange={(e) => setSearchTerm(e.target.value)}
                                              className="w-full pl-10 pr-4 py-2 border border-border rounded-md bg-background text-foreground placeholder-muted-foreground focus:ring-2 focus:ring-primary focus:border-transparent"
                                            />
                                          </div>
                                          <span className="text-sm text-muted-foreground">
                                            Showing {Math.min(filteredAndSortedRows().length, 100)} of {filteredAndSortedRows().length} rows
                                          </span>
                                        </div>
                                      </div>
                                    )}
                                    
                                    {/* Scrollable table container */}
                                    <div className="flex-1 overflow-auto">
                                      <table className="w-full text-sm">
                                        <thead className="sticky top-0 bg-muted border-b border-border">
                                          <tr>
                                            {queryResult.columns.map((col) => (
                                              <th
                                                key={col}
                                                className="text-left p-3 font-medium text-foreground border-r border-border last:border-r-0 min-w-[120px]"
                                              >
                                                <button
                                                  onClick={() => handleSort(col)}
                                                  className="flex items-center justify-between w-full text-left hover:bg-accent rounded px-2 py-1 transition-colors"
                                                >
                                                  <span className="truncate pr-2">{col}</span>
                                                  <div className="flex-shrink-0">
                                                    {sortColumn === col ? (
                                                      sortDirection === 'asc' ? (
                                                        <ChevronUp className="w-3 h-3" />
                                                      ) : (
                                                        <ChevronDown className="w-3 h-3" />
                                                      )
                                                    ) : (
                                                      <ArrowUpDown className="w-3 h-3 opacity-50" />
                                                    )}
                                                  </div>
                                                </button>
                                              </th>
                                            ))}
                                          </tr>
                                        </thead>
                                        <tbody className="bg-background">
                                          {filteredAndSortedRows().slice(0, 100).map((row, i) => (
                                            <tr
                                              key={i}
                                              className="border-b border-border hover:bg-muted/50 transition-colors"
                                            >
                                              {row.map((cell, j) => (
                                                <td
                                                  key={j}
                                                  className="p-3 border-r border-border last:border-r-0 text-foreground"
                                                  title={String(cell)}
                                                >
                                                  <div className="max-w-[200px] truncate">
                                                    {cell}
                                                  </div>
                                                </td>
                                              ))}
                                            </tr>
                                          ))}
                                        </tbody>
                                      </table>
                                    </div>
                                    
                                    {/* No results message */}
                                    {filteredAndSortedRows().length === 0 && searchTerm && (
                                      <div className="flex flex-col items-center justify-center py-8 text-muted-foreground">
                                        <Search className="w-8 h-8 mb-2 opacity-50" />
                                        <p className="text-sm">No results found for "{searchTerm}"</p>
                                        <button
                                          onClick={() => setSearchTerm('')}
                                          className="text-xs text-primary hover:underline mt-1"
                                        >
                                          Clear search
                                        </button>
                                      </div>
                                    )}
                                  </div>
                                </div>
                              ) : (
                                /* Show modification result for INSERT/UPDATE/DELETE queries */
                                <div className="flex flex-col items-center justify-center py-12 text-center">
                                  <div className="flex items-center justify-center w-16 h-16 bg-green-500/10 rounded-full mb-4">
                                    {queryResult.rowsAffected > 0 ? (
                                      <CheckCircle className="w-8 h-8 text-green-600 dark:text-green-400" />
                                    ) : (
                                      <AlertCircle className="w-8 h-8 text-muted-foreground" />
                                    )}
                                  </div>
                                  <h3 className="text-lg font-semibold text-foreground mb-2">
                                    {queryResult.rowsAffected > 0 ? 'Query Executed Successfully' : 'Query Completed'}
                                  </h3>
                                  <div className="space-y-1 text-muted-foreground">
                                    {queryResult.rowsAffected > 0 ? (
                                      <p className="text-lg font-medium text-green-600 dark:text-green-400">
                                        {queryResult.rowsAffected} row{queryResult.rowsAffected !== 1 ? 's' : ''} affected
                                      </p>
                                    ) : (
                                      <p>No rows were modified</p>
                                    )}
                                    <p className="text-sm">
                                      Execution time: {queryResult.executionTime}ms
                                    </p>
                                  </div>
                                </div>
                              )}
                            </div>
                          ) : (
                            <div className="flex flex-col items-center justify-center h-full text-center text-muted-foreground">
                              <Database className="w-12 h-12 lg:w-16 lg:h-16 mb-4 opacity-30" />
                              <h3 className="text-base lg:text-lg font-medium mb-2 text-foreground">No results yet</h3>
                              <p className="text-center text-sm lg:text-base text-muted-foreground">Execute a query to see results here</p>
                            </div>
                          )}
                        </CardContent>
                      </Card>
                    </div>
                    
                    {/* Resize Handles - Only in normal mode */}
                    <>
                      {/* Height Resize Handle */}
                      <div
                        className="absolute bottom-0 left-0 right-0 h-2 cursor-row-resize bg-transparent hover:bg-primary/20 transition-colors flex items-center justify-center group"
                        onMouseDown={handleResultsResizeStart}
                      >
                        <div className="w-8 h-1 bg-border rounded-full group-hover:bg-primary/40 transition-colors"></div>
                      </div>
                      
                      {/* Width Resize Handle */}
                      <div
                        className="absolute top-0 right-0 bottom-0 w-2 cursor-col-resize bg-transparent hover:bg-primary/20 transition-colors flex items-center justify-center group"
                        onMouseDown={handleWidthResizeStart}
                      >
                        <div className="h-8 w-1 bg-border rounded-full group-hover:bg-primary/40 transition-colors"></div>
                      </div>
                    </>
                  </div>
                </div>
              )}

              {/* Query History */}
              <div 
                className="space-y-4 min-w-0"
                style={{
                  gridColumn: resultsWidth >= 80 ? '1' : '2',
                  gridRow: resultsWidth >= 80 ? '2' : 'auto'
                }}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-2">
                    <div className="w-8 h-8 bg-orange-600 rounded-lg flex items-center justify-center flex-shrink-0">
                      <History className="w-5 h-5 text-white" />
                    </div>
                    <h2 className="text-lg font-semibold text-foreground">History</h2>
                    {isLoadingHistory && (
                      <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />
                    )}
                    {queryHistory.length > 0 && !isLoadingHistory && (
                      <span className="text-sm text-muted-foreground">
                        {queryHistory.length} queries
                      </span>
                    )}
                  </div>
                  
                  {currentProfile && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={loadQueryHistory}
                      disabled={isLoadingHistory}
                      className="text-xs"
                    >
                      <RotateCcw className="w-3 h-3 mr-1" />
                      Refresh
                    </Button>
                  )}
                </div>
                
                <div className="relative">
                  <Card 
                    data-history-card
                    className="border border-border shadow-sm bg-card overflow-hidden"
                    style={{ height: `${resultsHeight}px` }}
                  >
                    <CardContent className="p-4 lg:p-6 h-full flex flex-col">
                    {isLoadingHistory ? (
                      <div className="flex flex-col items-center justify-center h-full text-center text-muted-foreground">
                        <Loader2 className="w-8 h-8 mb-4 animate-spin" />
                        <h3 className="text-base lg:text-lg font-medium mb-2 text-foreground">Loading History</h3>
                        <p className="text-center text-sm lg:text-base text-muted-foreground">Fetching query history from profile...</p>
                      </div>
                    ) : queryHistory.length > 0 ? (
                      <div className="space-y-3 flex-1 overflow-auto scrollbar-hide">
                        {queryHistory.map((item) => (
                          <div
                            key={item.id}
                            className="p-3 lg:p-4 border border-border rounded-lg hover:bg-muted cursor-pointer transition-colors bg-card"
                            onClick={() => loadFromHistory(item)}
                          >
                            <div className="flex items-center justify-between mb-2">
                              <div className="flex items-center space-x-2">
                                <div className={`flex items-center space-x-2 text-xs font-medium px-2 py-1 rounded-full ${
                                  item.success 
                                    ? 'text-green-600 dark:text-green-400 bg-green-500/10' 
                                    : 'text-red-600 dark:text-red-400 bg-red-500/10'
                                }`}>
                                  {item.success ? (
                                    <CheckCircle className="w-3 h-3" />
                                  ) : (
                                    <AlertCircle className="w-3 h-3" />
                                  )}
                                  <span>{item.success ? 'Success' : 'Error'}</span>
                                </div>
                                
                                {/* Parameters indicator */}
                                {item.parameters && Object.keys(item.parameters).length > 0 && (
                                  <div className="flex items-center space-x-1 text-xs font-medium px-2 py-1 rounded-full bg-blue-500/10 text-blue-600 dark:text-blue-400">
                                    <Settings className="w-3 h-3" />
                                    <span>{Object.keys(item.parameters).length}</span>
                                  </div>
                                )}
                                
                                {/* Write mode indicator */}
                                {!isQueryCommand(item.query) && (
                                  <div className="flex items-center space-x-1 text-xs font-medium px-2 py-1 rounded-full bg-orange-500/10 text-orange-600 dark:text-orange-400">
                                    <Database className="w-3 h-3" />
                                    <span>Write</span>
                                  </div>
                                )}
                              </div>
                              <span className="text-xs text-muted-foreground">
                                {item.timestamp.toLocaleTimeString()}
                              </span>
                            </div>
                            
                            <div className="text-sm text-foreground mb-2 line-clamp-2">
                              {item.naturalLanguage}
                            </div>
                            
                            <div className="text-xs text-muted-foreground font-mono bg-muted p-2 rounded truncate">
                              {item.query}
                            </div>
                            
                            {item.executionTime && (
                              <div className="text-xs text-muted-foreground mt-2">
                                {item.executionTime}ms
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="flex flex-col items-center justify-center h-full text-center text-muted-foreground">
                        <Clock className="w-12 h-12 lg:w-16 lg:h-16 mb-4 opacity-30" />
                        <h3 className="text-base lg:text-lg font-medium mb-2 text-foreground">
                          {currentProfile ? 'No history yet' : 'No profile selected'}
                        </h3>
                        <p className="text-center text-sm lg:text-base text-muted-foreground">
                          {currentProfile 
                            ? 'Your query history will appear here' 
                            : 'Select a profile to view query history'
                          }
                        </p>
                      </div>
                    )}
                  </CardContent>
                </Card>
                </div>
              </div>
            </motion.div>
          </div>
        </div>
      </motion.div>
    </>
  )
}

export default QueryEditor
