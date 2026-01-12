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

export interface ChatMessage {
  role: 'user' | 'assistant'
  content: string
}

export interface ChatFollowupRequest {
  message: string
  captureContext: {
    text: string
    aiSolution: string
    relevantDocs: RelevantDoc[]
  }
  chatHistory: ChatMessage[]
}

export interface ChatFollowupResult {
  success: boolean
  reply?: string
  error?: string
}

export interface ChatTab {
  id: string
  type: 'general' | 'capture'
  captureTimestamp?: string
  title: string
  chatHistory: ChatMessage[]
}

export interface ElectronAPI {
  hideOverlay: () => Promise<void>
  captureScreenshot: (bounds: { x: number; y: number; width: number; height: number }) => Promise<CaptureResult>
  performOCR: (imageData: string) => Promise<string>
  onOCRResult: (callback: (data: OCRResult) => void) => () => void
  // Document management
  uploadDocument: () => Promise<UploadResult>
  getDocuments: () => Promise<Document[]>
  deleteDocument: (docId: string) => Promise<void>
  // Chat follow-up
  chatFollowup: (request: ChatFollowupRequest) => Promise<ChatFollowupResult>
  // Persistence
  loadCaptures: () => Promise<OCRResult[]>
  saveCaptures: (captures: OCRResult[]) => Promise<{ success: boolean }>
  loadChats: () => Promise<ChatTab[]>
  saveChats: (chats: ChatTab[]) => Promise<{ success: boolean }>
}

declare global {
  interface Window {
    electronAPI: ElectronAPI
  }
}
