import { motion, AnimatePresence } from 'framer-motion'
import { Progress } from './ui/progress'
import { X, Download, Clock, Gauge } from 'lucide-react'
import { Button } from './ui/button'

export interface DownloadInfo {
  id: string
  title: string
  description?: string
  progress: number
  size?: string
  downloadSpeed?: string
  timeEstimate?: string
  status: 'downloading' | 'completed' | 'error' | 'cancelled'
  error?: string
  cancellable?: boolean
}

interface GlobalDownloadProgressProps {
  downloads: DownloadInfo[]
  onCancel?: (downloadId: string) => void
  onDismiss?: (downloadId: string) => void
}

export function GlobalDownloadProgress({ 
  downloads, 
  onCancel, 
  onDismiss 
}: GlobalDownloadProgressProps) {
  const activeDownloads = downloads.filter(d => 
    d.status === 'downloading' || 
    (d.status === 'completed' && d.progress === 100) ||
    d.status === 'error'
  )

  if (activeDownloads.length === 0) {
    return null
  }

  return (
    <div className="fixed top-4 right-4 z-[99999] space-y-2 max-w-md">
      <AnimatePresence>
        {activeDownloads.map((download) => (
          <motion.div
            key={download.id}
            initial={{ opacity: 0, x: 300, scale: 0.9 }}
            animate={{ opacity: 1, x: 0, scale: 1 }}
            exit={{ opacity: 0, x: 300, scale: 0.9 }}
            className={`
              bg-background/95 backdrop-blur-sm border rounded-lg shadow-lg p-4
              ${download.status === 'error' ? 'border-red-500/50' : 
                download.status === 'completed' ? 'border-green-500/50' : 
                'border-blue-500/50'}
            `}
          >
            <div className="flex items-start justify-between mb-3">
              <div className="flex items-center space-x-2">
                <div className={`
                  p-1.5 rounded-lg
                  ${download.status === 'error' ? 'bg-red-500/20 text-red-500' : 
                    download.status === 'completed' ? 'bg-green-500/20 text-green-500' : 
                    'bg-blue-500/20 text-blue-500'}
                `}>
                  <Download className="w-4 h-4" />
                </div>
                <div>
                  <h4 className="font-medium text-foreground text-sm">
                    {download.title}
                  </h4>
                  {download.description && (
                    <p className="text-xs text-muted-foreground">
                      {download.description}
                    </p>
                  )}
                </div>
              </div>
              
              <div className="flex items-center space-x-1">
                {download.cancellable && download.status === 'downloading' && onCancel && (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-6 w-6 p-0 hover:bg-red-500/20"
                    onClick={() => onCancel(download.id)}
                  >
                    <X className="w-3 h-3" />
                  </Button>
                )}
                {(download.status === 'completed' || download.status === 'error') && onDismiss && (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-6 w-6 p-0"
                    onClick={() => onDismiss(download.id)}
                  >
                    <X className="w-3 h-3" />
                  </Button>
                )}
              </div>
            </div>

            {/* Progress Bar */}
            {download.status === 'downloading' && (
              <div className="mb-3">
                <Progress 
                  value={download.progress} 
                  className="h-2"
                />
              </div>
            )}

            {/* Download Stats */}
            {download.status === 'downloading' && (
              <div className="flex items-center justify-between text-xs text-muted-foreground">
                <div className="flex items-center space-x-3">
                  {download.size && (
                    <span>{download.size}</span>
                  )}
                  {download.downloadSpeed && (
                    <div className="flex items-center space-x-1">
                      <Gauge className="w-3 h-3" />
                      <span>{download.downloadSpeed}</span>
                    </div>
                  )}
                  {download.timeEstimate && (
                    <div className="flex items-center space-x-1">
                      <Clock className="w-3 h-3" />
                      <span>{download.timeEstimate}</span>
                    </div>
                  )}
                </div>
                <span>{Math.round(download.progress)}%</span>
              </div>
            )}

            {/* Status Messages */}
            {download.status === 'completed' && (
              <div className="text-xs text-green-600 dark:text-green-400">
                Download completed successfully
              </div>
            )}

            {download.status === 'error' && (
              <div className="text-xs text-red-600 dark:text-red-400">
                {download.error || 'Download failed'}
              </div>
            )}
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  )
}