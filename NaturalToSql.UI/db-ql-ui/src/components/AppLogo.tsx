import React from 'react'
import { motion } from 'framer-motion'
import { Database, Brain, Code, Zap } from 'lucide-react'

interface AppLogoProps {
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl'
  animated?: boolean
  showOrbits?: boolean
  className?: string
}

const AppLogo: React.FC<AppLogoProps> = ({
  size = 'md',
  animated = false,
  showOrbits = false,
  className = ''
}) => {
  const sizeConfig = {
    xs: {
      container: 'w-8 h-8',
      icon: 'w-4 h-4',
      orbit: 'w-2 h-2'
    },
    sm: {
      container: 'w-12 h-12',
      icon: 'w-6 h-6',
      orbit: 'w-2 h-2'
    },
    md: {
      container: 'w-16 h-16',
      icon: 'w-8 h-8',
      orbit: 'w-3 h-3'
    },
    lg: {
      container: 'w-20 h-20',
      icon: 'w-10 h-10',
      orbit: 'w-4 h-4'
    },
    xl: {
      container: 'w-24 h-24',
      icon: 'w-12 h-12',
      orbit: 'w-4 h-4'
    }
  }

  const config = sizeConfig[size]

  return (
    <div className={`relative ${config.container} ${className}`}>
      {/* Main Logo */}
      <motion.div
        className={`${config.container} rounded-xl bg-gradient-to-br from-blue-500/10 to-purple-500/10 border border-blue-200/20 dark:border-blue-700/20`}
        whileHover={animated ? {
          scale: 1.05
        } : {}}
        transition={{
          duration: 0.2,
          ease: 'easeOut'
        }}
      >
        {/* Inner Logo Container */}
        <div className={`${config.container} rounded-lg flex items-center justify-center relative`}>
          {/* Subtle hover glow */}
          {animated && (
            <motion.div
              className="absolute inset-0 rounded-lg bg-gradient-to-br from-blue-500/5 to-purple-500/5"
              initial={{ opacity: 0 }}
              whileHover={{ opacity: 1 }}
              transition={{ duration: 0.2 }}
            />
          )}
          
          {/* Main Database Icon */}
          <Database className={`${config.icon} text-blue-600 dark:text-blue-400 relative z-10`} />
        </div>
      </motion.div>

      {/* Static orbiting elements (no rotation) */}
      {showOrbits && (
        <div className="absolute inset-0">
          {[Brain, Code, Zap].map((Icon, index) => (
            <div
              key={index}
              className="absolute"
              style={{
                top: index === 0 ? '10%' : index === 1 ? '85%' : '50%',
                left: index === 0 ? '85%' : index === 1 ? '15%' : '85%',
                transform: 'translate(-50%, -50%)'
              }}
            >
              <Icon className={`${config.orbit} text-blue-500/40 dark:text-blue-400/40`} />
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

export default AppLogo
