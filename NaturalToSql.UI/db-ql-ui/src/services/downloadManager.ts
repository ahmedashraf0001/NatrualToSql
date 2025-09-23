import { DownloadInfo } from '../components/GlobalDownloadProgress'

type DownloadListener = (downloads: DownloadInfo[]) => void

class DownloadManagerService {
  private downloads: Map<string, DownloadInfo> = new Map()
  private listeners: Set<DownloadListener> = new Set()

  // Subscribe to download updates
  subscribe(listener: DownloadListener): () => void {
    this.listeners.add(listener)
    // Immediately notify with current downloads
    listener(Array.from(this.downloads.values()))
    
    // Return unsubscribe function
    return () => {
      this.listeners.delete(listener)
    }
  }

  // Notify all listeners
  private notifyListeners() {
    const downloads = Array.from(this.downloads.values())
    this.listeners.forEach(listener => listener(downloads))
  }

  // Start a new download
  startDownload(download: Omit<DownloadInfo, 'status'>): void {
    const downloadInfo: DownloadInfo = {
      ...download,
      status: 'downloading'
    }
    
    this.downloads.set(download.id, downloadInfo)
    this.notifyListeners()
    
    console.log(`📥 Download started: ${download.title} (${download.id})`)
  }

  // Update download progress
  updateProgress(id: string, updates: Partial<Pick<DownloadInfo, 'progress' | 'size' | 'downloadSpeed' | 'timeEstimate' | 'description'>>): void {
    const download = this.downloads.get(id)
    if (!download) {
      console.warn(`📥 Attempted to update non-existent download: ${id}`)
      return
    }

    const updatedDownload = { ...download, ...updates }
    this.downloads.set(id, updatedDownload)
    this.notifyListeners()
  }

  // Complete a download
  completeDownload(id: string): void {
    const download = this.downloads.get(id)
    if (!download) {
      console.warn(`📥 Attempted to complete non-existent download: ${id}`)
      return
    }

    const completedDownload: DownloadInfo = {
      ...download,
      status: 'completed',
      progress: 100
    }
    
    this.downloads.set(id, completedDownload)
    this.notifyListeners()
    
    console.log(`✅ Download completed: ${download.title} (${id})`)

    // Auto-remove completed downloads after 5 seconds
    setTimeout(() => {
      this.removeDownload(id)
    }, 5000)
  }

  // Mark download as failed
  failDownload(id: string, error: string): void {
    const download = this.downloads.get(id)
    if (!download) {
      console.warn(`📥 Attempted to fail non-existent download: ${id}`)
      return
    }

    const failedDownload: DownloadInfo = {
      ...download,
      status: 'error',
      error
    }
    
    this.downloads.set(id, failedDownload)
    this.notifyListeners()
    
    console.error(`❌ Download failed: ${download.title} (${id}) - ${error}`)

    // Auto-remove failed downloads after 10 seconds
    setTimeout(() => {
      this.removeDownload(id)
    }, 10000)
  }

  // Cancel a download
  cancelDownload(id: string): void {
    const download = this.downloads.get(id)
    if (!download) {
      console.warn(`📥 Attempted to cancel non-existent download: ${id}`)
      return
    }

    const cancelledDownload: DownloadInfo = {
      ...download,
      status: 'cancelled'
    }
    
    this.downloads.set(id, cancelledDownload)
    this.notifyListeners()
    
    console.log(`🚫 Download cancelled: ${download.title} (${id})`)

    // Auto-remove cancelled downloads after 3 seconds
    setTimeout(() => {
      this.removeDownload(id)
    }, 3000)
  }

  // Remove a download from the list
  removeDownload(id: string): void {
    if (this.downloads.has(id)) {
      const download = this.downloads.get(id)!
      this.downloads.delete(id)
      this.notifyListeners()
      console.log(`🗑️ Download removed: ${download.title} (${id})`)
    }
  }

  // Get current downloads
  getDownloads(): DownloadInfo[] {
    return Array.from(this.downloads.values())
  }

  // Get a specific download
  getDownload(id: string): DownloadInfo | undefined {
    return this.downloads.get(id)
  }

  // Check if any downloads are active
  hasActiveDownloads(): boolean {
    return Array.from(this.downloads.values()).some(d => d.status === 'downloading')
  }

  // Clear all downloads
  clearAll(): void {
    this.downloads.clear()
    this.notifyListeners()
    console.log('🧹 All downloads cleared')
  }
}

// Export singleton instance
export const downloadManager = new DownloadManagerService()