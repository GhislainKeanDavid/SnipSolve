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
  saveChats: (chats: any[]) => ipcRenderer.invoke('save-chats', chats)
})
