import React, { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Button } from '@/components/ui/button'
import { 
  Database, 
  Table, 
  Key, 
  Search, 
  ChevronRight, 
  Link, 
  Type,
  FileText,
  Filter,
  RefreshCw,
  Eye,
  EyeOff,
  AlertCircle
} from 'lucide-react'
import { DatabaseSchema, SchemaColumn } from '@/types'
import { apiService } from '@/services/api'

interface SchemaExplorerProps {
  profileId: string | null
}

const SchemaExplorer: React.FC<SchemaExplorerProps> = ({ profileId }) => {
  const [schema, setSchema] = useState<DatabaseSchema | null>(null)
  const [expandedTables, setExpandedTables] = useState<Set<string>>(new Set())
  const [searchTerm, setSearchTerm] = useState('')
  const [selectedTable, setSelectedTable] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [filterType, setFilterType] = useState<'all' | 'tables' | 'views'>('all')
  const [showSystemTables, setShowSystemTables] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Load schema data from API
  const loadSchema = async () => {
    if (!profileId) return

    setIsLoading(true)
    setError(null)
    
    try {
      const schemaData = await apiService.getSchema(profileId)
      setSchema(schemaData)
    } catch (err) {
      console.error('Failed to load schema:', err)
      setError('Failed to load database schema. Please check your connection and try again.')
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    if (profileId) {
      loadSchema()
    }
  }, [profileId])

  const toggleTableExpansion = (tableName: string) => {
    const newExpanded = new Set(expandedTables)
    if (expandedTables.has(tableName)) {
      newExpanded.delete(tableName)
    } else {
      newExpanded.add(tableName)
    }
    setExpandedTables(newExpanded)
  }

  const filteredTables = schema?.tables?.filter(table => {
    const matchesSearch = table.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         table.columns.some(col => col.name.toLowerCase().includes(searchTerm.toLowerCase()))
    
    const matchesFilter = filterType === 'all' || 
                         (filterType === 'tables' && !table.name.startsWith('v_')) ||
                         (filterType === 'views' && table.name.startsWith('v_'))
    
    const matchesSystemFilter = showSystemTables || !table.name.startsWith('__') && !table.name.startsWith('sys_')
    
    return matchesSearch && matchesFilter && matchesSystemFilter
  }) || []

  const getColumnIcon = (column: SchemaColumn) => {
    if (column.isPrimaryKey) return <Key className="w-3 h-3 text-yellow-500" />
    if (column.isForeignKey) return <Link className="w-3 h-3 text-blue-500" />
    return <Type className="w-3 h-3 text-gray-500" />
  }

  const getColumnBadgeVariant = (column: SchemaColumn) => {
    if (column.isPrimaryKey) return 'default'
    if (column.isForeignKey) return 'secondary'
    return 'outline'
  }

  return (
    <motion.div 
      className="flex flex-col max-h-full bg-gradient-to-br from-background via-background to-muted/20"
      initial={{ opacity: 0, x: -20 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ duration: 0.5 }}
    >
      {/* Header */}
      <motion.div 
        className="flex-shrink-0 border-b bg-card/50 backdrop-blur-sm p-4"
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <motion.div
              whileHover={{ scale: 1.1, rotate: 180 }}
              transition={{ type: "spring", stiffness: 300 }}
            >
              <Database className="w-6 h-6 text-primary" />
            </motion.div>
            <h2 className="text-xl font-bold bg-gradient-to-r from-primary to-purple-600 bg-clip-text text-transparent">
              Database Schema
            </h2>
            {schema && (
              <Badge variant="outline" className="text-xs">
                {schema.database || 'Database'}
              </Badge>
            )}
          </div>

          <div className="flex items-center space-x-2">
            <motion.div whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowSystemTables(!showSystemTables)}
              >
                {showSystemTables ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </Button>
            </motion.div>
            
            <motion.div whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}>
              <Button
                variant="ghost"
                size="sm"
                onClick={loadSchema}
                disabled={isLoading}
              >
                <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
              </Button>
            </motion.div>
          </div>
        </div>

        {/* Search and Filters */}
        <div className="mt-4 space-y-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <input
              type="text"
              placeholder="Search tables and columns..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 rounded-lg border border-border bg-background text-foreground placeholder:text-muted-foreground focus:ring-2 focus:ring-primary focus:border-transparent transition-all"
            />
          </div>
          
          <div className="flex items-center space-x-2">
            <Filter className="w-4 h-4 text-muted-foreground" />
            <button
              onClick={() => setFilterType('all')}
              className={`px-3 py-1 rounded-md text-sm transition-colors ${
                filterType === 'all' ? 'bg-primary text-primary-foreground' : 'hover:bg-muted'
              }`}
            >
              All
            </button>
            <button
              onClick={() => setFilterType('tables')}
              className={`px-3 py-1 rounded-md text-sm transition-colors ${
                filterType === 'tables' ? 'bg-primary text-primary-foreground' : 'hover:bg-muted'
              }`}
            >
              Tables
            </button>
            <button
              onClick={() => setFilterType('views')}
              className={`px-3 py-1 rounded-md text-sm transition-colors ${
                filterType === 'views' ? 'bg-primary text-primary-foreground' : 'hover:bg-muted'
              }`}
            >
              Views
            </button>
          </div>
        </div>
      </motion.div>

      {/* Content */}
      <div className="flex-1 min-h-0 p-4">
        {!profileId ? (
          <div className="flex items-center justify-center h-full text-muted-foreground">
            <div className="text-center">
              <Database className="w-12 h-12 mx-auto mb-2 opacity-50" />
              <p>Select a database profile to explore schema</p>
            </div>
          </div>
        ) : isLoading ? (
          <div className="flex items-center justify-center h-full">
            <div className="text-center">
              <motion.div
                animate={{ rotate: 360 }}
                transition={{ duration: 2, repeat: Infinity, ease: "linear" }}
              >
                <Database className="w-12 h-12 mx-auto mb-2 text-primary" />
              </motion.div>
              <p className="text-muted-foreground">Loading schema...</p>
            </div>
          </div>
        ) : error ? (
          <div className="flex items-center justify-center h-full text-red-500 dark:text-red-400 p-4">
            <div className="text-center">
              <AlertCircle className="w-8 h-8 mx-auto mb-2" />
              <p className="text-sm mb-2">{error}</p>
              <Button
                onClick={loadSchema}
                size="sm"
                variant="outline"
                className="mt-2"
              >
                Try Again
              </Button>
            </div>
          </div>
        ) : (
          <ScrollArea className="h-full">
            <div className="space-y-2">
              <div className="flex items-center justify-between mb-4">
                <div className="text-sm text-muted-foreground">
                  {filteredTables.length} {filteredTables.length === 1 ? 'table' : 'tables'} found
                </div>
                <Badge variant="outline" className="text-xs">
                  {schema?.tables?.length || 0} total tables
                </Badge>
              </div>

              {filteredTables.map((table, i) => (
                <motion.div
                  key={table.name}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.05 }}
                >
                  <Card className={`transition-all hover:shadow-md ${selectedTable === table.name ? 'ring-2 ring-primary' : ''}`}>
                    <CardHeader className="pb-2">
                      <div
                        className="flex items-center justify-between cursor-pointer"
                        onClick={() => {
                          toggleTableExpansion(table.name)
                          setSelectedTable(table.name)
                        }}
                      >
                        <div className="flex items-center space-x-3">
                          <motion.div
                            animate={{ rotate: expandedTables.has(table.name) ? 90 : 0 }}
                            transition={{ duration: 0.2 }}
                          >
                            <ChevronRight className="w-4 h-4 text-muted-foreground" />
                          </motion.div>
                          
                          <Table className="w-5 h-5 text-primary" />
                          
                          <div>
                            <CardTitle className="text-base">{table.schema}.{table.name}</CardTitle>
                            <div className="flex items-center space-x-2 mt-1">
                              <Badge variant="outline" className="text-xs">
                                {table.columns.length} columns
                              </Badge>
                            </div>
                          </div>
                        </div>
                      </div>
                    </CardHeader>

                    <AnimatePresence>
                      {expandedTables.has(table.name) && (
                        <motion.div
                          initial={{ opacity: 0, height: 0 }}
                          animate={{ opacity: 1, height: 'auto' }}
                          exit={{ opacity: 0, height: 0 }}
                          transition={{ duration: 0.3 }}
                        >
                          <CardContent>
                            <div className="space-y-2">
                              {table.columns.map((column, j) => (
                                <motion.div
                                  key={column.name}
                                  initial={{ opacity: 0, x: -10 }}
                                  animate={{ opacity: 1, x: 0 }}
                                  transition={{ delay: j * 0.02 }}
                                  className="flex items-center justify-between p-2 rounded-lg border bg-muted/30 hover:bg-muted/50 transition-colors"
                                >
                                  <div className="flex items-center space-x-3">
                                    {getColumnIcon(column)}
                                    <div>
                                      <div className="font-medium text-sm">{column.name}</div>
                                      <div className="text-xs text-muted-foreground">
                                        {column.dataType}
                                        {!column.isNullable && ' • NOT NULL'}
                                      </div>
                                      {column.isForeignKey && column.referencesTable && (
                                        <div className="text-xs text-blue-600 dark:text-blue-400">
                                          → {column.referencesTable}.{column.referencesColumn}
                                        </div>
                                      )}
                                    </div>
                                  </div>
                                  
                                  <div className="flex items-center space-x-1">
                                    {column.isPrimaryKey && (
                                      <Badge variant={getColumnBadgeVariant(column)} className="text-xs">
                                        PK
                                      </Badge>
                                    )}
                                    {column.isForeignKey && (
                                      <Badge variant={getColumnBadgeVariant(column)} className="text-xs">
                                        FK
                                      </Badge>
                                    )}
                                  </div>
                                </motion.div>
                              ))}
                            </div>
                          </CardContent>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </Card>
                </motion.div>
              ))}

              {filteredTables.length === 0 && searchTerm && (
                <div className="flex items-center justify-center h-32 text-muted-foreground">
                  <div className="text-center">
                    <FileText className="w-8 h-8 mx-auto mb-2 opacity-50" />
                    <p>No tables match your search criteria</p>
                  </div>
                </div>
              )}
            </div>
          </ScrollArea>
        )}
      </div>
    </motion.div>
  )
}

export default SchemaExplorer
