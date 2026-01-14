import '@testing-library/jest-dom'

// Mock Electron API for renderer tests
const mockElectronAPI = {
  hideOverlay: vi.fn(),
  captureScreenshot: vi.fn(),
  onOCRResult: vi.fn(() => () => {}),
  uploadDocument: vi.fn(),
  getDocuments: vi.fn(() => Promise.resolve([])),
  deleteDocument: vi.fn(),
  chatFollowup: vi.fn(),
  loadCaptures: vi.fn(() => Promise.resolve([])),
  saveCaptures: vi.fn(),
  loadChats: vi.fn(() => Promise.resolve([{ id: 'general', type: 'general', title: 'General', chatHistory: [] }])),
  saveChats: vi.fn(),
  getSettings: vi.fn(() => Promise.resolve({ captureShortcut: 'CommandOrControl+Shift+S' })),
  setCaptureShortcut: vi.fn()
}

// @ts-ignore
globalThis.window = {
  ...globalThis.window,
  electronAPI: mockElectronAPI,
  location: {
    hash: ''
  }
}
