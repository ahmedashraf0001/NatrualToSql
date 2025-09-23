const { contextBridge, ipcRenderer } = require('electron')

// Define the API that will be exposed to the renderer process
interface ElectronAPI {
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
  cancelOllamaInstallation: () => Promise<{ success: boolean; message?: string; error?: string }>
  startOllamaModel: () => Promise<{ success: boolean; message?: string; error?: string }>
  stopOllama: () => Promise<{ success: boolean; message?: string; error?: string }>
  on: (channel: string, callback: (data: any) => void) => void
  removeListener: (channel: string, callback: (data: any) => void) => void
  // Global download progress events
  onGlobalDownloadProgress: (callback: (data: any) => void) => void
  removeGlobalDownloadProgressListener: (callback: (data: any) => void) => void
}

const electronAPI: ElectronAPI = {
  getAppVersion: () => ipcRenderer.invoke('get-app-version'),
  checkApiHealth: () => ipcRenderer.invoke('check-api-health'),
  windowMinimize: () => ipcRenderer.invoke('window-minimize'),
  windowMaximize: () => ipcRenderer.invoke('window-maximize'),
  windowClose: () => ipcRenderer.invoke('window-close'),
  windowIsMaximized: () => ipcRenderer.invoke('window-is-maximized'),
  saveGroqApiKey: (apiKey: string) => ipcRenderer.invoke('save-groq-api-key', apiKey),
  getGroqApiKeyStatus: () => ipcRenderer.invoke('get-groq-api-key-status'),
  startApiProcess: (setupType: 'groq' | 'local' | 'basic') => ipcRenderer.invoke('start-api-process', setupType),
  stopApiProcess: () => ipcRenderer.invoke('stop-api-process'),
  getApiProcessStatus: () => ipcRenderer.invoke('get-api-process-status'),
  checkOllamaStatus: () => ipcRenderer.invoke('check-ollama-status'),
  checkLocalLLMHealth: () => ipcRenderer.invoke('check-local-llm-health'),
  installOllamaSetup: () => ipcRenderer.invoke('install-ollama-setup'),
  cancelOllamaInstallation: () => ipcRenderer.invoke('cancel-ollama-installation'),
  startOllamaModel: () => ipcRenderer.invoke('start-ollama-model'),
  stopOllama: () => ipcRenderer.invoke('stop-ollama'),
  on: (channel: string, callback: (data: any) => void) => {
    ipcRenderer.on(channel, (_event: any, data: any) => callback(data))
  },
  removeListener: (channel: string, callback: (data: any) => void) => {
    ipcRenderer.removeListener(channel, callback)
  },
  onGlobalDownloadProgress: (callback: (data: any) => void) => {
    ipcRenderer.on('global-download-progress', (_event: any, data: any) => callback(data))
  },
  removeGlobalDownloadProgressListener: (callback: (data: any) => void) => {
    ipcRenderer.removeListener('global-download-progress', callback)
  }
}

// Expose the API to the renderer process
contextBridge.exposeInMainWorld('electronAPI', electronAPI)
