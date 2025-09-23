"use strict";
const { contextBridge, ipcRenderer } = require('electron');
const electronAPI = {
    getAppVersion: () => ipcRenderer.invoke('get-app-version'),
    checkApiHealth: () => ipcRenderer.invoke('check-api-health'),
    windowMinimize: () => ipcRenderer.invoke('window-minimize'),
    windowMaximize: () => ipcRenderer.invoke('window-maximize'),
    windowClose: () => ipcRenderer.invoke('window-close'),
    windowIsMaximized: () => ipcRenderer.invoke('window-is-maximized'),
    saveGroqApiKey: (apiKey) => ipcRenderer.invoke('save-groq-api-key', apiKey),
    getGroqApiKeyStatus: () => ipcRenderer.invoke('get-groq-api-key-status'),
    startApiProcess: (setupType) => ipcRenderer.invoke('start-api-process', setupType),
    stopApiProcess: () => ipcRenderer.invoke('stop-api-process'),
    getApiProcessStatus: () => ipcRenderer.invoke('get-api-process-status'),
    checkOllamaStatus: () => ipcRenderer.invoke('check-ollama-status'),
    checkLocalLLMHealth: () => ipcRenderer.invoke('check-local-llm-health'),
    installOllamaSetup: () => ipcRenderer.invoke('install-ollama-setup'),
    cancelOllamaInstallation: () => ipcRenderer.invoke('cancel-ollama-installation'),
    startOllamaModel: () => ipcRenderer.invoke('start-ollama-model'),
    stopOllama: () => ipcRenderer.invoke('stop-ollama'),
    on: (channel, callback) => {
        ipcRenderer.on(channel, (_event, data) => callback(data));
    },
    removeListener: (channel, callback) => {
        ipcRenderer.removeListener(channel, callback);
    },
    onGlobalDownloadProgress: (callback) => {
        ipcRenderer.on('global-download-progress', (_event, data) => callback(data));
    },
    removeGlobalDownloadProgressListener: (callback) => {
        ipcRenderer.removeListener('global-download-progress', callback);
    }
};
// Expose the API to the renderer process
contextBridge.exposeInMainWorld('electronAPI', electronAPI);
