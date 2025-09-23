import React from 'react'
import { createPortal } from 'react-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { NotificationMessage } from '@/types'
import { cn } from '@/lib/utils'
import { X, CheckCircle, AlertCircle, AlertTriangle, Info } from 'lucide-react'

interface NotificationContainerProps {
  notifications: NotificationMessage[]
  onRemoveNotification: (id: string) => void
}

const NotificationContainer: React.FC<NotificationContainerProps> = ({
  notifications,
  onRemoveNotification
}) => {
  const getIcon = (type: NotificationMessage['type'], title?: string) => {
    // Special icon styling for connection-related success messages - make them more prominent
    if (type === 'success' && (title === 'Connected' || title === 'Connection Restored')) {
      return <CheckCircle className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
    }
    
    switch (type) {
      case 'success':
        return <CheckCircle className="w-5 h-5 text-green-500" />
      case 'error':
        return <AlertCircle className="w-5 h-5 text-red-500" />
      case 'warning':
        return <AlertTriangle className="w-5 h-5 text-yellow-500" />
      case 'info':
        return <Info className="w-5 h-5 text-blue-500" />
      default:
        return <Info className="w-5 h-5 text-blue-500" />
    }
  }

  const getBackgroundColor = (type: NotificationMessage['type'], title?: string) => {
    // Special styling for connection-related success messages - make them solid like other notifications
    if (type === 'success' && (title === 'Connected' || title === 'Connection Restored')) {
      return 'bg-emerald-50 border-emerald-200 dark:bg-emerald-900 dark:border-emerald-700'
    }
    
    switch (type) {
      case 'success':
        return 'bg-green-50 border-green-200 dark:bg-green-900/20 dark:border-green-800'
      case 'error':
        return 'bg-red-50 border-red-200 dark:bg-red-900/20 dark:border-red-800'
      case 'warning':
        return 'bg-yellow-50 border-yellow-200 dark:bg-yellow-900/20 dark:border-yellow-800'
      case 'info':
        return 'bg-blue-50 border-blue-200 dark:bg-blue-900/20 dark:border-blue-800'
      default:
        return 'bg-blue-50 border-blue-200 dark:bg-blue-900/20 dark:border-blue-800'
    }
  }

  if (notifications.length === 0) return null

  return createPortal(
    <div className="fixed top-12 right-4 z-[9999] max-w-sm pointer-events-none">
      <AnimatePresence mode="popLayout">
        {notifications.map((notification) => {
          const isConnectionNotification = notification.type === 'success' && 
            (notification.title === 'Connected' || notification.title === 'Connection Restored')
          
          return (
            <motion.div
              key={notification.id}
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
              className={cn(
                'p-4 rounded-lg border shadow-lg mb-2 pointer-events-auto',
                getBackgroundColor(notification.type, notification.title),
                isConnectionNotification && 'ring-2 ring-emerald-300/50 dark:ring-emerald-600/50'
              )}
            >
              <div className="flex items-start space-x-3">
                <div className="flex-shrink-0">
                  {getIcon(notification.type, notification.title)}
                </div>
                
                <div className="flex-1 min-w-0">
                  <h4 className={cn(
                    "text-sm font-semibold",
                    isConnectionNotification 
                      ? "text-emerald-800 dark:text-emerald-200" 
                      : "text-foreground"
                  )}>
                    {notification.title}
                  </h4>
                  <p className={cn(
                    "text-sm mt-1",
                    isConnectionNotification 
                      ? "text-emerald-700 dark:text-emerald-300" 
                      : "text-muted-foreground"
                  )}>
                    {notification.message}
                  </p>
                </div>
                
                <button
                  onClick={() => onRemoveNotification(notification.id)}
                  className="flex-shrink-0 ml-auto text-muted-foreground hover:text-foreground transition-colors"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </motion.div>
          )
        })}
      </AnimatePresence>
    </div>,
    document.body
  )
}

export default NotificationContainer
