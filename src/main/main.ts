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
import Tesseract from 'tesseract.js'

// Phase 3: Local AI Integration
import { ModelManager } from './services/ModelManager'
import { AIService } from './services/AIService'

let modelManager: ModelManager
let aiService: AIService
let aiInitializing = false
let aiInitialized = false
let aiInitError: string | null = null

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
const CAPTURES_FILE = path.join(DATA_DIR, 'captures.json')
const CHATS_FILE = path.join(DATA_DIR, 'chats.json')
const SETTINGS_FILE = path.join(DATA_DIR, 'settings.json')

// App settings
interface AppSettings {
  captureShortcut: string
}

const DEFAULT_SETTINGS: AppSettings = {
  captureShortcut: 'CommandOrControl+Alt+S'
}

// Fallback shortcuts to try if primary fails
const FALLBACK_SHORTCUTS = [
  'CommandOrControl+Alt+S',
  'CommandOrControl+Shift+X',
  'Alt+Shift+S',
  'CommandOrControl+Shift+C'
]

let currentSettings: AppSettings = { ...DEFAULT_SETTINGS }

// Load settings from disk
async function loadSettings(): Promise<AppSettings> {
  try {
    if (existsSync(SETTINGS_FILE)) {
      const data = await fs.readFile(SETTINGS_FILE, 'utf-8')
      const settings = JSON.parse(data)
      console.log('✅ Loaded settings from disk')
      return { ...DEFAULT_SETTINGS, ...settings }
    }
  } catch (error) {
    console.error('Failed to load settings:', error)
  }
  return { ...DEFAULT_SETTINGS }
}

// Save settings to disk
async function saveSettings(settings: AppSettings): Promise<void> {
  await fs.writeFile(SETTINGS_FILE, JSON.stringify(settings, null, 2))
  console.log('💾 Saved settings to disk')
}

// Shortcut handler function
function handleShortcutTrigger() {
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
}

// Register the capture shortcut
function registerCaptureShortcut(shortcut: string): boolean {
  // Unregister all shortcuts first
  globalShortcut.unregisterAll()

  try {
    const ret = globalShortcut.register(shortcut, handleShortcutTrigger)

    if (ret) {
      console.log(`✅ Shortcut registered: ${shortcut}`)
      return true
    } else {
      console.log(`❌ Failed to register shortcut: ${shortcut}`)
      return false
    }
  } catch (error) {
    console.error(`❌ Error registering shortcut: ${error}`)
    return false
  }
}

// Register shortcut with fallbacks
function registerShortcutWithFallbacks(preferredShortcut: string): { success: boolean; shortcut: string } {
  // Try the preferred shortcut first
  if (registerCaptureShortcut(preferredShortcut)) {
    return { success: true, shortcut: preferredShortcut }
  }

  // Try fallback shortcuts
  for (const fallback of FALLBACK_SHORTCUTS) {
    if (fallback !== preferredShortcut && registerCaptureShortcut(fallback)) {
      console.log(`⚠️ Using fallback shortcut: ${fallback}`)
      return { success: true, shortcut: fallback }
    }
  }

  console.error('❌ All shortcut registrations failed')
  return { success: false, shortcut: preferredShortcut }
}

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

// Save captures to disk
async function saveCaptures(captures: any[]) {
  await fs.writeFile(CAPTURES_FILE, JSON.stringify(captures, null, 2))
  console.log(`💾 Saved ${captures.length} captures to disk`)
}

// Load captures from disk
async function loadCaptures(): Promise<any[]> {
  if (existsSync(CAPTURES_FILE)) {
    const data = await fs.readFile(CAPTURES_FILE, 'utf-8')
    const captures = JSON.parse(data)
    console.log(`✅ Loaded ${captures.length} captures from disk`)
    return captures
  }
  return []
}

// Save chat tabs to disk
async function saveChats(chats: any[]) {
  await fs.writeFile(CHATS_FILE, JSON.stringify(chats, null, 2))
  console.log(`💾 Saved ${chats.length} chat tabs to disk`)
}

// Load chat tabs from disk
async function loadChats(): Promise<any[]> {
  if (existsSync(CHATS_FILE)) {
    const data = await fs.readFile(CHATS_FILE, 'utf-8')
    const chats = JSON.parse(data)
    console.log(`✅ Loaded ${chats.length} chat tabs from disk`)
    return chats
  }
  // Return default General tab if no chats saved
  return [{ id: 'general', type: 'general', title: 'General', chatHistory: [] }]
}

// Phase 3: Initialize Local AI
async function initializePhase3() {
  if (aiInitializing || aiInitialized) {
    console.log('⚠️ AI already initializing or initialized')
    return aiInitialized
  }

  aiInitializing = true
  aiInitError = null

  try {
    console.log('🧠 Initializing Local AI...')
    console.log('⏳ This may take 5-30 minutes on first launch (downloading 2.4GB model)...')

    // Send status to renderer
    if (mainWindow) {
      mainWindow.webContents.send('ai-status', {
        status: 'initializing',
        message: 'Initializing AI model (may take several minutes on first launch)...'
      })
    }

    // Initialize model manager
    modelManager = new ModelManager()

    // Check if model needs downloading
    const needsDownload = !(await modelManager.isModelAvailable())
    if (needsDownload) {
      console.log('📥 Model not found. Starting download (2.4GB)...')
      if (mainWindow) {
        mainWindow.webContents.send('ai-status', {
          status: 'downloading',
          message: 'Downloading AI model (2.4GB, first time only)...'
        })
      }
    }

    // Set up download progress listener
    modelManager.on('download-progress', (progress) => {
      // Send progress to renderer if window is available
      if (mainWindow) {
        mainWindow.webContents.send('model-download-progress', progress)
      }
      console.log(`📥 Model download: ${progress.percentage}% (${progress.mbDownloaded}/${progress.mbTotal} MB)`)
    })

    modelManager.on('download-complete', () => {
      console.log('✅ Model download complete')
      if (mainWindow) {
        mainWindow.webContents.send('model-download-complete')
        mainWindow.webContents.send('ai-status', {
          status: 'loading',
          message: 'Model downloaded. Loading into memory...'
        })
      }
    })

    modelManager.on('download-error', (error) => {
      console.error('❌ Model download error:', error)
      aiInitError = error.message
      if (mainWindow) {
        mainWindow.webContents.send('model-download-error', error.message)
        mainWindow.webContents.send('ai-status', {
          status: 'error',
          message: `Model download failed: ${error.message}`
        })
      }
    })

    // Initialize AI service
    console.log('🔄 Loading model into memory (30-60 seconds)...')
    aiService = new AIService(modelManager)
    await aiService.initialize()

    aiInitialized = true
    aiInitializing = false
    console.log('✅ Phase 3: Local AI initialized successfully')

    if (mainWindow) {
      mainWindow.webContents.send('ai-status', {
        status: 'ready',
        message: 'AI model ready!'
      })
    }

    return true
  } catch (error) {
    console.error('❌ Failed to initialize Local AI:', error)
    aiInitializing = false
    aiInitError = error instanceof Error ? error.message : 'Unknown error'

    if (mainWindow) {
      mainWindow.webContents.send('ai-status', {
        status: 'error',
        message: `AI initialization failed: ${aiInitError}`
      })
    }

    return false
  }
}

// Generate AI solution based on captured text and relevant documentation
async function generateSolution(
  capturedText: string,
  relevantDocs: Array<{ docName: string; text: string; score: number }>
): Promise<string> {
  // Check AI readiness
  if (!aiService || !aiService.isInitialized()) {
    if (aiInitError) {
      return `AI unavailable: ${aiInitError}\n\nPlease restart the app or check logs.`
    }
    if (aiInitializing) {
      return 'AI model is initializing... This may take several minutes on first launch (downloading 2.4GB model). Please wait and try again.'
    }
    return 'AI service not initialized. Please restart the app.'
  }

  try {
    // Build system prompt using centralized function
    const systemPrompt = buildSystemPrompt({ relevantDocs })

    const userPrompt = `Captured Screen Content:
${capturedText}

Please analyze this and provide a solution or explanation.`

    console.log('Generating AI solution with local model...')
    const response = await aiService.createChatCompletion(
      [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt }
      ],
      {
        maxTokens: 1500,  // Increased from 1000 to allow complete responses
        temperature: 0.05  // Reduced from 0.1 for even more deterministic output
      }
    )

    const solution = response.choices[0]?.message?.content || 'No solution generated.'
    console.log('✅ AI solution generated successfully')

    // Validate response for potential hallucinations
    const validation = validateAIResponse(solution, relevantDocs)
    if (!validation.isValid && validation.warning) {
      console.warn('⚠️ Validation warning:', validation.warning)
      return `${solution}\n\n${validation.warning}`
    }

    return solution
  } catch (error) {
    console.error('Local AI error:', error)
    return `Error generating solution: ${error instanceof Error ? error.message : 'Unknown error'}`
  }
}

// Build system prompt for AI interactions
function buildSystemPrompt(options: {
  relevantDocs: Array<{ docName: string; text: string; score: number }>
  captureContext?: {
    text: string
    aiSolution: string
  }
}): string {
  const { relevantDocs, captureContext } = options

  // Base prompt with anti-hallucination rules
  const baseRules = `You are a documentation assistant. Your ONLY job is to extract and present information EXACTLY as it appears in the provided documentation.

CRITICAL RULES (NEVER VIOLATE):
1. If information is NOT in the documentation below, say "I cannot find this information in the documentation"
2. NEVER make up, infer, or generate information
3. NEVER complete incomplete information - if steps are cut off, stop there
4. ONLY use direct quotes and exact information from the documentation
5. If you're unsure, say you don't know

FORMAT YOUR RESPONSE:
- Put procedure titles on their own line (no number before the title)
- Put each step on a new line with proper numbering (1., 2., 3.)
- Add blank lines between sections
- Include ALL steps EXACTLY as written in the documentation
- Stop immediately when the documentation ends - do NOT continue or complete the thought

CITE SOURCES:
- Always cite: [Source: filename.pdf]
- Never add attributions or signatures

WHAT YOU MUST NEVER DO:
- ❌ Add information not explicitly in the documentation
- ❌ Summarize or paraphrase - use exact wording
- ❌ Add generic advice or best practices
- ❌ Complete truncated procedures
- ❌ Add attributions or signatures`

  // Add capture context if provided
  let contextSection = ''
  if (captureContext) {
    contextSection = `\n\nCONTEXT FROM CAPTURE:
Screen content: "${captureContext.text}"
Previous response: "${captureContext.aiSolution}"`
  }

  // Add documentation section
  let docsSection = ''
  if (relevantDocs.length > 0) {
    docsSection = `\n\nDOCUMENTATION:
${relevantDocs.map(doc => `[${doc.docName}]: ${doc.text}`).join('\n\n')}`
  } else {
    docsSection = `\n\nNo relevant documentation found. Say EXACTLY: "I could not find information about this in the uploaded documents. Please upload relevant documentation or try different search keywords."`
  }

  return `${baseRules}${contextSection}${docsSection}`
}

// Validate AI response to detect potential hallucinations
function validateAIResponse(
  response: string,
  relevantDocs: Array<{ docName: string; text: string; score: number }>
): { isValid: boolean; warning?: string } {
  // Check if response claims no information found
  const noInfoPhrases = [
    'cannot find',
    'could not find',
    'no information',
    'not in the documentation',
    "don't know"
  ]

  const lowerResponse = response.toLowerCase()
  const hasNoInfoPhrase = noInfoPhrases.some(phrase => lowerResponse.includes(phrase))

  // If AI says no info, but we have relevant docs, that's suspicious
  if (hasNoInfoPhrase && relevantDocs.length === 0) {
    return { isValid: true }
  }

  // Check for generic/vague responses that might be hallucinated
  const genericPhrases = [
    'best practice',
    'it is recommended',
    'you should',
    'typically',
    'usually',
    'in general',
    'standard procedure is'
  ]

  const hasGenericPhrase = genericPhrases.some(phrase => lowerResponse.includes(phrase))

  // If response has generic phrases but no source citations, warn
  if (hasGenericPhrase && !lowerResponse.includes('[source:') && !lowerResponse.includes('[from ')) {
    return {
      isValid: false,
      warning: '⚠️ Warning: Response may contain generic information not from your documents.'
    }
  }

  // If response is very short (< 50 chars) and we have docs, might be incomplete
  if (response.trim().length < 50 && relevantDocs.length > 0 && !hasNoInfoPhrase) {
    return {
      isValid: false,
      warning: '⚠️ Warning: Response seems incomplete. Try rephrasing your question.'
    }
  }

  return { isValid: true }
}

// Real OCR using Tesseract.js (English + Filipino for Taglish support)
async function performRealOCR(imageBuffer: Buffer): Promise<string> {
  try {
    console.log('Performing real OCR with Tesseract.js (eng+fil)...')

    // Convert buffer to base64 for Tesseract
    const base64Image = `data:image/png;base64,${imageBuffer.toString('base64')}`

    const result = await Tesseract.recognize(
      base64Image,
      'eng+fil', // English + Filipino for Taglish support
      {
        logger: (m) => {
          if (m.status === 'recognizing text') {
            console.log(`OCR Progress: ${Math.round(m.progress * 100)}%`)
          }
        }
      }
    )

    const text = result.data.text.trim()
    console.log('✅ Real OCR completed. Extracted text length:', text.length)

    if (text.length === 0) {
      console.log('⚠️ No text detected in image')
      return '(No text detected in captured region)'
    }

    return text
  } catch (error) {
    console.error('OCR Error:', error)
    throw error
  }
}

// Simple keyword-based search through document chunks
// Returns matching chunks plus adjacent chunks to ensure complete procedures
function searchDocuments(query: string, topK: number = 5): Array<{ docName: string; text: string; score: number }> {
  if (!query || query.trim().length === 0) {
    return []
  }

  const queryWords = query.toLowerCase().split(/\s+/).filter(w => w.length > 2)
  if (queryWords.length === 0) {
    return []
  }

  const matchingChunks: Array<{ docId: string; docName: string; chunkIndex: number; text: string; score: number }> = []

  // Search through all chunks and track their indices
  for (const [docId, chunks] of documentChunks.entries()) {
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
        matchingChunks.push({
          docId,
          docName: chunk.docName,
          chunkIndex: chunk.chunkIndex,
          text: chunk.text,
          score
        })
      }
    }
  }

  // Sort by score descending
  matchingChunks.sort((a, b) => b.score - a.score)

  // Take top matches and expand to include adjacent chunks for complete context
  const selectedChunks = matchingChunks.slice(0, Math.min(topK, matchingChunks.length))
  const expandedResults: Map<string, { docName: string; text: string; score: number }> = new Map()

  for (const match of selectedChunks) {
    const docChunks = documentChunks.get(match.docId)
    if (!docChunks) continue

    // Include the matching chunk and 1 chunk before/after for context
    const startIdx = Math.max(0, match.chunkIndex - 1)
    const endIdx = Math.min(docChunks.length - 1, match.chunkIndex + 1)

    // Combine adjacent chunks into one result
    const combinedText: string[] = []
    for (let i = startIdx; i <= endIdx; i++) {
      const chunk = docChunks.find(c => c.chunkIndex === i)
      if (chunk) {
        combinedText.push(chunk.text)
      }
    }

    const key = `${match.docId}-${startIdx}-${endIdx}`
    if (!expandedResults.has(key)) {
      expandedResults.set(key, {
        docName: match.docName,
        text: combinedText.join('\n'),
        score: match.score
      })
    }
  }

  // Convert to array and return
  return Array.from(expandedResults.values())
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
    chunkSize: 800,  // Increased from 500 to capture more context per chunk
    chunkOverlap: 150  // Increased from 50 to maintain better context continuity
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
    hasShadow: false,
    backgroundColor: '#00000000', // Fully transparent background
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

app.whenReady().then(async () => {
  createMainWindow()
  createOverlayWindow()

  // Load settings and register shortcut with fallback support
  currentSettings = await loadSettings()
  const shortcutResult = registerShortcutWithFallbacks(currentSettings.captureShortcut)

  // Update settings if a fallback was used
  if (shortcutResult.success && shortcutResult.shortcut !== currentSettings.captureShortcut) {
    currentSettings.captureShortcut = shortcutResult.shortcut
    await saveSettings(currentSettings)
    console.log(`📝 Settings updated with working shortcut: ${shortcutResult.shortcut}`)
  }

  // OCR is now on-demand using Tesseract.js
  ocrReady = true
  console.log('✅ Tesseract.js OCR ready (on-demand recognition)')

  // Initialize Phase 2 systems (in background)
  initializePhase2()

  // Initialize Phase 3: Local AI (this may take time if model needs to download)
  initializePhase3().catch(error => {
    console.error('Failed to initialize AI:', error)
  })

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

    // Perform Real OCR using Tesseract.js
    console.log('Starting OCR...')
    const text = await performRealOCR(imageBuffer)
    console.log('OCR Result:', text.substring(0, 100) + (text.length > 100 ? '...' : ''))

    // Search for relevant documents (increased to 5 for better context)
    const relevantDocs = searchDocuments(text, 5)
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

// Generate a short title for a conversation using AI
async function generateChatTitle(message: string): Promise<string> {
  if (!aiService || !aiService.isInitialized()) {
    return message.slice(0, 30) + (message.length > 30 ? '...' : '')
  }

  try {
    const response = await aiService.createChatCompletion(
      [
        {
          role: 'system',
          content: 'Generate a very short title (3-5 words max) in ENGLISH that captures the main topic of the user\'s question. Always use English regardless of the language of the user\'s message. No quotes, no punctuation at the end. Just the title in English.'
        },
        { role: 'user', content: message }
      ],
      {
        maxTokens: 20,
        temperature: 0.3
      }
    )
    return response.choices[0]?.message?.content?.trim() || message.slice(0, 30)
  } catch (error) {
    console.error('Title generation error:', error)
    return message.slice(0, 30) + (message.length > 30 ? '...' : '')
  }
}

// Chat follow-up handler
ipcMain.handle('chat-followup', async (event, data: {
  message: string,
  captureContext: {
    text: string,
    aiSolution: string,
    relevantDocs: Array<{ docName: string; text: string; score: number }>
  },
  chatHistory: Array<{ role: 'user' | 'assistant', content: string }>,
  isNewChat?: boolean,
  generateTitle?: boolean
}) => {
  try {
    console.log('Processing chat message...')

    if (!aiService || !aiService.isInitialized()) {
      return {
        success: false,
        error: 'AI service is not initialized. Model may still be loading.'
      }
    }

    // Generate title if this is the first message
    let generatedTitle: string | undefined
    if (data.generateTitle) {
      generatedTitle = await generateChatTitle(data.message)
      console.log('Generated title:', generatedTitle)
    }

    // For new chats (not capture follow-ups), search the KB for relevant docs
    let relevantDocs = data.captureContext.relevantDocs
    if (data.isNewChat || (data.captureContext.text === '' && relevantDocs.length === 0)) {
      console.log('Searching KB for new chat message...')
      // Get more chunks (8) for direct chats to ensure complete procedures
      relevantDocs = searchDocuments(data.message, 8)
    }

    // Build system prompt based on chat type
    const isCaptureChat = data.captureContext.text !== ''

    // Use centralized system prompt builder
    const systemPrompt = buildSystemPrompt({
      relevantDocs,
      captureContext: isCaptureChat ? {
        text: data.captureContext.text,
        aiSolution: data.captureContext.aiSolution
      } : undefined
    })

    // Build messages array with chat history
    const messages: Array<{ role: 'system' | 'user' | 'assistant', content: string }> = [
      { role: 'system', content: systemPrompt },
      ...data.chatHistory,
      { role: 'user', content: data.message }
    ]

    console.log('Generating follow-up response with local model...')
    const response = await aiService.createChatCompletion(
      messages as any,
      {
        maxTokens: 1500,  // Increased from 1000 to allow complete responses
        temperature: 0.05  // Reduced from 0.1 for more deterministic, factual output
      }
    )

    const reply = response.choices[0]?.message?.content || 'No response generated.'
    console.log('✅ Follow-up response generated')

    // Validate response for potential hallucinations
    const validation = validateAIResponse(reply, relevantDocs)
    let finalReply = reply
    if (!validation.isValid && validation.warning) {
      console.warn('⚠️ Validation warning:', validation.warning)
      finalReply = `${reply}\n\n${validation.warning}`
    }

    return {
      success: true,
      reply: finalReply,
      generatedTitle: generatedTitle
    }
  } catch (error) {
    console.error('Chat follow-up error:', error)
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

// Get document content (all chunks combined)
ipcMain.handle('get-document-content', async (event, docId: string) => {
  try {
    const doc = documentsMetadata.get(docId)
    if (!doc) {
      return { success: false, error: 'Document not found' }
    }

    const chunks = documentChunks.get(docId)
    if (!chunks || chunks.length === 0) {
      return { success: false, error: 'Document content not found' }
    }

    // Sort chunks by index and combine text
    const sortedChunks = [...chunks].sort((a, b) => a.chunkIndex - b.chunkIndex)
    const fullText = sortedChunks.map(c => c.text).join('\n\n')

    return {
      success: true,
      document: doc,
      content: fullText
    }
  } catch (error) {
    console.error('Get document content error:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    }
  }
})

// Download document file
ipcMain.handle('download-document', async (event, docId: string) => {
  try {
    const doc = documentsMetadata.get(docId)
    if (!doc) {
      return { success: false, error: 'Document not found' }
    }

    // Show save dialog
    const result = await dialog.showSaveDialog({
      defaultPath: doc.name,
      filters: [
        { name: 'Documents', extensions: [doc.type] }
      ]
    })

    if (result.canceled || !result.filePath) {
      return { success: false, error: 'Download cancelled' }
    }

    // Copy file to selected location
    await fs.copyFile(doc.path, result.filePath)
    console.log(`✅ Document downloaded to ${result.filePath}`)

    return { success: true }
  } catch (error) {
    console.error('Download document error:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    }
  }
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

// Persistence: Load captures
ipcMain.handle('load-captures', async () => {
  return await loadCaptures()
})

// Persistence: Save captures
ipcMain.handle('save-captures', async (event, captures: any[]) => {
  await saveCaptures(captures)
  return { success: true }
})

// Persistence: Load chat tabs
ipcMain.handle('load-chats', async () => {
  return await loadChats()
})

// Persistence: Save chat tabs
ipcMain.handle('save-chats', async (event, chats: any[]) => {
  await saveChats(chats)
  return { success: true }
})

// Settings: Get current settings
ipcMain.handle('get-settings', async () => {
  return currentSettings
})

// Settings: Update capture shortcut
ipcMain.handle('set-capture-shortcut', async (event, shortcut: string) => {
  const success = registerCaptureShortcut(shortcut)
  if (success) {
    currentSettings.captureShortcut = shortcut
    await saveSettings(currentSettings)
    return { success: true, shortcut }
  } else {
    // Re-register the old shortcut if new one failed
    registerCaptureShortcut(currentSettings.captureShortcut)
    return { success: false, error: 'Failed to register shortcut. It may be in use by another application.' }
  }
})

// AI Model: Get model status
ipcMain.handle('get-model-status', async () => {
  if (!modelManager) {
    return { initialized: false, downloaded: false, error: 'Model manager not initialized' }
  }

  const isDownloaded = await modelManager.isModelAvailable()
  const isInitialized = aiService ? aiService.isInitialized() : false

  return {
    initialized: isInitialized,
    downloaded: isDownloaded,
    modelPath: modelManager.getModelPath()
  }
})

// AI Model: Manually trigger model download (if needed)
ipcMain.handle('download-model', async () => {
  if (!modelManager) {
    return { success: false, error: 'Model manager not initialized' }
  }

  try {
    const isAvailable = await modelManager.isModelAvailable()
    if (isAvailable) {
      return { success: true, message: 'Model already downloaded' }
    }

    await modelManager.downloadModel()
    return { success: true, message: 'Model downloaded successfully' }
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    }
  }
})
