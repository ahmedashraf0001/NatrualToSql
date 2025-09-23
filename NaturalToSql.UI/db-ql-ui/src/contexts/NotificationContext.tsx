import React, { createContext, useContext, useState, useCallback, useEffect } from 'react'

interface Notification {
  id: string
  type: 'success' | 'error' | 'warning' | 'info'
  title: string
  message: string
  timestamp: Date
  read: boolean
}

interface NotificationContextType {
  notifications: Notification[]
  addNotification: (notification: Omit<Notification, 'id' | 'timestamp' | 'read'>) => void
  markNotificationAsRead: (notificationId: string) => void
  clearAllNotifications: () => void
  markAllAsRead: () => void
  unreadCount: number
}

const NotificationContext = createContext<NotificationContextType | undefined>(undefined)

export const useNotifications = () => {
  const context = useContext(NotificationContext)
  if (!context) {
    throw new Error('useNotifications must be used within a NotificationProvider')
  }
  return context
}

interface NotificationProviderProps {
  children: React.ReactNode
}

export const NotificationProvider: React.FC<NotificationProviderProps> = ({ children }) => {
  const [notifications, setNotifications] = useState<Notification[]>([])
  
  // Load notifications from localStorage on mount
  useEffect(() => {
    const loadNotificationsFromStorage = () => {
      try {
        const stored = localStorage.getItem('notification-inbox')
        if (stored) {
          const parsedNotifications = JSON.parse(stored).map((notif: any) => ({
            ...notif,
            timestamp: new Date(notif.timestamp) // Parse timestamp back to Date object
          }))
          setNotifications(parsedNotifications)
        }
      } catch (error) {
        console.error('Failed to load notifications from localStorage:', error)
      }
    }
    
    loadNotificationsFromStorage()
  }, [])
  
  // Save notifications to localStorage whenever notifications change
  useEffect(() => {
    try {
      localStorage.setItem('notification-inbox', JSON.stringify(notifications))
    } catch (error) {
      console.error('Failed to save notifications to localStorage:', error)
    }
  }, [notifications])

  const addNotification = useCallback((notification: Omit<Notification, 'id' | 'timestamp' | 'read'>) => {
    const newNotification: Notification = {
      id: Date.now().toString(),
      timestamp: new Date(),
      read: false,
      ...notification,
    }
    
    setNotifications(prev => [newNotification, ...prev.slice(0, 49)]) // Keep last 50 notifications
  }, [])

  const markNotificationAsRead = useCallback((notificationId: string) => {
    setNotifications(prev => 
      prev.map(notif => 
        notif.id === notificationId ? { ...notif, read: true } : notif
      )
    )
  }, [])

  const clearAllNotifications = useCallback(() => {
    setNotifications([])
  }, [])

  const markAllAsRead = useCallback(() => {
    setNotifications(prev => 
      prev.map(notif => ({ ...notif, read: true }))
    )
  }, [])

  const unreadCount = notifications.filter(notif => !notif.read).length

  return (
    <NotificationContext.Provider 
      value={{ 
        notifications, 
        addNotification, 
        markNotificationAsRead, 
        clearAllNotifications, 
        markAllAsRead, 
        unreadCount 
      }}
    >
      {children}
    </NotificationContext.Provider>
  )
}
