import React, { useEffect } from 'react'
import { createPortal } from 'react-dom'
import { X } from 'lucide-react'
import { Button } from './button'

interface DialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  children: React.ReactNode
  className?: string
}

interface DialogContentProps {
  children: React.ReactNode
  className?: string
  showCloseButton?: boolean
  onClose?: () => void
}

interface DialogHeaderProps {
  children: React.ReactNode
  className?: string
}

interface DialogTitleProps {
  children: React.ReactNode
  className?: string
}

interface DialogDescriptionProps {
  children: React.ReactNode
  className?: string
}

export const Dialog: React.FC<DialogProps> = ({ open, onOpenChange, children, className = '' }) => {
  useEffect(() => {
    if (open) {
      document.body.style.overflow = 'hidden'
    } else {
      document.body.style.overflow = 'unset'
    }

    return () => {
      document.body.style.overflow = 'unset'
    }
  }, [open])

  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onOpenChange(false)
      }
    }

    if (open) {
      document.addEventListener('keydown', handleEscape)
    }

    return () => {
      document.removeEventListener('keydown', handleEscape)
    }
  }, [open, onOpenChange])

  if (!open) return null

  const borderRadius = className.includes('max-w-5xl') ? 'rounded-3xl' : 'rounded-2xl';
  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center p-6 sm:p-8">
      {/* Backdrop */}
      <div 
        className="fixed inset-0 bg-black/60 backdrop-blur-md"
        onClick={() => onOpenChange(false)}
      />
      
      {/* Dialog content */}
      <div className={`relative bg-background border ${borderRadius} shadow-xl w-full max-h-[85vh] overflow-hidden ${className.includes('max-w-') ? className : `max-w-4xl ${className}`}`}>
        {/* Close button */}
        <Button
          variant="ghost"
          size="sm"
          className="absolute right-4 top-4 z-10 hover:bg-muted rounded-full"
          onClick={() => onOpenChange(false)}
        >
          <X className="w-4 h-4" />
        </Button>
        <div className={`overflow-auto scrollbar-hide max-h-[85vh] ${borderRadius}`}>
          {children}
        </div>
      </div>
    </div>,
    document.body
  )
}

export const DialogContent: React.FC<DialogContentProps> = ({ 
  children, 
  className = '', 
  showCloseButton = true,
  onClose 
}) => {
  return (
    <div className={`relative ${className}`}>
      {showCloseButton && (
        <Button
          variant="ghost"
          size="sm"
          className="absolute right-4 top-4 z-10 rounded-full"
          onClick={onClose}
        >
          <X className="w-4 h-4" />
        </Button>
      )}
      {children}
    </div>
  )
}

export const DialogHeader: React.FC<DialogHeaderProps> = ({ children, className = '' }) => {
  return (
    <div className={`p-6 pb-4 ${className}`}>
      {children}
    </div>
  )
}

export const DialogTitle: React.FC<DialogTitleProps> = ({ children, className = '' }) => {
  return (
    <h2 className={`text-lg font-semibold leading-none tracking-tight ${className}`}>
      {children}
    </h2>
  )
}

export const DialogDescription: React.FC<DialogDescriptionProps> = ({ children, className = '' }) => {
  return (
    <p className={`text-sm text-muted-foreground ${className}`}>
      {children}
    </p>
  )
}
