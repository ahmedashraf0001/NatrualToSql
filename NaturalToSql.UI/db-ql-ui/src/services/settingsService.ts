// Settings service for managing application settings
import { AppSettings, DEFAULT_SETTINGS } from '@/types/settings'

class SettingsService {
  private static instance: SettingsService | null = null
  private settings: AppSettings
  private listeners: Array<(settings: AppSettings) => void> = []
  private readonly STORAGE_KEY = 'db-ql-ui-settings'

  constructor() {
    this.settings = this.loadSettings()
  }

  static getInstance(): SettingsService {
    if (!SettingsService.instance) {
      SettingsService.instance = new SettingsService()
    }
    return SettingsService.instance
  }

  // Load settings from localStorage or use defaults
  private loadSettings(): AppSettings {
    try {
      const stored = localStorage.getItem(this.STORAGE_KEY)
      if (stored) {
        const parsed = JSON.parse(stored)
        // Merge with defaults to handle new settings
        return this.mergeWithDefaults(parsed)
      }
    } catch (error) {
      console.warn('Failed to load settings from localStorage:', error)
    }
    return { ...DEFAULT_SETTINGS }
  }

  // Merge stored settings with defaults to handle new settings
  private mergeWithDefaults(stored: any): AppSettings {
    const merged = { ...DEFAULT_SETTINGS }
    
    for (const category in DEFAULT_SETTINGS) {
      if (stored[category] && typeof stored[category] === 'object') {
        merged[category as keyof AppSettings] = {
          ...DEFAULT_SETTINGS[category as keyof AppSettings],
          ...stored[category]
        } as any
      }
    }
    
    return merged
  }

  // Save settings to localStorage
  private saveSettings(): void {
    try {
      localStorage.setItem(this.STORAGE_KEY, JSON.stringify(this.settings))
    } catch (error) {
      console.error('Failed to save settings to localStorage:', error)
    }
  }

  // Get current settings
  getSettings(): AppSettings {
    return { ...this.settings }
  }

  // Update settings
  updateSettings(newSettings: Partial<AppSettings>): void {
    this.settings = { ...this.settings, ...newSettings }
    this.saveSettings()
    this.notifyListeners()
  }

  // Update a specific category of settings
  updateCategory<T extends keyof AppSettings>(
    category: T,
    updates: Partial<AppSettings[T]>
  ): void {
    this.settings[category] = {
      ...this.settings[category],
      ...updates
    }
    this.saveSettings()
    
    // Apply theme changes immediately if appearance settings changed
    if (category === 'appearance') {
      this.applyTheme()
    }
    
    this.notifyListeners()
  }

  // Update a specific setting
  updateSetting<T extends keyof AppSettings, K extends keyof AppSettings[T]>(
    category: T,
    key: K,
    value: AppSettings[T][K]
  ): void {
    this.settings[category] = {
      ...this.settings[category],
      [key]: value
    }
    this.saveSettings()
    
    // Apply theme changes immediately if appearance settings changed
    if (category === 'appearance') {
      this.applyTheme()
    }
    
    this.notifyListeners()
  }

  // Reset settings to defaults
  resetSettings(): void {
    this.settings = { ...DEFAULT_SETTINGS }
    this.saveSettings()
    this.notifyListeners()
  }

  // Reset a specific category to defaults
  resetCategory<T extends keyof AppSettings>(category: T): void {
    this.settings[category] = { ...DEFAULT_SETTINGS[category] }
    this.saveSettings()
    this.notifyListeners()
  }

  // Subscribe to settings changes
  subscribe(callback: (settings: AppSettings) => void): () => void {
    this.listeners.push(callback)
    // Immediately call with current settings
    callback(this.getSettings())
    
    // Return unsubscribe function
    return () => {
      this.listeners = this.listeners.filter(listener => listener !== callback)
    }
  }

  // Notify all listeners of settings changes
  private notifyListeners(): void {
    const currentSettings = this.getSettings()
    this.listeners.forEach(callback => callback(currentSettings))
  }

  // Export settings to JSON
  exportSettings(): string {
    return JSON.stringify(this.settings, null, 2)
  }

  // Import settings from JSON
  importSettings(settingsJson: string): boolean {
    try {
      const imported = JSON.parse(settingsJson)
      const merged = this.mergeWithDefaults(imported)
      this.settings = merged
      this.saveSettings()
      this.notifyListeners()
      return true
    } catch (error) {
      console.error('Failed to import settings:', error)
      return false
    }
  }

  // Get a specific setting value
  getSetting<T extends keyof AppSettings, K extends keyof AppSettings[T]>(
    category: T,
    key: K
  ): AppSettings[T][K] {
    return this.settings[category][key]
  }

  // Check if settings have been modified from defaults
  hasModifications(): boolean {
    return JSON.stringify(this.settings) !== JSON.stringify(DEFAULT_SETTINGS)
  }

  // Apply theme settings to CSS variables
  applyTheme(): void {
    const appearance = this.settings.appearance
    const root = document.documentElement
    
    // Apply theme class
    root.classList.remove('light', 'dark')
    if (appearance.theme === 'system') {
      const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches
      root.classList.add(prefersDark ? 'dark' : 'light')
    } else {
      root.classList.add(appearance.theme)
    }

    // Apply custom theme colors if available
    if (appearance.customTheme) {
      const theme = appearance.customTheme
      root.style.setProperty('--background', theme.background)
      root.style.setProperty('--foreground', theme.foreground)
      root.style.setProperty('--primary', theme.primary)
      root.style.setProperty('--secondary', theme.secondary)
      root.style.setProperty('--accent', theme.accent)
      root.style.setProperty('--muted', theme.muted)
      root.style.setProperty('--border', theme.border)
      
      // Also set the primary-related variables
      root.style.setProperty('--primary-foreground', this.getContrastColor(theme.primary))
    } else {
      // Apply primary color and derive related colors
      const primaryColor = appearance.primaryColor
      root.style.setProperty('--primary', primaryColor)
      
      // Convert hex to HSL for better color manipulation
      const hsl = this.hexToHsl(primaryColor)
      if (hsl) {
        // Generate related colors based on primary
        root.style.setProperty('--primary', `hsl(${hsl.h}, ${hsl.s}%, ${hsl.l}%)`)
        root.style.setProperty('--primary-foreground', this.getContrastColor(primaryColor))
        
        // Generate hover/active states
        const hoverL = Math.max(hsl.l - 10, 0)
        const activeL = Math.max(hsl.l - 15, 0)
        root.style.setProperty('--primary-hover', `hsl(${hsl.h}, ${hsl.s}%, ${hoverL}%)`)
        root.style.setProperty('--primary-active', `hsl(${hsl.h}, ${hsl.s}%, ${activeL}%)`)
        
        // Generate secondary color (desaturated primary)
        const secS = Math.max(hsl.s - 30, 10)
        const secL = appearance.theme === 'dark' ? 20 : 80
        root.style.setProperty('--secondary', `hsl(${hsl.h}, ${secS}%, ${secL}%)`)
        
        // Generate accent color (slightly different hue)
        const accH = (hsl.h + 30) % 360
        root.style.setProperty('--accent', `hsl(${accH}, ${hsl.s}%, ${hsl.l}%)`)
      }
    }

    // Apply font size
    const fontSizeMap = {
      small: '14px',
      medium: '16px',
      large: '18px'
    }
    root.style.setProperty('--base-font-size', fontSizeMap[appearance.fontSize])

    // Apply animations setting
    if (!appearance.showAnimations) {
      root.style.setProperty('--animation-duration', '0ms')
      root.style.setProperty('--transition-duration', '0ms')
    } else {
      root.style.removeProperty('--animation-duration')
      root.style.removeProperty('--transition-duration')
    }
  }

  // Helper function to convert hex to HSL
  private hexToHsl(hex: string): { h: number; s: number; l: number } | null {
    // Remove the hash if present
    hex = hex.replace('#', '')
    
    // Parse the hex values
    const r = parseInt(hex.slice(0, 2), 16) / 255
    const g = parseInt(hex.slice(2, 4), 16) / 255
    const b = parseInt(hex.slice(4, 6), 16) / 255
    
    const max = Math.max(r, g, b)
    const min = Math.min(r, g, b)
    let h = 0
    let s = 0
    const l = (max + min) / 2
    
    if (max !== min) {
      const d = max - min
      s = l > 0.5 ? d / (2 - max - min) : d / (max + min)
      
      switch (max) {
        case r: h = (g - b) / d + (g < b ? 6 : 0); break
        case g: h = (b - r) / d + 2; break
        case b: h = (r - g) / d + 4; break
      }
      h /= 6
    }
    
    return {
      h: Math.round(h * 360),
      s: Math.round(s * 100),
      l: Math.round(l * 100)
    }
  }

  // Helper function to get contrast color (white or black)
  private getContrastColor(hex: string): string {
    // Convert hex to RGB
    const r = parseInt(hex.slice(1, 3), 16)
    const g = parseInt(hex.slice(3, 5), 16)
    const b = parseInt(hex.slice(5, 7), 16)
    
    // Calculate luminance
    const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255
    
    // Return white or black based on luminance
    return luminance > 0.5 ? '#000000' : '#ffffff'
  }
}

// Export singleton instance
export const settingsService = SettingsService.getInstance()

// Apply theme on service initialization
settingsService.applyTheme()

// Listen for system theme changes
if (typeof window !== 'undefined') {
  window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => {
    if (settingsService.getSetting('appearance', 'theme') === 'system') {
      settingsService.applyTheme()
    }
  })
}
