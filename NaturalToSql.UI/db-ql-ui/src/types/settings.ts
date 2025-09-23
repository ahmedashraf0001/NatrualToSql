// Settings types for the application

export interface AppearanceSettings {
  theme: 'light' | 'dark' | 'system'
  primaryColor: string
  customTheme?: {
    background: string
    foreground: string
    primary: string
    secondary: string
    accent: string
    muted: string
    border: string
  }
  fontSize: 'small' | 'medium' | 'large'
  compactMode: boolean
  showAnimations: boolean
}

export interface QuerySettings {
  defaultDatabase: string
  autoComplete: boolean
  syntaxHighlighting: boolean
  lineNumbers: boolean
  wordWrap: boolean
  tabSize: number
  autoSave: boolean
  queryHistory: boolean
  maxHistoryItems: number
}

export interface DatabaseSettings {
  connectionTimeout: number
  queryTimeout: number
  maxRows: number
  autoConnect: boolean
  sslMode: 'disable' | 'require' | 'prefer'
  poolSize: number
}

export interface NotificationSettings {
  showSuccessMessages: boolean
  showErrorMessages: boolean
  showWarningMessages: boolean
  autoHideSuccess: boolean
  defaultDuration: number
  position: 'top-right' | 'top-left' | 'bottom-right' | 'bottom-left'
  sound: boolean
}

export interface SecuritySettings {
  encryptPasswords: boolean
  sessionTimeout: number
  requireAuth: boolean
  auditLogs: boolean
  ipWhitelist: string[]
  maxLoginAttempts: number
}

export interface PerformanceSettings {
  cacheQueries: boolean
  prefetchResults: boolean
  lazyLoading: boolean
  maxCacheSize: number
  compressionLevel: 'none' | 'low' | 'medium' | 'high'
  parallelQueries: boolean
  batchSize: number
}

export interface AppSettings {
  appearance: AppearanceSettings
  query: QuerySettings
  database: DatabaseSettings
  notifications: NotificationSettings
  security: SecuritySettings
  performance: PerformanceSettings
}

export interface PredefinedTheme {
  name: string
  displayName: string
  colors: {
    background: string
    foreground: string
    primary: string
    secondary: string
    accent: string
    muted: string
    border: string
  }
}

export const PREDEFINED_THEMES: PredefinedTheme[] = [
  {
    name: 'default',
    displayName: 'Default Blue',
    colors: {
      background: 'hsl(222.2 84% 4.9%)',
      foreground: 'hsl(210 40% 98%)',
      primary: 'hsl(217.2 91.2% 59.8%)',
      secondary: 'hsl(217.2 32.6% 17.5%)',
      accent: 'hsl(217.2 32.6% 17.5%)',
      muted: 'hsl(217.2 32.6% 17.5%)',
      border: 'hsl(217.2 32.6% 17.5%)'
    }
  },
  {
    name: 'green',
    displayName: 'Forest Green',
    colors: {
      background: 'hsl(120 84% 4.9%)',
      foreground: 'hsl(120 40% 98%)',
      primary: 'hsl(142.1 76.2% 36.3%)',
      secondary: 'hsl(142.1 32.6% 17.5%)',
      accent: 'hsl(142.1 32.6% 17.5%)',
      muted: 'hsl(142.1 32.6% 17.5%)',
      border: 'hsl(142.1 32.6% 17.5%)'
    }
  },
  {
    name: 'purple',
    displayName: 'Royal Purple',
    colors: {
      background: 'hsl(270 84% 4.9%)',
      foreground: 'hsl(270 40% 98%)',
      primary: 'hsl(271.5 81.3% 55.9%)',
      secondary: 'hsl(271.5 32.6% 17.5%)',
      accent: 'hsl(271.5 32.6% 17.5%)',
      muted: 'hsl(271.5 32.6% 17.5%)',
      border: 'hsl(271.5 32.6% 17.5%)'
    }
  },
  {
    name: 'orange',
    displayName: 'Sunset Orange',
    colors: {
      background: 'hsl(20 84% 4.9%)',
      foreground: 'hsl(20 40% 98%)',
      primary: 'hsl(24.6 95% 53.1%)',
      secondary: 'hsl(24.6 32.6% 17.5%)',
      accent: 'hsl(24.6 32.6% 17.5%)',
      muted: 'hsl(24.6 32.6% 17.5%)',
      border: 'hsl(24.6 32.6% 17.5%)'
    }
  }
]

// Default settings
export const DEFAULT_SETTINGS: AppSettings = {
  appearance: {
    theme: 'dark',
    primaryColor: PREDEFINED_THEMES[0].colors.primary,
    fontSize: 'medium',
    compactMode: false,
    showAnimations: true
  },
  query: {
    defaultDatabase: '',
    autoComplete: true,
    syntaxHighlighting: true,
    lineNumbers: true,
    wordWrap: true,
    tabSize: 2,
    autoSave: true,
    queryHistory: true,
    maxHistoryItems: 100
  },
  database: {
    connectionTimeout: 30,
    queryTimeout: 60,
    maxRows: 1000,
    autoConnect: false,
    sslMode: 'prefer',
    poolSize: 10
  },
  notifications: {
    showSuccessMessages: true,
    showErrorMessages: true,
    showWarningMessages: true,
    autoHideSuccess: true,
    defaultDuration: 5000,
    position: 'top-right',
    sound: false
  },
  security: {
    encryptPasswords: true,
    sessionTimeout: 30,
    requireAuth: false,
    auditLogs: true,
    ipWhitelist: [],
    maxLoginAttempts: 3
  },
  performance: {
    cacheQueries: true,
    prefetchResults: false,
    lazyLoading: true,
    maxCacheSize: 100,
    compressionLevel: 'medium',
    parallelQueries: false,
    batchSize: 50
  }
}
