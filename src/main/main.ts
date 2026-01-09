import { app, BrowserWindow, globalShortcut, ipcMain, screen, desktopCapturer, dialog } from 'electron'
import path from 'path'
import fs from 'fs/promises'
import { existsSync } from 'fs'
import os from 'os'
// Temporarily disabled due to bundling issues
// import { pipeline } from '@xenova/transformers'
// import { LocalIndex } from 'vectra'
import { RecursiveCharacterTextSplitter } from '@langchain/textsplitters'
import { randomUUID } from 'crypto'

// Phase 3: OpenAI Integration
import dotenv from 'dotenv'
import OpenAI from 'openai'

// Load environment variables
dotenv.config()

let openai: OpenAI | null = null

let mainWindow: BrowserWindow | null = null
let overlayWindow: BrowserWindow | null = null
let ocrReady = false

// Phase 2: Document Management & Vector Store
// let embeddingsPipeline: any = null
// let vectorIndex: LocalIndex | null = null
let documentsMetadata: Map<string, any> = new Map()
let documentChunks: Map<string, { docId: string; docName: string; chunkIndex: number; text: string }[]> = new Map()
const DATA_DIR = path.join(os.homedir(), '.snipsolve')
const VECTOR_STORE_DIR = path.join(DATA_DIR, 'vectorstore')
const DOCUMENTS_DIR = path.join(DATA_DIR, 'documents')
const METADATA_FILE = path.join(DATA_DIR, 'documents-metadata.json')
const CHUNKS_FILE = path.join(DATA_DIR, 'document-chunks.json')

// Initialize Phase 2 systems
async function initializePhase2() {
  try {
    console.log('Initializing Phase 2: Document Management System...')

    // Create data directories
    await fs.mkdir(DATA_DIR, { recursive: true })
    await fs.mkdir(DOCUMENTS_DIR, { recursive: true })
    await fs.mkdir(VECTOR_STORE_DIR, { recursive: true })

    // TODO: Embeddings and vector store temporarily disabled due to bundling issues
    // Will be re-enabled after fixing onnxruntime bundling
    console.log('⚠️ Embeddings temporarily disabled for testing')
    console.log('⚠️ Documents will be uploaded but not indexed yet')

    // Load documents metadata
    if (existsSync(METADATA_FILE)) {
      const data = await fs.readFile(METADATA_FILE, 'utf-8')
      const metadata = JSON.parse(data)
      documentsMetadata = new Map(Object.entries(metadata))
      console.log(`✅ Loaded ${documentsMetadata.size} documents metadata`)
    }

    // Load document chunks
    if (existsSync(CHUNKS_FILE)) {
      const data = await fs.readFile(CHUNKS_FILE, 'utf-8')
      const chunks = JSON.parse(data)
      documentChunks = new Map(Object.entries(chunks))
      const totalChunks = Array.from(documentChunks.values()).reduce((sum, arr) => sum + arr.length, 0)
      console.log(`✅ Loaded ${totalChunks} chunks from ${documentChunks.size} documents`)
    }

    console.log('✅ Phase 2 initialized successfully (basic mode)')
  } catch (error) {
    console.error('Failed to initialize Phase 2:', error)
  }
}

// Save documents metadata to disk
async function saveMetadata() {
  const obj = Object.fromEntries(documentsMetadata)
  await fs.writeFile(METADATA_FILE, JSON.stringify(obj, null, 2))
}

// Save document chunks to disk
async function saveChunks() {
  const obj = Object.fromEntries(documentChunks)
  await fs.writeFile(CHUNKS_FILE, JSON.stringify(obj, null, 2))
}

// Phase 3: Initialize OpenAI
function initializePhase3() {
  const apiKey = process.env.OPENAI_API_KEY
  if (apiKey && apiKey !== 'your_openai_api_key_here') {
    openai = new OpenAI({ apiKey })
    console.log('✅ Phase 3: OpenAI initialized successfully')
    return true
  } else {
    console.log('⚠️ Phase 3: OpenAI API key not configured')
    console.log('   Add OPENAI_API_KEY to your .env file to enable AI solutions')
    return false
  }
}

// Generate AI solution based on captured text and relevant documentation
async function generateSolution(
  capturedText: string,
  relevantDocs: Array<{ docName: string; text: string; score: number }>
): Promise<string> {
  if (!openai) {
    return 'AI solutions unavailable. Please configure your OpenAI API key in the .env file.'
  }

  try {
    // Build context from relevant documents
    let context = ''
    if (relevantDocs.length > 0) {
      context = '\n\nRelevant Documentation:\n'
      for (const doc of relevantDocs) {
        context += `\n[From ${doc.docName}]:\n${doc.text}\n`
      }
    }

    const systemPrompt = `You are SnipSolve, a helpful assistant that provides solutions to technical problems based on captured screen content and company documentation.

Your role is to:
1. Analyze the captured text (which may be an error message, warning, or other technical content)
2. Use the provided documentation context if relevant
3. Provide a clear, concise solution or explanation
4. If the documentation doesn't contain relevant information, provide general best practices

Keep responses concise but helpful. Use bullet points for steps when appropriate.`

    const userPrompt = `Captured Screen Content:
${capturedText}
${context}

Please analyze this and provide a solution or explanation.`

    console.log('Sending request to OpenAI...')
    const response = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt }
      ],
      max_tokens: 500,
      temperature: 0.7
    })

    const solution = response.choices[0]?.message?.content || 'No solution generated.'
    console.log('✅ AI solution generated successfully')
    return solution
  } catch (error) {
    console.error('OpenAI API error:', error)
    return `Error generating solution: ${error instanceof Error ? error.message : 'Unknown error'}`
  }
}

// Simple keyword-based search through document chunks
function searchDocuments(query: string, topK: number = 3): Array<{ docName: string; text: string; score: number }> {
  if (!query || query.trim().length === 0) {
    return []
  }

  const queryWords = query.toLowerCase().split(/\s+/).filter(w => w.length > 2)
  if (queryWords.length === 0) {
    return []
  }

  const results: Array<{ docName: string; text: string; score: number }> = []

  // Search through all chunks
  for (const chunks of documentChunks.values()) {
    for (const chunk of chunks) {
      const chunkText = chunk.text.toLowerCase()

      // Count matching keywords
      let score = 0
      for (const word of queryWords) {
        const regex = new RegExp(`\\b${word}\\w*`, 'gi')
        const matches = chunkText.match(regex)
        if (matches) {
          score += matches.length
        }
      }

      if (score > 0) {
        results.push({
          docName: chunk.docName,
          text: chunk.text,
          score
        })
      }
    }
  }

  // Sort by score descending and return top K
  return results
    .sort((a, b) => b.score - a.score)
    .slice(0, topK)
}

// Extract text from PDF
async function extractTextFromPDF(filePath: string): Promise<string> {
  // Using pdf.js-extract which is simpler and more reliable
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const PDFExtract = require('pdf.js-extract').PDFExtract
  const pdfExtract = new PDFExtract()

  const data = await pdfExtract.extract(filePath, {})

  // Combine all text from all pages
  const text = data.pages
    .map((page: any) => page.content.map((item: any) => item.str).join(' '))
    .join('\n')

  return text
}

// Extract text from text file
async function extractTextFromFile(filePath: string): Promise<string> {
  return await fs.readFile(filePath, 'utf-8')
}

// Generate embedding for text (temporarily disabled)
// async function generateEmbedding(text: string): Promise<number[]> {
//   if (!embeddingsPipeline) {
//     throw new Error('Embeddings pipeline not initialized')
//   }
//
//   const output = await embeddingsPipeline(text, { pooling: 'mean', normalize: true })
//   return Array.from(output.data)
// }

// Chunk document text
async function chunkDocument(text: string): Promise<string[]> {
  const splitter = new RecursiveCharacterTextSplitter({
    chunkSize: 500,
    chunkOverlap: 50
  })

  const chunks = await splitter.splitText(text)
  return chunks
}

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

  // Initialize Phase 2 systems (in background)
  initializePhase2()

  // Initialize Phase 3: OpenAI
  initializePhase3()

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

    // Search for relevant documents
    const relevantDocs = searchDocuments(text, 3)
    console.log(`Found ${relevantDocs.length} relevant document chunks`)

    // Convert image to base64 for transmission
    const imageBase64 = `data:image/png;base64,${imageBuffer.toString('base64')}`

    // Generate AI solution (Phase 3)
    const aiSolution = await generateSolution(text, relevantDocs)

    // Send the result to the main window
    if (mainWindow) {
      mainWindow.webContents.send('ocr-result', {
        text: text,
        bounds: bounds,
        timestamp: new Date().toISOString(),
        relevantDocs: relevantDocs,
        image: imageBase64,
        aiSolution: aiSolution
      })
    }

    // Send the result back
    return {
      success: true,
      text: text,
      bounds: bounds,
      relevantDocs: relevantDocs,
      aiSolution: aiSolution,
      image: imageBase64
    }
  } catch (error) {
    console.error('Screenshot capture error:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    }
  }
})

// Phase 2: Document Management IPC Handlers

// Upload and process document
ipcMain.handle('upload-document', async () => {
  try {
    const result = await dialog.showOpenDialog({
      properties: ['openFile'],
      filters: [
        { name: 'Documents', extensions: ['pdf', 'txt', 'md'] }
      ]
    })

    if (result.canceled || result.filePaths.length === 0) {
      return { success: false, error: 'No file selected' }
    }

    const filePath = result.filePaths[0]
    const fileName = path.basename(filePath)
    const fileExt = path.extname(filePath).toLowerCase()
    const docId = randomUUID()

    console.log(`Processing document: ${fileName}`)

    // Extract text based on file type
    let text: string
    if (fileExt === '.pdf') {
      text = await extractTextFromPDF(filePath)
    } else {
      text = await extractTextFromFile(filePath)
    }

    console.log(`Extracted ${text.length} characters from ${fileName}`)

    // Chunk the document
    const chunks = await chunkDocument(text)
    console.log(`Split document into ${chunks.length} chunks`)

    // Store chunks in memory for keyword search
    const chunkObjects = chunks.map((chunkText, index) => ({
      docId,
      docName: fileName,
      chunkIndex: index,
      text: chunkText
    }))
    documentChunks.set(docId, chunkObjects)
    await saveChunks()
    console.log(`✅ Stored ${chunks.length} chunks for search`)

    // TODO: Embeddings generation temporarily disabled
    console.log('⚠️ Skipping embeddings generation (will be re-enabled after fixing bundling)')

    // Copy document to documents directory
    const destPath = path.join(DOCUMENTS_DIR, `${docId}${fileExt}`)
    await fs.copyFile(filePath, destPath)

    // Save document metadata
    const docMetadata = {
      id: docId,
      name: fileName,
      path: destPath,
      type: fileExt.replace('.', ''),
      uploadedAt: new Date().toISOString(),
      chunks: chunks.length
    }

    documentsMetadata.set(docId, docMetadata)
    await saveMetadata()

    console.log(`✅ Document ${fileName} processed successfully`)

    return {
      success: true,
      document: docMetadata
    }
  } catch (error) {
    console.error('Document upload error:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    }
  }
})

// Get all documents
ipcMain.handle('get-documents', async () => {
  return Array.from(documentsMetadata.values())
})

// Delete document
ipcMain.handle('delete-document', async (event, docId: string) => {
  try {
    const doc = documentsMetadata.get(docId)
    if (!doc) {
      throw new Error('Document not found')
    }

    // Delete file
    await fs.unlink(doc.path)

    // Remove chunks
    documentChunks.delete(docId)
    await saveChunks()

    // TODO: Vector store deletion temporarily disabled
    // Will be re-enabled after fixing bundling

    // Remove from metadata
    documentsMetadata.delete(docId)
    await saveMetadata()

    console.log(`✅ Document ${doc.name} deleted`)
  } catch (error) {
    console.error('Document deletion error:', error)
    throw error
  }
})
