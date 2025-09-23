export interface DatabaseProvider {
  dbType: string
  name: string
  describtion: string
}

export interface DatabaseServer {
  name: string
  dbType: string
  runningDbs: number
}

export interface DatabaseInfo {
  name: string
  tableCount: number
}

export interface ConnectionProfile {
  id: string // API returns 'id', not 'profileId'
  name: string
  connectionString: string
  queries: any[] // Array of queries associated with this profile
  createdUtc: string // ISO date string from API
  
  // API response fields (match backend exactly)
  databaseName?: string // API returns 'DatabaseName'
  provider?: string // API returns 'Provider' as enum string (e.g. "SqlServer")
  secretRef?: string // API returns 'SecretRef'
  cacheFile?: string // API returns 'CacheFile'
  
  // Computed fields for compatibility
  providerType?: string // Computed from provider enum
  serverName?: string // Extracted from connection string or secretRef
  
  // Optional legacy fields for backward compatibility
  connectionType?: 'AutoConnect' | 'ConnectionString'
  success?: boolean
}

export interface CreateProfileRequest {
  name: string
  connectionType: 'AutoConnect' | 'ConnectionString'
  providerType: string
  serverName?: string
  databaseName?: string
  connectionString?: string
}

export interface ConvertQueryRequest {
  UserId: string // Backend expects UserId with capital U
  profileId: string
  query: string
  allowWriteOperations: boolean
}

export interface ConvertQueryResponse {
  sql: string
  intent: string
  intent_components: string[]
  tables: string[]
  columns: string[]
  parameters: any[]
  confidence: number
  safe: boolean
  issues: any[]
  explanation: string
}

export interface ExecuteQueryRequest {
  UserId: string // Backend expects UserId with capital U
  profileId: string
  sql: string
  userQuery: string
  parameters: Record<string, any> | null
  mode: 'ReadOnly' | 'Write'
}

export interface QueryResult {
  columns: string[]
  rows: any[][]
  rowCount: number
  executionTime: number
}

export interface SchemaTable {
  name: string
  schema: string
  columns: SchemaColumn[]
}

export interface SchemaColumn {
  name: string
  dataType: string
  isNullable: boolean
  isPrimaryKey?: boolean
  isForeignKey?: boolean
  referencesTable?: string
  referencesColumn?: string
}

export interface DatabaseSchema {
  database: string
  tables: SchemaTable[]
  relations: SchemaRelation[]
}

export interface SchemaRelation {
  fromTable: string
  fromColumn: string
  toTable: string
  toColumn: string
}

export interface QueryHistoryItem {
  id: string
  userQuery: string
  sql: string
  timestamp: Date
  executionTime?: number
  success: boolean
  error?: string
}

export interface ApiError {
  source: string
  errors: string[]
  statusCode: number
}

export interface HealthResponse {
  status: string
  timeStamp: string
  version: string
}

export interface AppState {
  profiles: ConnectionProfile[]
  currentProfile: string | null
  isSetupMode: boolean
  setupType: 'groq' | 'local' | 'basic' | null
  theme: 'light' | 'dark'
  user?: import('./user').UserInfoDto | null
}

export interface NotificationMessage {
  id: string
  type: 'success' | 'error' | 'warning' | 'info'
  title: string
  message: string
  duration?: number
}

// Re-export user management types
export * from './user'
