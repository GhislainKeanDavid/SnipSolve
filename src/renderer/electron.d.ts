export interface RelevantDoc {
  docName: string
  text: string
  score: number
}

export interface OCRResult {
  text: string
  bounds: { x: number; y: number; width: number; height: number }
  timestamp: string
  relevantDocs: RelevantDoc[]
  image: string
  aiSolution: string
  sources: string[]
}

export interface CaptureResult {
  success: boolean
  text?: string
  bounds?: { x: number; y: number; width: number; height: number }
  error?: string
}

export interface Document {
  id: string
  name: string
  path: string
  type: string
  uploadedAt: string
  chunks: number
}

export interface UploadResult {
  success: boolean
  document?: Document
  error?: string
}

export interface DocumentContentResult {
  success: boolean
  document?: Document
  content?: string
  error?: string
}

export interface ChatMessage {
  role: 'user' | 'assistant'
  content: string
  sources?: string[]  // Only present for assistant messages
}

export interface ChatFollowupRequest {
  message: string
  captureContext: {
    text: string
    aiSolution: string
    relevantDocs: RelevantDoc[]
  }
  chatHistory: ChatMessage[]
  isNewChat?: boolean
  generateTitle?: boolean
}

export interface ChatFollowupResult {
  success: boolean
  reply?: string
  sources?: string[]
  error?: string
  generatedTitle?: string
}

export interface Conversation {
  id: string
  type: 'chat' | 'capture'
  captureTimestamp?: string
  title: string
  chatHistory: ChatMessage[]
  createdAt: string
}

// Legacy alias for backwards compatibility with saved data
export type ChatTab = Conversation

export interface AppSettings {
  captureShortcut: string
}

export interface SetShortcutResult {
  success: boolean
  shortcut?: string
  error?: string
}

export interface ElectronAPI {
  hideOverlay: () => Promise<void>
  captureScreenshot: (bounds: { x: number; y: number; width: number; height: number }) => Promise<CaptureResult>
  performOCR: (imageData: string) => Promise<string>
  onOCRResult: (callback: (data: OCRResult) => void) => () => void
  // Document management
  uploadDocument: () => Promise<UploadResult>
  getDocuments: () => Promise<Document[]>
  getDocumentContent: (docId: string) => Promise<DocumentContentResult>
  downloadDocument: (docId: string) => Promise<{ success: boolean; error?: string }>
  deleteDocument: (docId: string) => Promise<void>
  // Chat follow-up
  chatFollowup: (request: ChatFollowupRequest) => Promise<ChatFollowupResult>
  // Persistence
  loadCaptures: () => Promise<OCRResult[]>
  saveCaptures: (captures: OCRResult[]) => Promise<{ success: boolean }>
  loadChats: () => Promise<Conversation[]>
  saveChats: (chats: Conversation[]) => Promise<{ success: boolean }>
  // Settings
  getSettings: () => Promise<AppSettings>
  setCaptureShortcut: (shortcut: string) => Promise<SetShortcutResult>
  // AI Model
  getModelStatus: () => Promise<{
    initialized: boolean
    downloaded: boolean
    modelPath: string
    error?: string
  }>
  downloadModel: () => Promise<{ success: boolean; message?: string; error?: string }>
  onModelDownloadProgress: (callback: (progress: {
    downloaded: number
    total: number
    percentage: number
    mbDownloaded: string
    mbTotal: string
  }) => void) => () => void
  onModelDownloadComplete: (callback: () => void) => () => void
  onModelDownloadError: (callback: (error: string) => void) => () => void
  onAIStatus: (callback: (status: {
    status: 'initializing' | 'downloading' | 'loading' | 'ready' | 'error'
    message: string
  }) => void) => () => void
}

declare global {
  interface Window {
    electronAPI: ElectronAPI
  }
}
