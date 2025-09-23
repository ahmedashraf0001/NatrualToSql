import React, { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Database, Minus, Square, X, Copy } from 'lucide-react'

interface TitleBarProps {
  title?: string
}

// Extend CSS types for Electron's webkit properties
declare module 'react' {
  interface CSSProperties {
    WebkitAppRegion?: 'drag' | 'no-drag'
  }
}

const TitleBar: React.FC<TitleBarProps> = ({ title = 'NaturalToSQL' }) => {
  const [isMaximized, setIsMaximized] = useState(false)
  const [isElectron, setIsElectron] = useState(false)

  useEffect(() => {
    // Check if running in Electron
    setIsElectron(!!window.electronAPI)
    
    if (window.electronAPI && window.electronAPI.windowIsMaximized) {
      // Get initial maximized state
      window.electronAPI.windowIsMaximized().then(setIsMaximized).catch(console.error)
    }

    // Listen for window state changes from main process
    const handleMaximizeStateChange = (isMaximized: boolean) => {
      setIsMaximized(isMaximized)
    }

    // Add event listeners if available
    if (window.electronAPI && window.electronAPI.on) {
      window.electronAPI.on('window-maximized', handleMaximizeStateChange)
    }

    return () => {
      // Clean up event listeners
      if (window.electronAPI && window.electronAPI.removeListener) {
        window.electronAPI.removeListener('window-maximized', handleMaximizeStateChange)
      }
    }
  }, [])

  const handleMinimize = async () => {
    if (window.electronAPI && window.electronAPI.windowMinimize) {
      try {
        await window.electronAPI.windowMinimize()
      } catch (error) {
        console.error('Error handling window minimize:', error)
      }
    }
  }

  const handleMaximize = async () => {
    if (window.electronAPI && window.electronAPI.windowMaximize) {
      try {
        await window.electronAPI.windowMaximize()
        // Update state after maximize/unmaximize
        if (window.electronAPI.windowIsMaximized) {
          const maximized = await window.electronAPI.windowIsMaximized()
          setIsMaximized(maximized)
        }
      } catch (error) {
        console.error('Error handling window maximize:', error)
      }
    }
  }

  const handleClose = async () => {
    if (window.electronAPI && window.electronAPI.windowClose) {
      try {
        await window.electronAPI.windowClose()
      } catch (error) {
        console.error('Error handling window close:', error)
      }
    }
  }

  // Don't render custom title bar if not in Electron
  if (!isElectron) {
    return null
  }

  return (
    <div 
      className="flex items-center justify-between h-8 bg-background/95 backdrop-blur-sm border-b border-border/50 select-none"
      style={{ 
        WebkitAppRegion: 'drag',
        position: 'relative',
        zIndex: 1000
      }}
    >
      {/* Left section - App icon and title */}
      <div className="flex items-center px-3 space-x-2 h-full">
        <Database className="w-3.5 h-3.5 text-primary flex-shrink-0" />
        <span className="text-xs font-medium text-foreground/90 truncate">{title}</span>
      </div>

      {/* Right section - Window controls */}
      <div className="flex items-center h-full">
        <Button
          variant="ghost"
          size="sm"
          className="h-8 w-12 p-0 rounded-none hover:bg-muted/70 focus:bg-muted/70 transition-colors"
          style={{ WebkitAppRegion: 'no-drag' }}
          onClick={handleMinimize}
          title="Minimize"
        >
          <Minus className="w-3 h-3" />
        </Button>
        
        <Button
          variant="ghost"
          size="sm"
          className="h-8 w-12 p-0 rounded-none hover:bg-muted/70 focus:bg-muted/70 transition-colors"
          style={{ WebkitAppRegion: 'no-drag' }}
          onClick={handleMaximize}
          title={isMaximized ? "Restore Down" : "Maximize"}
        >
          {isMaximized ? (
            <Copy className="w-3 h-3" />
          ) : (
            <Square className="w-3 h-3" />
          )}
        </Button>
        
        <Button
          variant="ghost"
          size="sm"
          className="h-8 w-16 p-0 rounded-none hover:bg-red-500 hover:text-white focus:bg-red-500 focus:text-white transition-colors"
          style={{ WebkitAppRegion: 'no-drag' }}
          onClick={handleClose}
          title="Close"
        >
          <X className="w-4 h-4" />
        </Button>
      </div>
    </div>
  )
}

export default TitleBar
