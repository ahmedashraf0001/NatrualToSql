import React, { createContext, useContext, useState, useCallback, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { CheckCircle, AlertCircle, Info, X } from 'lucide-react'
import { Button } from './button'

interface Toast {
  id: string
  type: 'success' | 'error' | 'warning' | 'info'
  title: string
  message: string
  duration?: number
}

interface ToastContextType {
  toasts: Toast[]
  addToast: (toast: Omit<Toast, 'id'>) => void
  removeToast: (id: string) => void
}

const ToastContext = createContext<ToastContextType | undefined>(undefined)

export const useToast = () => {
  const context = useContext(ToastContext)
  if (!context) {
    throw new Error('useToast must be used within a ToastProvider')
  }
  return context
}

interface ToastProviderProps {
  children: React.ReactNode
}

export const ToastProvider: React.FC<ToastProviderProps> = ({ children }) => {
  const [toasts, setToasts] = useState<Toast[]>([])
  const timeoutRefsRef = useRef<Map<string, NodeJS.Timeout>>(new Map())

  const addToast = useCallback((toast: Omit<Toast, 'id'>) => {
    const id = Date.now().toString() + Math.random().toString(36).substr(2, 9)
    const newToast = { ...toast, id }
    
    // Limit toasts to prevent UI overflow (max 5)
    setToasts(prev => {
      const updated = [...prev, newToast]
      if (updated.length > 5) {
        // Remove oldest toasts and clear their timeouts
        const toRemove = updated.slice(0, updated.length - 5)
        toRemove.forEach(t => {
          const timeoutId = timeoutRefsRef.current.get(t.id)
          if (timeoutId) {
            clearTimeout(timeoutId)
            timeoutRefsRef.current.delete(t.id)
          }
        })
        return updated.slice(-5)
      }
      return updated
    })
    
    // Auto-remove after duration with proper cleanup
    const duration = toast.duration || 5000
    const timeoutId = setTimeout(() => {
      setToasts(prev => prev.filter(t => t.id !== id))
      timeoutRefsRef.current.delete(id)
    }, duration)
    
    // Store timeout reference for cleanup
    timeoutRefsRef.current.set(id, timeoutId)
  }, [])

  const removeToast = useCallback((id: string) => {
    // Clear timeout if it exists
    const timeoutId = timeoutRefsRef.current.get(id)
    if (timeoutId) {
      clearTimeout(timeoutId)
      timeoutRefsRef.current.delete(id)
    }
    setToasts(prev => prev.filter(t => t.id !== id))
  }, [])

  // Cleanup all timeouts on unmount
  React.useEffect(() => {
    return () => {
      timeoutRefsRef.current.forEach((timeoutId) => {
        clearTimeout(timeoutId)
      })
      timeoutRefsRef.current.clear()
    }
  }, [])

  return (
    <ToastContext.Provider value={{ toasts, addToast, removeToast }}>
      {children}
      <ToastContainer />
    </ToastContext.Provider>
  )
}

const ToastContainer: React.FC = () => {
  const { toasts, removeToast } = useToast()

  return (
    <div className="fixed top-12 right-4 z-[9998] max-w-md pointer-events-none">
      <AnimatePresence mode="popLayout">
        {toasts.map((toast) => (
          <motion.div
            key={toast.id}
            layout
            initial={{ 
              opacity: 0, 
              x: 400, 
              scale: 0.8 
            }}
            animate={{ 
              opacity: 1, 
              x: 0, 
              scale: 1 
            }}
            exit={{ 
              opacity: 0, 
              x: 400, 
              scale: 0.8,
              transition: { duration: 0.2 }
            }}
            transition={{
              type: "spring",
              stiffness: 300,
              damping: 30,
              layout: { duration: 0.3 }
            }}
            className="mb-2 pointer-events-auto"
          >
            <ToastItem toast={toast} onRemove={removeToast} />
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  )
}

interface ToastItemProps {
  toast: Toast
  onRemove: (id: string) => void
}

const ToastItem: React.FC<ToastItemProps> = ({ toast, onRemove }) => {
  const getIcon = () => {
    switch (toast.type) {
      case 'success':
        return <CheckCircle className="w-5 h-5 text-green-500 mt-0.5 flex-shrink-0" />
      case 'error':
        return <AlertCircle className="w-5 h-5 text-red-500 mt-0.5 flex-shrink-0" />
      case 'warning':
        return <AlertCircle className="w-5 h-5 text-yellow-500 mt-0.5 flex-shrink-0" />
      case 'info':
        return <Info className="w-5 h-5 text-blue-500 mt-0.5 flex-shrink-0" />
      default:
        return <Info className="w-5 h-5 text-blue-500 mt-0.5 flex-shrink-0" />
    }
  }

  const getBorderColor = () => {
    switch (toast.type) {
      case 'success':
        return 'border-green-500'
      case 'error':
        return 'border-red-500'
      case 'warning':
        return 'border-yellow-500'
      case 'info':
        return 'border-blue-500'
      default:
        return 'border-blue-500'
    }
  }

  return (
    <div
      className={`p-4 rounded-lg shadow-lg border-l-4 bg-card border-border ${getBorderColor()}`}
    >
      <div className="flex items-start justify-between">
        <div className="flex items-start space-x-3 flex-1">
          {getIcon()}
          <div className="flex-1 min-w-0">
            <h4 className="font-medium text-sm text-foreground break-words">
              {toast.title}
            </h4>
            <p className="text-sm text-muted-foreground mt-1 break-words leading-relaxed">
              {toast.message}
            </p>
            {/* Add timestamp for error notifications */}
            {toast.type === 'error' && (
              <p className="text-xs text-muted-foreground mt-2">
                {new Date().toLocaleTimeString()}
              </p>
            )}
          </div>
        </div>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => onRemove(toast.id)}
          className="h-auto p-1 hover:bg-muted ml-2 flex-shrink-0"
        >
          <X className="w-4 h-4" />
        </Button>
      </div>
    </div>
  )
}

// Helper function to show execution error notifications
export const showExecutionError = (addToast: ToastContextType['addToast'], error: any) => {
  let title = 'Query Execution Failed'
  let message = 'Failed to execute query'
  
  if (error.source && error.errors) {
    // This is an API error with the specific format
    title = `${error.source} (${error.statusCode})`
    
    // Extract the main error message
    if (error.errors.errorMessage) {
      message = error.errors.errorMessage
    } else if (typeof error.errors === 'string') {
      message = error.errors
    } else if (Array.isArray(error.errors) && error.errors.length > 0) {
      message = error.errors[0]
    }
  } else if (error.message) {
    // Standard JavaScript error
    message = error.message
  }
  
  addToast({
    type: 'error',
    title,
    message,
    duration: 8000 // Longer duration for errors
  })
}

// Helper function to show generation error notifications
export const showGenerationError = (addToast: ToastContextType['addToast'], error: any) => {
  let title = 'SQL Generation Error'
  let message = 'Failed to generate SQL query'
  
  if (error.source && error.errors) {
    // This is an API error with the specific format
    title = `${error.source} (${error.statusCode})`
    
    // Extract the main error message
    if (error.errors.errorMessage) {
      message = error.errors.errorMessage
    } else if (typeof error.errors === 'string') {
      message = error.errors
    } else if (Array.isArray(error.errors) && error.errors.length > 0) {
      message = error.errors[0]
    }
  } else if (error.message) {
    // Standard JavaScript error
    message = error.message
  }
  
  addToast({
    type: 'error',
    title,
    message,
    duration: 6000
  })
}

export default ToastProvider
