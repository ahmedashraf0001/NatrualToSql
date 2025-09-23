export interface ElectronAPI {
  getAppVersion: () => Promise<string>
  checkApiHealth: () => Promise<any>
  windowMinimize: () => Promise<void>
  windowMaximize: () => Promise<void>
  windowClose: () => Promise<void>
  windowIsMaximized: () => Promise<boolean>
  saveGroqApiKey: (apiKey: string) => Promise<{ success: boolean; message?: string }>
  getGroqApiKeyStatus: () => Promise<{ hasApiKey: boolean; keyPrefix?: string }>
  startApiProcess: (setupType: 'groq' | 'local' | 'basic') => Promise<{ success: boolean; message?: string }>
  stopApiProcess: () => Promise<{ success: boolean; message?: string }>
  getApiProcessStatus: () => Promise<{ isRunning: boolean; pid?: number | null }>
  checkOllamaStatus: () => Promise<{ ollamaInstalled: boolean; modelInstalled: boolean; modelRunning: boolean; status: string; error?: string }>
  checkLocalLLMHealth: () => Promise<{ status: string; healthy: boolean; message: string; checks: { ollamaInstalled: boolean; ollamaApiRunning: boolean; modelAvailable: boolean; modelRunning: boolean } }>
  installOllamaSetup: () => Promise<{ success: boolean; message?: string; error?: string }>
  startOllamaModel: () => Promise<{ success: boolean; message?: string; error?: string }>
  stopOllama: () => Promise<{ success: boolean; message?: string; error?: string }>
  cancelOllamaInstallation: () => Promise<{ success: boolean; message?: string; error?: string }>
  on: (channel: string, callback: (data: any) => void) => void
  removeListener: (channel: string, callback: (data: any) => void) => void
  // Global download progress events
  onGlobalDownloadProgress: (callback: (data: any) => void) => void
  removeGlobalDownloadProgressListener: (callback: (data: any) => void) => void
}

declare global {
  interface Window {
    electronAPI?: ElectronAPI
  }
}
