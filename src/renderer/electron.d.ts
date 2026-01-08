export interface OCRResult {
  text: string
  bounds: { x: number; y: number; width: number; height: number }
  timestamp: string
}

export interface CaptureResult {
  success: boolean
  text?: string
  bounds?: { x: number; y: number; width: number; height: number }
  error?: string
}

export interface ElectronAPI {
  hideOverlay: () => Promise<void>
  captureScreenshot: (bounds: { x: number; y: number; width: number; height: number }) => Promise<CaptureResult>
  performOCR: (imageData: string) => Promise<string>
  onOCRResult: (callback: (data: OCRResult) => void) => () => void
}

declare global {
  interface Window {
    electronAPI: ElectronAPI
  }
}
