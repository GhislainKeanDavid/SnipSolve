import { useState, useEffect, useRef } from 'react'
import type { OCRResult, ChatMessage, ChatTab, AppSettings } from '../electron'

interface Document {
  id: string
  name: string
  path: string
  type: string
  uploadedAt: string
  chunks: number
}

type Tab = 'captures' | 'documents' | 'chat' | 'settings'

function MainWindow() {
  const [activeTab, setActiveTab] = useState<Tab>('captures')
  const [ocrResults, setOcrResults] = useState<OCRResult[]>([])
  const [documents, setDocuments] = useState<Document[]>([])
  const [isProcessing, setIsProcessing] = useState(false)

  // Chat tabs state
  const [chatTabs, setChatTabs] = useState<ChatTab[]>([
    { id: 'general', type: 'general', title: 'General', chatHistory: [] }
  ])
  const [activeChatTabId, setActiveChatTabId] = useState<string>('general')
  const [chatInput, setChatInput] = useState('')
  const [isSending, setIsSending] = useState(false)
  const [isLoaded, setIsLoaded] = useState(false)

  // Settings state
  const [settings, setSettings] = useState<AppSettings>({ captureShortcut: 'CommandOrControl+Shift+S' })
  const [shortcutInput, setShortcutInput] = useState('')
  const [isRecordingShortcut, setIsRecordingShortcut] = useState(false)
  const [shortcutError, setShortcutError] = useState('')

  // Search state
  const [searchQuery, setSearchQuery] = useState('')

  // Track if data has been modified (to avoid saving on initial load)
  const capturesModified = useRef(false)
  const chatsModified = useRef(false)

  // Load persisted data on startup
  useEffect(() => {
    const loadPersistedData = async () => {
      try {
        // Load captures
        const savedCaptures = await window.electronAPI.loadCaptures()
        if (savedCaptures.length > 0) {
          setOcrResults(savedCaptures)
          console.log(`✅ Loaded ${savedCaptures.length} captures`)
        }

        // Load chat tabs
        const savedChats = await window.electronAPI.loadChats()
        if (savedChats.length > 0) {
          setChatTabs(savedChats)
          console.log(`✅ Loaded ${savedChats.length} chat tabs`)
        }

        // Load settings
        const savedSettings = await window.electronAPI.getSettings()
        setSettings(savedSettings)
        setShortcutInput(savedSettings.captureShortcut)
        console.log(`✅ Loaded settings`)
      } catch (error) {
        console.error('Failed to load persisted data:', error)
      } finally {
        setIsLoaded(true)
      }
    }

    loadPersistedData()
    loadDocuments()

    // Listen for OCR results
    const cleanup = window.electronAPI.onOCRResult((result) => {
      setOcrResults(prev => {
        capturesModified.current = true
        return [result, ...prev]
      })
    })

    // Cleanup listener when component unmounts
    return cleanup
  }, [])

  // Save captures when they change (after initial load)
  useEffect(() => {
    if (isLoaded && capturesModified.current) {
      window.electronAPI.saveCaptures(ocrResults)
      capturesModified.current = false
    }
  }, [ocrResults, isLoaded])

  // Save chats when they change (after initial load)
  useEffect(() => {
    if (isLoaded && chatsModified.current) {
      window.electronAPI.saveChats(chatTabs)
      chatsModified.current = false
    }
  }, [chatTabs, isLoaded])

  const loadDocuments = async () => {
    try {
      const docs = await window.electronAPI.getDocuments()
      setDocuments(docs)
    } catch (error) {
      console.error('Failed to load documents:', error)
    }
  }

  const handleUploadDocument = async () => {
    try {
      setIsProcessing(true)
      const result = await window.electronAPI.uploadDocument()
      if (result.success) {
        await loadDocuments()
      }
    } catch (error) {
      console.error('Failed to upload document:', error)
    } finally {
      setIsProcessing(false)
    }
  }

  const handleDeleteDocument = async (docId: string) => {
    try {
      await window.electronAPI.deleteDocument(docId)
      await loadDocuments()
    } catch (error) {
      console.error('Failed to delete document:', error)
    }
  }

  const openCaptureChat = (captureTimestamp: string, captureNumber: number) => {
    const tabId = `capture-${captureTimestamp}`
    const existingTab = chatTabs.find(t => t.id === tabId)

    if (existingTab) {
      // Tab already exists, switch to it
      setActiveChatTabId(tabId)
    } else {
      // Find the capture to get its AI solution
      const capture = ocrResults.find(r => r.timestamp === captureTimestamp)
      const initialHistory: ChatMessage[] = []

      // Add AI solution as the first message if available
      if (capture?.aiSolution) {
        initialHistory.push({
          role: 'assistant',
          content: capture.aiSolution
        })
      }

      // Create new tab for this capture with AI solution as first message
      const newTab: ChatTab = {
        id: tabId,
        type: 'capture',
        captureTimestamp,
        title: `Capture #${captureNumber}`,
        chatHistory: initialHistory
      }
      chatsModified.current = true
      setChatTabs(prev => [...prev, newTab])
      setActiveChatTabId(tabId)
    }
    setActiveTab('chat')
  }

  const closeChatTab = (tabId: string) => {
    if (tabId === 'general') return // Can't close general tab

    chatsModified.current = true
    setChatTabs(prev => prev.filter(t => t.id !== tabId))

    // If closing active tab, switch to general
    if (activeChatTabId === tabId) {
      setActiveChatTabId('general')
    }
  }

  const handleSendMessage = async () => {
    if (!chatInput.trim()) return

    const message = chatInput.trim()
    const currentChatTab = chatTabs.find(t => t.id === activeChatTabId)
    if (!currentChatTab) return

    setIsSending(true)

    // Add user message to chat history
    const updatedHistory: ChatMessage[] = [...currentChatTab.chatHistory, { role: 'user', content: message }]
    chatsModified.current = true
    setChatTabs(prev => prev.map(t =>
      t.id === activeChatTabId ? { ...t, chatHistory: updatedHistory } : t
    ))
    setChatInput('')

    try {
      // Build context based on tab type
      let captureContext: { text: string, aiSolution: string, relevantDocs: any[] }

      if (currentChatTab.type === 'capture' && currentChatTab.captureTimestamp) {
        const capture = ocrResults.find(r => r.timestamp === currentChatTab.captureTimestamp)
        if (capture) {
          captureContext = {
            text: capture.text,
            aiSolution: capture.aiSolution,
            relevantDocs: capture.relevantDocs
          }
        } else {
          captureContext = { text: '', aiSolution: '', relevantDocs: [] }
        }
      } else {
        // General chat - no capture context, just KB
        captureContext = {
          text: '',
          aiSolution: '',
          relevantDocs: []
        }
      }

      const response = await window.electronAPI.chatFollowup({
        message,
        captureContext,
        chatHistory: currentChatTab.chatHistory
      })

      if (response.success && response.reply) {
        chatsModified.current = true
        setChatTabs(prev => prev.map(t =>
          t.id === activeChatTabId
            ? { ...t, chatHistory: [...updatedHistory, { role: 'assistant', content: response.reply! }] }
            : t
        ))
      } else {
        chatsModified.current = true
        setChatTabs(prev => prev.map(t =>
          t.id === activeChatTabId
            ? { ...t, chatHistory: [...updatedHistory, { role: 'assistant', content: `Error: ${response.error || 'Failed to get response'}` }] }
            : t
        ))
      }
    } catch (error) {
      console.error('Chat error:', error)
      chatsModified.current = true
      setChatTabs(prev => prev.map(t =>
        t.id === activeChatTabId
          ? { ...t, chatHistory: [...updatedHistory, { role: 'assistant', content: 'Error: Failed to send message' }] }
          : t
      ))
    } finally {
      setIsSending(false)
    }
  }

  const activeChatTab = chatTabs.find(t => t.id === activeChatTabId)
  const activeCaptureForChat = activeChatTab?.type === 'capture' && activeChatTab.captureTimestamp
    ? ocrResults.find(r => r.timestamp === activeChatTab.captureTimestamp)
    : null

  // Handle keyboard shortcut recording
  const handleShortcutKeyDown = (e: React.KeyboardEvent) => {
    e.preventDefault()

    const keys: string[] = []
    if (e.ctrlKey || e.metaKey) keys.push('CommandOrControl')
    if (e.altKey) keys.push('Alt')
    if (e.shiftKey) keys.push('Shift')

    // Add the actual key (excluding modifier keys themselves)
    const key = e.key.toUpperCase()
    if (!['CONTROL', 'ALT', 'SHIFT', 'META'].includes(key)) {
      keys.push(key)
    }

    if (keys.length > 1) {
      setShortcutInput(keys.join('+'))
    }
  }

  const saveShortcut = async () => {
    setShortcutError('')
    const result = await window.electronAPI.setCaptureShortcut(shortcutInput)
    if (result.success) {
      setSettings(prev => ({ ...prev, captureShortcut: shortcutInput }))
      setIsRecordingShortcut(false)
    } else {
      setShortcutError(result.error || 'Failed to set shortcut')
    }
  }

  const resetShortcut = () => {
    setShortcutInput(settings.captureShortcut)
    setIsRecordingShortcut(false)
    setShortcutError('')
  }

  // Clear functions
  const clearAllCaptures = () => {
    if (confirm('Are you sure you want to delete all captures? This cannot be undone.')) {
      capturesModified.current = true
      setOcrResults([])
      window.electronAPI.saveCaptures([])
    }
  }

  const clearAllChats = () => {
    if (confirm('Are you sure you want to clear all chat history? This cannot be undone.')) {
      chatsModified.current = true
      setChatTabs([{ id: 'general', type: 'general', title: 'General', chatHistory: [] }])
      setActiveChatTabId('general')
      window.electronAPI.saveChats([{ id: 'general', type: 'general', title: 'General', chatHistory: [] }])
    }
  }

  const deleteCapture = (index: number) => {
    capturesModified.current = true
    setOcrResults(prev => prev.filter((_, i) => i !== index))
  }

  // Copy to clipboard
  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text)
  }

  // Filtered captures based on search
  const filteredCaptures = searchQuery
    ? ocrResults.filter(r =>
        r.text.toLowerCase().includes(searchQuery.toLowerCase()) ||
        r.aiSolution.toLowerCase().includes(searchQuery.toLowerCase())
      )
    : ocrResults

  return (
    <div className="min-h-screen bg-gray-100">
      <div className="container mx-auto p-8">
        <header className="mb-8">
          <h1 className="text-4xl font-bold text-gray-800 mb-2">SnipSolve</h1>
          <p className="text-gray-600">Overlay RAG Tool for instant documentation search</p>
        </header>

        <div className="bg-white rounded-lg shadow-md p-6 mb-6">
          <h2 className="text-2xl font-semibold text-gray-800 mb-4">How to Use</h2>
          <div className="space-y-2 text-gray-700">
            <p>1. Upload your company documentation (PDFs or text files)</p>
            <p>2. Press <kbd className="px-2 py-1 bg-gray-200 rounded">{settings.captureShortcut.replace('CommandOrControl', 'Ctrl').replace(/\+/g, ' + ')}</kbd> to capture screen region</p>
            <p>3. Click and drag to select an error message or text</p>
            <p>4. Get instant solutions from your uploaded docs</p>
          </div>
        </div>

        {/* Main Tabs */}
        <div className="mb-6 border-b border-gray-200">
          <nav className="flex space-x-8">
            <button
              onClick={() => setActiveTab('captures')}
              className={`pb-4 px-1 border-b-2 font-medium text-sm ${
                activeTab === 'captures'
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              Captures
            </button>
            <button
              onClick={() => setActiveTab('documents')}
              className={`pb-4 px-1 border-b-2 font-medium text-sm ${
                activeTab === 'documents'
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              Documents ({documents.length})
            </button>
            <button
              onClick={() => setActiveTab('chat')}
              className={`pb-4 px-1 border-b-2 font-medium text-sm ${
                activeTab === 'chat'
                  ? 'border-purple-500 text-purple-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              Chat
            </button>
            <button
              onClick={() => setActiveTab('settings')}
              className={`pb-4 px-1 border-b-2 font-medium text-sm ${
                activeTab === 'settings'
                  ? 'border-gray-500 text-gray-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              Settings
            </button>
          </nav>
        </div>

        {/* Captures Tab */}
        {activeTab === 'captures' && (
          <div className="bg-white rounded-lg shadow-md p-6">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-2xl font-semibold text-gray-800">OCR Results</h2>
              {ocrResults.length > 0 && (
                <button
                  onClick={clearAllCaptures}
                  className="px-3 py-1 text-sm text-red-600 hover:text-red-800 hover:bg-red-50 rounded"
                >
                  Clear All
                </button>
              )}
            </div>

            {/* Search Bar */}
            {ocrResults.length > 0 && (
              <div className="mb-4">
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search captures by text or AI solution..."
                  className="w-full px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                {searchQuery && (
                  <p className="text-sm text-gray-500 mt-1">
                    Found {filteredCaptures.length} of {ocrResults.length} captures
                  </p>
                )}
              </div>
            )}

            {ocrResults.length === 0 ? (
              <p className="text-gray-500 italic">No captures yet. Use {settings.captureShortcut.replace('CommandOrControl', 'Ctrl')} to start capturing!</p>
            ) : filteredCaptures.length === 0 ? (
              <p className="text-gray-500 italic">No captures match your search.</p>
            ) : (
              <div className="space-y-4">
                {filteredCaptures.map((result, index) => {
                  const originalIndex = ocrResults.findIndex(r => r.timestamp === result.timestamp)
                  return (
                  <div key={result.timestamp} className="border border-gray-200 rounded p-4 bg-gray-50">
                    {/* Captured Image */}
                    {result.image && (
                      <div className="mb-3 bg-white border border-gray-200 rounded p-3">
                        <img
                          src={result.image}
                          alt="Captured screenshot"
                          className="max-w-full h-auto border border-gray-300 rounded"
                        />
                      </div>
                    )}

                    {/* AI Solution with Ask Follow-up and Copy buttons */}
                    {result.aiSolution && (
                      <div className="mb-3">
                        <div className="flex justify-between items-center mb-2">
                          <p className="text-xs font-semibold text-green-600">
                            🤖 AI Solution:
                          </p>
                          <div className="flex gap-2">
                            <button
                              onClick={() => copyToClipboard(result.aiSolution)}
                              className="px-2 py-1 rounded-md text-xs font-medium bg-gray-200 text-gray-700 hover:bg-gray-300 transition-colors"
                            >
                              📋 Copy
                            </button>
                            <button
                              onClick={() => openCaptureChat(result.timestamp, ocrResults.length - originalIndex)}
                              className="px-3 py-1 rounded-md text-xs font-medium bg-purple-600 text-white hover:bg-purple-700 transition-colors"
                            >
                              💬 Ask Follow-up
                            </button>
                          </div>
                        </div>
                        <div className="bg-green-50 border border-green-200 rounded p-3">
                          <p className="text-sm text-gray-800 whitespace-pre-wrap">{result.aiSolution}</p>
                        </div>
                      </div>
                    )}

                    {/* Relevant Documentation */}
                    {result.relevantDocs && result.relevantDocs.length > 0 && (
                      <div className="mb-3">
                        <p className="text-xs font-semibold text-blue-600 mb-2">
                          📚 Relevant Documentation ({result.relevantDocs.length} found):
                        </p>
                        <div className="space-y-2">
                          {result.relevantDocs.map((doc, docIndex) => (
                            <div key={docIndex} className="bg-blue-50 border border-blue-200 rounded p-3">
                              <div className="flex justify-between items-start mb-1">
                                <p className="text-xs font-medium text-blue-800">{doc.docName}</p>
                                <span className="text-xs text-blue-600">Score: {doc.score}</span>
                              </div>
                              <p className="text-xs text-gray-700 whitespace-pre-wrap">{doc.text}</p>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {result.relevantDocs && result.relevantDocs.length === 0 && (
                      <div className="mb-3">
                        <p className="text-xs text-gray-500 italic">No relevant documentation found</p>
                      </div>
                    )}

                    {/* Capture Info */}
                    <div className="pt-3 border-t border-gray-300">
                      <div className="flex justify-between items-start">
                        <div>
                          <p className="text-sm text-gray-500">Capture #{ocrResults.length - originalIndex}</p>
                          <p className="text-xs text-gray-500">
                            Region: {result.bounds.width} x {result.bounds.height} px
                            at ({result.bounds.x}, {result.bounds.y})
                          </p>
                        </div>
                        <div className="flex items-center gap-2">
                          <p className="text-xs text-gray-400">
                            {new Date(result.timestamp).toLocaleTimeString()}
                          </p>
                          <button
                            onClick={() => deleteCapture(originalIndex)}
                            className="px-2 py-1 text-xs text-red-600 hover:text-red-800 hover:bg-red-50 rounded"
                          >
                            Delete
                          </button>
                        </div>
                      </div>
                      {/* Captured Text (collapsible) */}
                      <details className="mt-2">
                        <summary className="text-xs font-semibold text-gray-600 cursor-pointer hover:text-gray-800">
                          View Captured Text
                        </summary>
                        <div className="mt-2 bg-white border border-gray-200 rounded p-3 flex justify-between items-start">
                          <p className="text-gray-800 font-mono text-sm whitespace-pre-wrap flex-1">
                            {result.text || '(No text detected)'}
                          </p>
                          {result.text && (
                            <button
                              onClick={() => copyToClipboard(result.text)}
                              className="ml-2 px-2 py-1 rounded-md text-xs font-medium bg-gray-200 text-gray-700 hover:bg-gray-300 transition-colors"
                            >
                              📋
                            </button>
                          )}
                        </div>
                      </details>
                    </div>
                  </div>
                  )
                })}
              </div>
            )}
          </div>
        )}

        {/* Documents Tab */}
        {activeTab === 'documents' && (
          <div className="bg-white rounded-lg shadow-md p-6">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-2xl font-semibold text-gray-800">Knowledge Base</h2>
              <button
                onClick={handleUploadDocument}
                disabled={isProcessing}
                className={`px-4 py-2 rounded-md text-white font-medium ${
                  isProcessing
                    ? 'bg-gray-400 cursor-not-allowed'
                    : 'bg-blue-600 hover:bg-blue-700'
                }`}
              >
                {isProcessing ? 'Processing...' : '+ Upload Document'}
              </button>
            </div>

            {documents.length === 0 ? (
              <div className="text-center py-12">
                <p className="text-gray-500 mb-4">No documents uploaded yet</p>
                <p className="text-sm text-gray-400">
                  Upload PDFs or text files containing your company SOPs, documentation, or knowledge base
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                {documents.map((doc) => (
                  <div key={doc.id} className="flex items-center justify-between border border-gray-200 rounded p-4 hover:bg-gray-50">
                    <div className="flex-1">
                      <p className="font-medium text-gray-800">{doc.name}</p>
                      <p className="text-sm text-gray-500">
                        {doc.type.toUpperCase()} • {doc.chunks} chunks • Uploaded {new Date(doc.uploadedAt).toLocaleDateString()}
                      </p>
                    </div>
                    <button
                      onClick={() => handleDeleteDocument(doc.id)}
                      className="ml-4 px-3 py-1 text-sm text-red-600 hover:text-red-800 hover:bg-red-50 rounded"
                    >
                      Delete
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Chat Tab */}
        {activeTab === 'chat' && (
          <div className="bg-white rounded-lg shadow-md">
            {/* Browser-style Chat Tabs */}
            <div className="flex items-center border-b border-gray-200 bg-gray-50 rounded-t-lg px-2 pt-2">
              {chatTabs.map((tab) => (
                <div
                  key={tab.id}
                  className={`flex items-center gap-2 px-4 py-2 rounded-t-lg cursor-pointer border-t border-l border-r transition-colors ${
                    activeChatTabId === tab.id
                      ? 'bg-white border-gray-200 -mb-px'
                      : 'bg-gray-100 border-transparent hover:bg-gray-200'
                  }`}
                  onClick={() => setActiveChatTabId(tab.id)}
                >
                  <span className="text-sm font-medium truncate max-w-[120px]">
                    {tab.type === 'general' ? '💬 General' : `📷 ${tab.title}`}
                  </span>
                  {tab.type !== 'general' && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation()
                        closeChatTab(tab.id)
                      }}
                      className="text-gray-400 hover:text-gray-600 hover:bg-gray-300 rounded-full w-5 h-5 flex items-center justify-center text-xs"
                    >
                      ✕
                    </button>
                  )}
                </div>
              ))}
            </div>

            {/* Chat Content */}
            <div className="p-6">
              {activeChatTab ? (
                <div className="flex flex-col">
                  {/* Chat Header with Context */}
                  {activeChatTab.type === 'capture' && activeCaptureForChat && (
                    <div className="mb-4 pb-4 border-b border-gray-200">
                      <div className="flex items-start gap-4">
                        {activeCaptureForChat.image && (
                          <img
                            src={activeCaptureForChat.image}
                            alt="Capture context"
                            className="w-24 h-auto border border-gray-300 rounded"
                          />
                        )}
                        <div className="flex-1">
                          <h3 className="text-sm font-semibold text-gray-800 mb-1">
                            {activeChatTab.title} - Follow-up Chat
                          </h3>
                          <p className="text-xs text-gray-500">
                            {new Date(activeCaptureForChat.timestamp).toLocaleString()}
                          </p>
                        </div>
                      </div>
                    </div>
                  )}

                  {activeChatTab.type === 'general' && (
                    <div className="mb-4 pb-4 border-b border-gray-200">
                      <h3 className="text-sm font-semibold text-gray-800 mb-1">
                        💬 General Chat
                      </h3>
                      <p className="text-xs text-gray-500">
                        Ask questions about your uploaded documentation
                      </p>
                    </div>
                  )}

                  {/* Chat Messages */}
                  <div className="min-h-[300px] max-h-[400px] overflow-y-auto mb-4 space-y-3">
                    {activeChatTab.chatHistory.length === 0 && activeChatTab.type === 'general' && (
                      <p className="text-gray-500 text-center py-8">
                        Ask any question about your documentation...
                      </p>
                    )}
                    {activeChatTab.chatHistory.map((msg, msgIndex) => (
                      <div
                        key={msgIndex}
                        className={`p-3 rounded-lg ${
                          msg.role === 'user'
                            ? 'bg-purple-100 text-purple-900 ml-12'
                            : 'bg-gray-100 text-gray-800 mr-12'
                        }`}
                      >
                        <p className="text-xs font-medium mb-1">
                          {msg.role === 'user' ? '👤 You' : '🤖 AI'}
                        </p>
                        <p className="text-sm whitespace-pre-wrap">{msg.content}</p>
                      </div>
                    ))}
                  </div>

                  {/* Chat Input - Always visible */}
                  <div className="flex gap-2 pt-4 border-t border-gray-200">
                    <input
                      type="text"
                      value={chatInput}
                      onChange={(e) => setChatInput(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' && !e.shiftKey) {
                          e.preventDefault()
                          handleSendMessage()
                        }
                      }}
                      placeholder={activeChatTab.type === 'general'
                        ? "Ask about your documentation..."
                        : "Ask a follow-up question..."}
                      disabled={isSending}
                      className="flex-1 px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-purple-500 disabled:bg-gray-100"
                    />
                    <button
                      onClick={handleSendMessage}
                      disabled={isSending || !chatInput.trim()}
                      className={`px-6 py-2 rounded-md font-medium text-white ${
                        isSending || !chatInput.trim()
                          ? 'bg-gray-400 cursor-not-allowed'
                          : 'bg-purple-600 hover:bg-purple-700'
                      }`}
                    >
                      {isSending ? 'Sending...' : 'Send'}
                    </button>
                  </div>
                </div>
              ) : (
                <p className="text-gray-500 text-center py-8">No chat tab selected</p>
              )}
            </div>
          </div>
        )}

        {/* Settings Tab */}
        {activeTab === 'settings' && (
          <div className="bg-white rounded-lg shadow-md p-6">
            <h2 className="text-2xl font-semibold text-gray-800 mb-6">Settings</h2>

            {/* Keyboard Shortcut */}
            <div className="mb-8">
              <h3 className="text-lg font-medium text-gray-800 mb-3">Capture Shortcut</h3>
              <p className="text-sm text-gray-600 mb-4">
                Press a key combination to set the shortcut for screen capture.
              </p>

              <div className="flex items-center gap-4">
                <div className="flex-1">
                  <input
                    type="text"
                    value={shortcutInput}
                    onKeyDown={handleShortcutKeyDown}
                    onFocus={() => setIsRecordingShortcut(true)}
                    onBlur={() => !shortcutInput && resetShortcut()}
                    readOnly
                    placeholder="Click and press keys..."
                    className={`w-full px-4 py-2 border rounded-md focus:outline-none focus:ring-2 ${
                      isRecordingShortcut
                        ? 'border-blue-500 focus:ring-blue-500 bg-blue-50'
                        : 'border-gray-300 focus:ring-gray-500'
                    }`}
                  />
                  {shortcutError && (
                    <p className="text-sm text-red-600 mt-1">{shortcutError}</p>
                  )}
                </div>

                {shortcutInput !== settings.captureShortcut && (
                  <div className="flex gap-2">
                    <button
                      onClick={saveShortcut}
                      className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
                    >
                      Save
                    </button>
                    <button
                      onClick={resetShortcut}
                      className="px-4 py-2 bg-gray-200 text-gray-700 rounded-md hover:bg-gray-300"
                    >
                      Cancel
                    </button>
                  </div>
                )}
              </div>

              <p className="text-xs text-gray-500 mt-2">
                Current shortcut: <kbd className="px-2 py-1 bg-gray-100 rounded">{settings.captureShortcut.replace('CommandOrControl', 'Ctrl')}</kbd>
              </p>
            </div>

            {/* Data Management */}
            <div className="mb-8">
              <h3 className="text-lg font-medium text-gray-800 mb-3">Data Management</h3>
              <p className="text-sm text-gray-600 mb-4">
                Manage your captured data and chat history.
              </p>

              <div className="flex gap-4">
                <button
                  onClick={clearAllCaptures}
                  disabled={ocrResults.length === 0}
                  className={`px-4 py-2 rounded-md font-medium ${
                    ocrResults.length === 0
                      ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                      : 'bg-red-100 text-red-700 hover:bg-red-200'
                  }`}
                >
                  Clear All Captures ({ocrResults.length})
                </button>
                <button
                  onClick={clearAllChats}
                  disabled={chatTabs.length <= 1 && chatTabs[0]?.chatHistory.length === 0}
                  className={`px-4 py-2 rounded-md font-medium ${
                    chatTabs.length <= 1 && chatTabs[0]?.chatHistory.length === 0
                      ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                      : 'bg-red-100 text-red-700 hover:bg-red-200'
                  }`}
                >
                  Clear All Chats ({chatTabs.length} tabs)
                </button>
              </div>
            </div>

            {/* About */}
            <div>
              <h3 className="text-lg font-medium text-gray-800 mb-3">About</h3>
              <p className="text-sm text-gray-600">
                SnipSolve - Overlay RAG Tool for instant documentation search
              </p>
              <p className="text-xs text-gray-500 mt-1">
                Data stored in: ~/.snipsolve/
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

export default MainWindow
