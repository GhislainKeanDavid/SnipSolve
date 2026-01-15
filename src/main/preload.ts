import { contextBridge, ipcRenderer } from 'electron'

contextBridge.exposeInMainWorld('electronAPI', {
  hideOverlay: () => ipcRenderer.invoke('hide-overlay'),
  captureScreenshot: (bounds: { x: number; y: number; width: number; height: number }) =>
    ipcRenderer.invoke('capture-screenshot', bounds),
  performOCR: (imageData: string) => ipcRenderer.invoke('perform-ocr', imageData),
  onOCRResult: (callback: (data: { text: string; bounds: any; timestamp: string }) => void) => {
    const listener = (event: any, data: any) => callback(data)
    ipcRenderer.on('ocr-result', listener)

    // Return cleanup function
    return () => {
      ipcRenderer.removeListener('ocr-result', listener)
    }
  },
  // Document management
  uploadDocument: () => ipcRenderer.invoke('upload-document'),
  getDocuments: () => ipcRenderer.invoke('get-documents'),
  getDocumentContent: (docId: string) => ipcRenderer.invoke('get-document-content', docId),
  downloadDocument: (docId: string) => ipcRenderer.invoke('download-document', docId),
  deleteDocument: (docId: string) => ipcRenderer.invoke('delete-document', docId),
  // Chat follow-up
  chatFollowup: (request: {
    message: string,
    captureContext: { text: string, aiSolution: string, relevantDocs: any[] },
    chatHistory: Array<{ role: 'user' | 'assistant', content: string }>
  }) => ipcRenderer.invoke('chat-followup', request),
  // Persistence
  loadCaptures: () => ipcRenderer.invoke('load-captures'),
  saveCaptures: (captures: any[]) => ipcRenderer.invoke('save-captures', captures),
  loadChats: () => ipcRenderer.invoke('load-chats'),
  saveChats: (chats: any[]) => ipcRenderer.invoke('save-chats', chats),
  // Settings
  getSettings: () => ipcRenderer.invoke('get-settings'),
  setCaptureShortcut: (shortcut: string) => ipcRenderer.invoke('set-capture-shortcut', shortcut),
  // AI Model
  getModelStatus: () => ipcRenderer.invoke('get-model-status'),
  downloadModel: () => ipcRenderer.invoke('download-model'),
  onModelDownloadProgress: (callback: (progress: any) => void) => {
    const listener = (event: any, data: any) => callback(data)
    ipcRenderer.on('model-download-progress', listener)
    return () => {
      ipcRenderer.removeListener('model-download-progress', listener)
    }
  },
  onModelDownloadComplete: (callback: () => void) => {
    const listener = () => callback()
    ipcRenderer.on('model-download-complete', listener)
    return () => {
      ipcRenderer.removeListener('model-download-complete', listener)
    }
  },
  onModelDownloadError: (callback: (error: string) => void) => {
    const listener = (event: any, error: string) => callback(error)
    ipcRenderer.on('model-download-error', listener)
    return () => {
      ipcRenderer.removeListener('model-download-error', listener)
    }
  },
  onAIStatus: (callback: (status: { status: string; message: string }) => void) => {
    const listener = (event: any, data: any) => callback(data)
    ipcRenderer.on('ai-status', listener)
    return () => {
      ipcRenderer.removeListener('ai-status', listener)
    }
  }
})
