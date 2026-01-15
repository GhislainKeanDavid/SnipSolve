import '@testing-library/jest-dom'
import { vi } from 'vitest'

// Mock Electron API for renderer tests
const mockElectronAPI = {
  hideOverlay: vi.fn(),
  captureScreenshot: vi.fn(),
  performOCR: vi.fn(() => Promise.resolve('')),
  onOCRResult: vi.fn(() => () => {}),
  uploadDocument: vi.fn(),
  getDocuments: vi.fn(() => Promise.resolve([])),
  getDocumentContent: vi.fn(() => Promise.resolve({ success: true, content: '' })),
  downloadDocument: vi.fn(() => Promise.resolve({ success: true })),
  deleteDocument: vi.fn(),
  chatFollowup: vi.fn(),
  loadCaptures: vi.fn(() => Promise.resolve([])),
  saveCaptures: vi.fn(),
  loadChats: vi.fn(() => Promise.resolve([])),
  saveChats: vi.fn(),
  getSettings: vi.fn(() => Promise.resolve({ captureShortcut: 'CommandOrControl+Shift+S' })),
  setCaptureShortcut: vi.fn()
}

// @ts-expect-error - Partial window mock for testing
globalThis.window = {
  ...globalThis.window,
  electronAPI: mockElectronAPI,
  location: { hash: '' } as Location
}
