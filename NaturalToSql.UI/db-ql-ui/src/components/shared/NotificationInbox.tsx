import React, { useRef, useEffect, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Bell, X, Mail, CheckCircle, AlertCircle, Sparkles } from 'lucide-react'
import { Button } from '../ui/button'
import { useNotifications } from '../../contexts/NotificationContext'

export const NotificationInbox: React.FC = () => {
  const { notifications, markNotificationAsRead, clearAllNotifications, markAllAsRead, unreadCount } = useNotifications()
  const [showInbox, setShowInbox] = useState(false)
  const inboxRef = useRef<HTMLDivElement>(null)
  const buttonRef = useRef<HTMLButtonElement>(null)

  // Close inbox when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (inboxRef.current && !inboxRef.current.contains(event.target as Node) &&
          buttonRef.current && !buttonRef.current.contains(event.target as Node)) {
        setShowInbox(false)
      }
    }

    if (showInbox) {
      document.addEventListener('mousedown', handleClickOutside)
      return () => document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [showInbox])

  // Mark all notifications as read when inbox is opened
  useEffect(() => {
    if (showInbox && unreadCount > 0) {
      markAllAsRead()
    }
  }, [showInbox, unreadCount, markAllAsRead])

  // Toggle function to ensure reliable state updates
  const toggleInbox = () => {
    setShowInbox(prev => !prev)
  }

  return (
    <div className="relative">
      {/* Inbox Button */}
      <Button
        ref={buttonRef}
        variant="ghost"
        size="icon"
        onClick={toggleInbox}
        className="relative"
      >
        <Bell className="w-4 h-4" />
        {/* Notification Badge */}
        {unreadCount > 0 && (
          <motion.div
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            className="absolute -top-1 -right-1 bg-red-500 text-white text-xs rounded-full w-5 h-5 flex items-center justify-center"
          >
            {unreadCount > 99 ? '99+' : unreadCount}
          </motion.div>
        )}
      </Button>

      {/* Notification Inbox Dropdown */}
      <AnimatePresence>
        {showInbox && (
          <motion.div 
            ref={inboxRef}
            initial={{ opacity: 0, scale: 0.95, y: -10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: -10 }}
            transition={{ duration: 0.2 }}
                        className="absolute right-0 top-full mt-2 w-96 max-h-[32rem] bg-card border border-border rounded-lg shadow-lg z-50 overflow-hidden"
          >
            <div className="flex items-center justify-between p-3 border-b border-border">
              <h3 className="font-medium text-sm text-foreground">Notifications</h3>
              <div className="flex gap-2">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={markAllAsRead}
                  className="text-xs"
                  disabled={unreadCount === 0}
                >
                  Mark all read
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={clearAllNotifications}
                  className="text-xs"
                >
                  Clear all
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setShowInbox(false)}
                >
                  <X className="w-3 h-3" />
                </Button>
              </div>
            </div>
            
            <div className="max-h-96 overflow-y-auto">
              {notifications.length === 0 ? (
                <div className="p-4 text-center text-muted-foreground">
                  <Mail className="w-8 h-8 mx-auto mb-2 opacity-50" />
                  <p className="text-sm">No notifications yet</p>
                </div>
              ) : (
                <div className="divide-y divide-border">
                  {notifications.map((notification) => (
                    <div
                      key={notification.id}
                      className={`p-3 hover:bg-muted cursor-pointer transition-colors ${
                        !notification.read ? 'bg-muted/50' : ''
                      }`}
                      onClick={() => markNotificationAsRead(notification.id)}
                    >
                      <div className="flex items-start gap-2">
                        <div className={`p-1 rounded-full flex-shrink-0 ${
                          notification.type === 'success' ? 'bg-green-100 text-green-600 dark:bg-green-900/30 dark:text-green-400' :
                          notification.type === 'error' ? 'bg-red-100 text-red-600 dark:bg-red-900/30 dark:text-red-400' :
                          notification.type === 'warning' ? 'bg-yellow-100 text-yellow-600 dark:bg-yellow-900/30 dark:text-yellow-400' :
                          'bg-blue-100 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400'
                        }`}>
                          {notification.type === 'success' && <CheckCircle className="w-3 h-3" />}
                          {notification.type === 'error' && <AlertCircle className="w-3 h-3" />}
                          {notification.type === 'warning' && <AlertCircle className="w-3 h-3" />}
                          {notification.type === 'info' && <Sparkles className="w-3 h-3" />}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-foreground">
                            {notification.title}
                          </p>
                          <p className="text-xs text-muted-foreground mt-1 line-clamp-2">
                            {notification.message}
                          </p>
                          <p className="text-xs text-muted-foreground mt-1">
                            {notification.timestamp.toLocaleString()}
                          </p>
                        </div>
                        {!notification.read && (
                          <div className="w-2 h-2 bg-blue-500 rounded-full flex-shrink-0 mt-1"></div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
