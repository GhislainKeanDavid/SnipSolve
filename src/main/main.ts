import { app, BrowserWindow, globalShortcut, ipcMain, screen, desktopCapturer } from 'electron'
import path from 'path'

let mainWindow: BrowserWindow | null = null
let overlayWindow: BrowserWindow | null = null
let ocrReady = false

function createMainWindow() {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false
    }
  })

  // In development, load from Vite dev server
  // In production, load from built files
  if (process.env.VITE_DEV_SERVER_URL) {
    mainWindow.loadURL(process.env.VITE_DEV_SERVER_URL)
    mainWindow.webContents.openDevTools()
  } else {
    mainWindow.loadFile(path.join(__dirname, '../dist/index.html'))
  }

  mainWindow.on('closed', () => {
    mainWindow = null
  })
}

function createOverlayWindow() {
  overlayWindow = new BrowserWindow({
    fullscreen: true,
    transparent: true,
    frame: false,
    alwaysOnTop: true,
    skipTaskbar: true,
    resizable: false,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false
    }
  })

  // Load the same app but with overlay mode
  if (process.env.VITE_DEV_SERVER_URL) {
    const overlayURL = `${process.env.VITE_DEV_SERVER_URL}#overlay`
    console.log('Loading overlay from:', overlayURL)
    overlayWindow.loadURL(overlayURL)
  } else {
    overlayWindow.loadFile(path.join(__dirname, '../dist/index.html'))
  }

  overlayWindow.setIgnoreMouseEvents(false)

  overlayWindow.on('closed', () => {
    overlayWindow = null
  })

  // Hide initially
  overlayWindow.hide()
}

app.whenReady().then(() => {
  createMainWindow()
  createOverlayWindow()

  // Register global shortcut: Ctrl/Cmd + Shift + S (do this first!)
  const ret = globalShortcut.register('CommandOrControl+Shift+S', () => {
    console.log('Global shortcut triggered!')
    if (overlayWindow) {
      if (overlayWindow.isVisible()) {
        overlayWindow.hide()
        // Restore main window
        if (mainWindow) {
          mainWindow.restore()
          mainWindow.show()
        }
      } else {
        // Minimize main window to get it out of the way
        if (mainWindow) {
          mainWindow.minimize()
        }
        overlayWindow.show()
        overlayWindow.focus()
      }
    }
  })

  if (!ret) {
    console.log('Global shortcut registration failed')
  } else {
    console.log('Global shortcut registered successfully!')
  }

  // Initialize Mock OCR (for Phase 1 demonstration)
  console.log('Initializing Mock OCR...')
  setTimeout(() => {
    ocrReady = true
    console.log('✅ Mock OCR ready! (Phase 1 - will be replaced with real OCR in Phase 3)')
  }, 500)

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createMainWindow()
      createOverlayWindow()
    }
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})

app.on('will-quit', () => {
  globalShortcut.unregisterAll()
  // No OCR cleanup needed for mock
})

// IPC handlers
ipcMain.handle('hide-overlay', () => {
  if (overlayWindow) {
    overlayWindow.hide()
  }
})

ipcMain.handle('capture-screenshot', async (event, bounds: { x: number; y: number; width: number; height: number }) => {
  try {
    console.log('Capture requested:', bounds)

    // Hide the overlay before capturing
    if (overlayWindow) {
      overlayWindow.hide()
    }

    // Wait a bit for the overlay to disappear
    await new Promise(resolve => setTimeout(resolve, 100))

    // Get all available screens
    const sources = await desktopCapturer.getSources({
      types: ['screen'],
      thumbnailSize: {
        width: screen.getPrimaryDisplay().size.width,
        height: screen.getPrimaryDisplay().size.height
      }
    })

    if (sources.length === 0) {
      throw new Error('No screen sources available')
    }

    // Get the first screen (primary display)
    const screenSource = sources[0]
    const screenshot = screenSource.thumbnail

    // Crop the image to the selected bounds
    const scaleFactor = screen.getPrimaryDisplay().scaleFactor
    const croppedImage = screenshot.crop({
      x: Math.round(bounds.x * scaleFactor),
      y: Math.round(bounds.y * scaleFactor),
      width: Math.round(bounds.width * scaleFactor),
      height: Math.round(bounds.height * scaleFactor)
    })

    // Convert to PNG buffer
    const imageBuffer = croppedImage.toPNG()

    // Perform Mock OCR
    if (!ocrReady) {
      throw new Error('OCR worker not initialized')
    }

    console.log('Performing Mock OCR...')
    // Mock OCR: Generate sample text based on capture size
    const mockTexts = [
      "Error: Connection timeout\nPlease check your network settings and try again.",
      "Warning: Low disk space\nYou have less than 10% free disk space remaining.",
      "Success: Operation completed\nAll files have been processed successfully.",
      "Database Error: Cannot connect to server\nCheck your database configuration in settings.",
      "API Response: 404 Not Found\nThe requested endpoint does not exist."
    ]
    const text = mockTexts[Math.floor(Math.random() * mockTexts.length)]

    console.log('Mock OCR completed. Text:', text)

    // Send the result to the main window
    if (mainWindow) {
      mainWindow.webContents.send('ocr-result', {
        text: text,
        bounds: bounds,
        timestamp: new Date().toISOString()
      })
    }

    // Send the result back
    return {
      success: true,
      text: text,
      bounds: bounds
    }
  } catch (error) {
    console.error('Screenshot capture error:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    }
  }
})
