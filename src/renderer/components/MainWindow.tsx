import { useState, useEffect, useRef } from 'react'
import type { OCRResult, ChatMessage, ChatTab, AppSettings } from '../electron'
import {
  FileText,
  MessageSquare,
  History,
  Settings,
  Plus,
  Upload,
  Sparkles,
  Command,
  ArrowRight,
  Search,
  Trash2,
  Copy,
  X
} from 'lucide-react'

interface Document {
  id: string
  name: string
  path: string
  type: string
  uploadedAt: string
  chunks: number
}

type Tab = 'home' | 'captures' | 'documents' | 'chat' | 'settings'

function MainWindow() {
  const [activeTab, setActiveTab] = useState<Tab>('home')
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
      // Switch to captures tab when new capture arrives
      setActiveTab('captures')
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
      setActiveChatTabId(tabId)
    } else {
      const capture = ocrResults.find(r => r.timestamp === captureTimestamp)
      const initialHistory: ChatMessage[] = []

      if (capture?.aiSolution) {
        initialHistory.push({
          role: 'assistant',
          content: capture.aiSolution
        })
      }

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
    if (tabId === 'general') return

    chatsModified.current = true
    setChatTabs(prev => prev.filter(t => t.id !== tabId))

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

    const updatedHistory: ChatMessage[] = [...currentChatTab.chatHistory, { role: 'user', content: message }]
    chatsModified.current = true
    setChatTabs(prev => prev.map(t =>
      t.id === activeChatTabId ? { ...t, chatHistory: updatedHistory } : t
    ))
    setChatInput('')

    try {
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
        captureContext = { text: '', aiSolution: '', relevantDocs: [] }
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

  // Format shortcut for display
  const formatShortcut = (shortcut: string) => {
    return shortcut
      .replace('CommandOrControl', 'Ctrl')
      .split('+')
  }

  const shortcutKeys = formatShortcut(settings.captureShortcut)

  return (
    <div className="flex h-screen bg-[#0b0b0b] text-gray-100">
      {/* Sidebar */}
      <aside className="w-16 bg-[#0f0f0f] border-r border-gray-800 flex flex-col items-center py-6 space-y-6">
        {/* Logo */}
        <div className="w-10 h-10 bg-indigo-600 rounded-lg flex items-center justify-center mb-8">
          <Sparkles className="w-6 h-6 text-white" />
        </div>

        {/* Navigation Icons */}
        <nav className="flex-1 flex flex-col space-y-4">
          <button
            onClick={() => setActiveTab('home')}
            className={`w-10 h-10 flex items-center justify-center rounded-lg transition-colors ${
              activeTab === 'home'
                ? 'bg-indigo-600 text-white'
                : 'hover:bg-gray-800 text-gray-400 hover:text-white'
            }`}
            title="Home"
          >
            <Command className="w-5 h-5" />
          </button>
          <button
            onClick={() => setActiveTab('captures')}
            className={`w-10 h-10 flex items-center justify-center rounded-lg transition-colors ${
              activeTab === 'captures'
                ? 'bg-indigo-600 text-white'
                : 'hover:bg-gray-800 text-gray-400 hover:text-white'
            }`}
            title="Captures"
          >
            <History className="w-5 h-5" />
          </button>
          <button
            onClick={() => setActiveTab('documents')}
            className={`w-10 h-10 flex items-center justify-center rounded-lg transition-colors ${
              activeTab === 'documents'
                ? 'bg-indigo-600 text-white'
                : 'hover:bg-gray-800 text-gray-400 hover:text-white'
            }`}
            title="Documents"
          >
            <FileText className="w-5 h-5" />
          </button>
          <button
            onClick={() => setActiveTab('chat')}
            className={`w-10 h-10 flex items-center justify-center rounded-lg transition-colors ${
              activeTab === 'chat'
                ? 'bg-indigo-600 text-white'
                : 'hover:bg-gray-800 text-gray-400 hover:text-white'
            }`}
            title="Chat"
          >
            <MessageSquare className="w-5 h-5" />
          </button>
        </nav>

        {/* Settings at bottom */}
        <button
          onClick={() => setActiveTab('settings')}
          className={`w-10 h-10 flex items-center justify-center rounded-lg transition-colors ${
            activeTab === 'settings'
              ? 'bg-indigo-600 text-white'
              : 'hover:bg-gray-800 text-gray-400 hover:text-white'
          }`}
          title="Settings"
        >
          <Settings className="w-5 h-5" />
        </button>
      </aside>

      {/* Main Content */}
      <main className="flex-1 flex flex-col overflow-hidden">
        {/* Home Tab */}
        {activeTab === 'home' && (
          <div className="flex-1 flex flex-col items-center justify-center px-8 overflow-y-auto">
            {/* Hero Section */}
            <div className="text-center mb-12 max-w-3xl">
              <h1 className="text-5xl font-bold mb-4 bg-gradient-to-r from-indigo-400 to-purple-400 bg-clip-text text-transparent">
                SnipSolve
              </h1>
              <p className="text-xl text-gray-400">
                Your documentation, instantly accessible.
              </p>
              <p className="text-sm text-gray-500 mt-2">
                Capture any screen region to instantly search your docs.
              </p>
            </div>

            {/* Knowledge Base Empty State */}
            {documents.length === 0 && (
              <div className="mb-8 w-full max-w-2xl">
                <div className="bg-gradient-to-r from-amber-500/10 to-orange-500/10 border border-amber-500/20 rounded-xl p-6 flex items-center justify-between">
                  <div className="flex items-center space-x-4">
                    <div className="w-12 h-12 bg-amber-500/20 rounded-lg flex items-center justify-center">
                      <Upload className="w-6 h-6 text-amber-400" />
                    </div>
                    <div>
                      <h3 className="font-semibold text-white mb-1">Knowledge Base Empty</h3>
                      <p className="text-sm text-gray-400">
                        Upload your PDFs or SOPs to enable AI context.
                      </p>
                    </div>
                  </div>
                  <button
                    onClick={handleUploadDocument}
                    disabled={isProcessing}
                    className="px-6 py-2.5 bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-white font-medium rounded-lg transition-all duration-200 flex items-center space-x-2 shadow-lg shadow-amber-500/20 disabled:opacity-50"
                  >
                    <Plus className="w-4 h-4" />
                    <span>{isProcessing ? 'Processing...' : 'Add Knowledge Base'}</span>
                  </button>
                </div>
              </div>
            )}

            {/* Action Cards Container */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 w-full max-w-4xl">
              {/* Primary Action: Snip & Solve */}
              <div className="md:col-span-2">
                <div className="group relative bg-gradient-to-br from-indigo-600 to-purple-700 rounded-2xl p-10 overflow-hidden cursor-pointer transition-all duration-300 hover:scale-[1.02] hover:shadow-2xl hover:shadow-indigo-500/30">
                  {/* Animated background effect */}
                  <div className="absolute inset-0 bg-gradient-to-br from-indigo-500/0 to-purple-600/0 group-hover:from-indigo-500/20 group-hover:to-purple-600/20 transition-all duration-500" />

                  {/* Content */}
                  <div className="relative z-10 text-center">
                    {/* Icon */}
                    <div className="w-16 h-16 mx-auto mb-6 bg-white/10 rounded-2xl flex items-center justify-center backdrop-blur-sm border border-white/20 group-hover:scale-110 transition-transform duration-300">
                      <Command className="w-8 h-8 text-white" />
                    </div>

                    {/* Title */}
                    <h2 className="text-3xl font-bold text-white mb-3">
                      Snip & Solve
                    </h2>

                    {/* Description */}
                    <p className="text-indigo-100 mb-6 text-lg">
                      Capture any screen region to instantly search your docs.
                    </p>

                    {/* Keyboard Shortcut Display */}
                    <div className="flex items-center justify-center space-x-2 mb-4">
                      <span className="text-sm text-indigo-200 uppercase tracking-wider">Press</span>
                      <div className="flex items-center space-x-1">
                        {shortcutKeys.map((key, idx) => (
                          <span key={idx} className="flex items-center">
                            {idx > 0 && <span className="text-white font-bold mx-1">+</span>}
                            <kbd className="px-3 py-2 bg-white/20 backdrop-blur-md border border-white/30 rounded-lg text-white font-mono text-sm shadow-lg">
                              {key}
                            </kbd>
                          </span>
                        ))}
                      </div>
                    </div>

                    {/* Hover indicator */}
                    <div className="opacity-0 group-hover:opacity-100 transition-opacity duration-300">
                      <ArrowRight className="w-6 h-6 mx-auto text-white animate-pulse" />
                    </div>
                  </div>

                  {/* Decorative elements */}
                  <div className="absolute -top-20 -right-20 w-40 h-40 bg-white/5 rounded-full blur-3xl" />
                  <div className="absolute -bottom-20 -left-20 w-40 h-40 bg-purple-500/10 rounded-full blur-3xl" />
                </div>
              </div>

              {/* Secondary Action: AI Chat Assistant */}
              <div className="md:col-span-2">
                <div
                  onClick={() => setActiveTab('chat')}
                  className="group relative bg-[#1a1a1a] border border-gray-800 rounded-xl p-8 cursor-pointer transition-all duration-300 hover:border-indigo-500/50 hover:shadow-lg hover:shadow-indigo-500/10"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-4">
                      <div className="w-12 h-12 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-xl flex items-center justify-center">
                        <MessageSquare className="w-6 h-6 text-white" />
                      </div>
                      <div>
                        <h3 className="text-xl font-semibold text-white mb-1">
                          Ask AI Assistant
                        </h3>
                        <p className="text-sm text-gray-400">
                          Chat without capturing your screen
                        </p>
                      </div>
                    </div>
                    <div className="opacity-0 group-hover:opacity-100 transition-opacity">
                      <ArrowRight className="w-5 h-5 text-indigo-400" />
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Footer hint */}
            <div className="mt-12 text-center text-sm text-gray-600">
              <p>
                Start by uploading your documentation or press{' '}
                <kbd className="px-2 py-1 bg-gray-800 rounded text-gray-400 font-mono">
                  {shortcutKeys.join(' + ')}
                </kbd>{' '}
                to begin
              </p>
            </div>
          </div>
        )}

        {/* Captures Tab */}
        {activeTab === 'captures' && (
          <div className="flex-1 overflow-y-auto p-6">
            <div className="max-w-4xl mx-auto">
              <div className="flex justify-between items-center mb-6">
                <h2 className="text-2xl font-bold text-white">Captures</h2>
                {ocrResults.length > 0 && (
                  <button
                    onClick={clearAllCaptures}
                    className="px-4 py-2 text-sm text-red-400 hover:text-red-300 hover:bg-red-500/10 rounded-lg transition-colors flex items-center gap-2"
                  >
                    <Trash2 className="w-4 h-4" />
                    Clear All
                  </button>
                )}
              </div>

              {/* Search Bar */}
              {ocrResults.length > 0 && (
                <div className="mb-6 relative">
                  <Search className="absolute left-4 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-500" />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Search captures by text or AI solution..."
                    className="w-full pl-12 pr-4 py-3 bg-[#1a1a1a] border border-gray-800 rounded-xl text-white placeholder-gray-500 focus:outline-none focus:border-indigo-500 transition-colors"
                  />
                  {searchQuery && (
                    <p className="text-sm text-gray-500 mt-2">
                      Found {filteredCaptures.length} of {ocrResults.length} captures
                    </p>
                  )}
                </div>
              )}

              {ocrResults.length === 0 ? (
                <div className="text-center py-16">
                  <div className="w-16 h-16 mx-auto mb-4 bg-gray-800 rounded-2xl flex items-center justify-center">
                    <History className="w-8 h-8 text-gray-600" />
                  </div>
                  <p className="text-gray-500 mb-2">No captures yet</p>
                  <p className="text-sm text-gray-600">
                    Press <kbd className="px-2 py-1 bg-gray-800 rounded text-gray-400 font-mono">{shortcutKeys.join(' + ')}</kbd> to capture
                  </p>
                </div>
              ) : filteredCaptures.length === 0 ? (
                <p className="text-gray-500 text-center py-8">No captures match your search.</p>
              ) : (
                <div className="space-y-4">
                  {filteredCaptures.map((result) => {
                    const originalIndex = ocrResults.findIndex(r => r.timestamp === result.timestamp)
                    return (
                      <div key={result.timestamp} className="bg-[#1a1a1a] border border-gray-800 rounded-xl p-6 hover:border-gray-700 transition-colors">
                        {/* Captured Image */}
                        {result.image && (
                          <div className="mb-4 bg-[#0f0f0f] rounded-lg p-3">
                            <img
                              src={result.image}
                              alt="Captured screenshot"
                              className="max-w-full h-auto rounded-lg border border-gray-800"
                            />
                          </div>
                        )}

                        {/* AI Solution */}
                        {result.aiSolution && (
                          <div className="mb-4">
                            <div className="flex justify-between items-center mb-2">
                              <p className="text-sm font-medium text-indigo-400">AI Solution</p>
                              <div className="flex gap-2">
                                <button
                                  onClick={() => copyToClipboard(result.aiSolution)}
                                  className="px-3 py-1.5 text-xs bg-gray-800 hover:bg-gray-700 text-gray-300 rounded-lg transition-colors flex items-center gap-1"
                                >
                                  <Copy className="w-3 h-3" />
                                  Copy
                                </button>
                                <button
                                  onClick={() => openCaptureChat(result.timestamp, ocrResults.length - originalIndex)}
                                  className="px-3 py-1.5 text-xs bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg transition-colors flex items-center gap-1"
                                >
                                  <MessageSquare className="w-3 h-3" />
                                  Follow-up
                                </button>
                              </div>
                            </div>
                            <div className="bg-indigo-500/10 border border-indigo-500/20 rounded-lg p-4">
                              <p className="text-sm text-gray-200 whitespace-pre-wrap">{result.aiSolution}</p>
                            </div>
                          </div>
                        )}

                        {/* Relevant Docs */}
                        {result.relevantDocs && result.relevantDocs.length > 0 && (
                          <div className="mb-4">
                            <p className="text-sm font-medium text-blue-400 mb-2">
                              Relevant Documentation ({result.relevantDocs.length})
                            </p>
                            <div className="space-y-2">
                              {result.relevantDocs.map((doc, docIndex) => (
                                <div key={docIndex} className="bg-blue-500/10 border border-blue-500/20 rounded-lg p-3">
                                  <div className="flex justify-between items-start mb-1">
                                    <p className="text-xs font-medium text-blue-300">{doc.docName}</p>
                                    <span className="text-xs text-blue-400">Score: {doc.score}</span>
                                  </div>
                                  <p className="text-xs text-gray-400 whitespace-pre-wrap">{doc.text}</p>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}

                        {/* Capture Info */}
                        <div className="flex justify-between items-center pt-4 border-t border-gray-800">
                          <div>
                            <p className="text-sm text-gray-400">Capture #{ocrResults.length - originalIndex}</p>
                            <p className="text-xs text-gray-600">
                              {result.bounds.width} x {result.bounds.height} px
                            </p>
                          </div>
                          <div className="flex items-center gap-3">
                            <p className="text-xs text-gray-600">
                              {new Date(result.timestamp).toLocaleString()}
                            </p>
                            <button
                              onClick={() => deleteCapture(originalIndex)}
                              className="p-2 text-gray-500 hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-colors"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </div>

                        {/* Captured Text (collapsible) */}
                        <details className="mt-4">
                          <summary className="text-xs font-medium text-gray-500 cursor-pointer hover:text-gray-400">
                            View Captured Text
                          </summary>
                          <div className="mt-2 bg-[#0f0f0f] rounded-lg p-3 flex justify-between items-start">
                            <p className="text-gray-300 font-mono text-sm whitespace-pre-wrap flex-1">
                              {result.text || '(No text detected)'}
                            </p>
                            {result.text && (
                              <button
                                onClick={() => copyToClipboard(result.text)}
                                className="ml-2 p-2 text-gray-500 hover:text-gray-300 hover:bg-gray-800 rounded-lg transition-colors"
                              >
                                <Copy className="w-4 h-4" />
                              </button>
                            )}
                          </div>
                        </details>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          </div>
        )}

        {/* Documents Tab */}
        {activeTab === 'documents' && (
          <div className="flex-1 overflow-y-auto p-6">
            <div className="max-w-4xl mx-auto">
              <div className="flex justify-between items-center mb-6">
                <h2 className="text-2xl font-bold text-white">Knowledge Base</h2>
                <button
                  onClick={handleUploadDocument}
                  disabled={isProcessing}
                  className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg transition-colors flex items-center gap-2 disabled:opacity-50"
                >
                  <Plus className="w-4 h-4" />
                  {isProcessing ? 'Processing...' : 'Upload Document'}
                </button>
              </div>

              {documents.length === 0 ? (
                <div className="text-center py-16">
                  <div className="w-16 h-16 mx-auto mb-4 bg-gray-800 rounded-2xl flex items-center justify-center">
                    <FileText className="w-8 h-8 text-gray-600" />
                  </div>
                  <p className="text-gray-500 mb-2">No documents uploaded yet</p>
                  <p className="text-sm text-gray-600">
                    Upload PDFs or text files to enable AI context
                  </p>
                </div>
              ) : (
                <div className="space-y-3">
                  {documents.map((doc) => (
                    <div key={doc.id} className="bg-[#1a1a1a] border border-gray-800 rounded-xl p-4 flex items-center justify-between hover:border-gray-700 transition-colors">
                      <div className="flex items-center gap-4">
                        <div className="w-10 h-10 bg-indigo-500/20 rounded-lg flex items-center justify-center">
                          <FileText className="w-5 h-5 text-indigo-400" />
                        </div>
                        <div>
                          <p className="font-medium text-white">{doc.name}</p>
                          <p className="text-sm text-gray-500">
                            {doc.type.toUpperCase()} • {doc.chunks} chunks • {new Date(doc.uploadedAt).toLocaleDateString()}
                          </p>
                        </div>
                      </div>
                      <button
                        onClick={() => handleDeleteDocument(doc.id)}
                        className="p-2 text-gray-500 hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-colors"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* Chat Tab */}
        {activeTab === 'chat' && (
          <div className="flex-1 flex flex-col overflow-hidden">
            {/* Chat Tabs */}
            <div className="flex items-center border-b border-gray-800 bg-[#0f0f0f] px-2 pt-2">
              {chatTabs.map((tab) => (
                <div
                  key={tab.id}
                  className={`flex items-center gap-2 px-4 py-2 rounded-t-lg cursor-pointer border-t border-l border-r transition-colors ${
                    activeChatTabId === tab.id
                      ? 'bg-[#1a1a1a] border-gray-800 -mb-px text-white'
                      : 'bg-transparent border-transparent text-gray-500 hover:text-gray-300 hover:bg-gray-800/50'
                  }`}
                  onClick={() => setActiveChatTabId(tab.id)}
                >
                  <span className="text-sm font-medium truncate max-w-[120px]">
                    {tab.type === 'general' ? 'General' : tab.title}
                  </span>
                  {tab.type !== 'general' && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation()
                        closeChatTab(tab.id)
                      }}
                      className="text-gray-500 hover:text-gray-300 rounded-full w-5 h-5 flex items-center justify-center hover:bg-gray-700"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  )}
                </div>
              ))}
            </div>

            {/* Chat Content */}
            <div className="flex-1 flex flex-col overflow-hidden p-6">
              {activeChatTab ? (
                <div className="flex-1 flex flex-col max-w-4xl mx-auto w-full">
                  {/* Chat Header */}
                  {activeChatTab.type === 'capture' && activeCaptureForChat && (
                    <div className="mb-4 pb-4 border-b border-gray-800">
                      <div className="flex items-start gap-4">
                        {activeCaptureForChat.image && (
                          <img
                            src={activeCaptureForChat.image}
                            alt="Capture context"
                            className="w-20 h-auto rounded-lg border border-gray-800"
                          />
                        )}
                        <div>
                          <h3 className="text-sm font-semibold text-white mb-1">
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
                    <div className="mb-4 pb-4 border-b border-gray-800">
                      <h3 className="text-sm font-semibold text-white mb-1">General Chat</h3>
                      <p className="text-xs text-gray-500">
                        Ask questions about your uploaded documentation
                      </p>
                    </div>
                  )}

                  {/* Chat Messages */}
                  <div className="flex-1 overflow-y-auto mb-4 space-y-4">
                    {activeChatTab.chatHistory.length === 0 && activeChatTab.type === 'general' && (
                      <div className="text-center py-16">
                        <div className="w-16 h-16 mx-auto mb-4 bg-gray-800 rounded-2xl flex items-center justify-center">
                          <MessageSquare className="w-8 h-8 text-gray-600" />
                        </div>
                        <p className="text-gray-500">Ask any question about your documentation...</p>
                      </div>
                    )}
                    {activeChatTab.chatHistory.map((msg, msgIndex) => (
                      <div
                        key={msgIndex}
                        className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
                      >
                        <div
                          className={`max-w-[80%] p-4 rounded-2xl ${
                            msg.role === 'user'
                              ? 'bg-indigo-600 text-white'
                              : 'bg-[#1a1a1a] border border-gray-800 text-gray-200'
                          }`}
                        >
                          <p className="text-sm whitespace-pre-wrap">{msg.content}</p>
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* Chat Input */}
                  <div className="flex gap-3">
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
                      className="flex-1 px-4 py-3 bg-[#1a1a1a] border border-gray-800 rounded-xl text-white placeholder-gray-500 focus:outline-none focus:border-indigo-500 disabled:opacity-50 transition-colors"
                    />
                    <button
                      onClick={handleSendMessage}
                      disabled={isSending || !chatInput.trim()}
                      className="px-6 py-3 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
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
          <div className="flex-1 overflow-y-auto p-6">
            <div className="max-w-2xl mx-auto">
              <h2 className="text-2xl font-bold text-white mb-8">Settings</h2>

              {/* Keyboard Shortcut */}
              <div className="bg-[#1a1a1a] border border-gray-800 rounded-xl p-6 mb-6">
                <h3 className="text-lg font-medium text-white mb-2">Capture Shortcut</h3>
                <p className="text-sm text-gray-500 mb-4">
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
                      className={`w-full px-4 py-3 rounded-xl focus:outline-none transition-colors ${
                        isRecordingShortcut
                          ? 'bg-indigo-500/10 border-2 border-indigo-500 text-white'
                          : 'bg-[#0f0f0f] border border-gray-800 text-gray-300'
                      }`}
                    />
                    {shortcutError && (
                      <p className="text-sm text-red-400 mt-2">{shortcutError}</p>
                    )}
                  </div>

                  {shortcutInput !== settings.captureShortcut && (
                    <div className="flex gap-2">
                      <button
                        onClick={saveShortcut}
                        className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg transition-colors"
                      >
                        Save
                      </button>
                      <button
                        onClick={resetShortcut}
                        className="px-4 py-2 bg-gray-800 hover:bg-gray-700 text-gray-300 rounded-lg transition-colors"
                      >
                        Cancel
                      </button>
                    </div>
                  )}
                </div>

                <p className="text-xs text-gray-600 mt-3">
                  Current shortcut:{' '}
                  <kbd className="px-2 py-1 bg-gray-800 rounded text-gray-400 font-mono">
                    {shortcutKeys.join(' + ')}
                  </kbd>
                </p>
              </div>

              {/* Data Management */}
              <div className="bg-[#1a1a1a] border border-gray-800 rounded-xl p-6 mb-6">
                <h3 className="text-lg font-medium text-white mb-2">Data Management</h3>
                <p className="text-sm text-gray-500 mb-4">
                  Manage your captured data and chat history.
                </p>

                <div className="flex gap-4">
                  <button
                    onClick={clearAllCaptures}
                    disabled={ocrResults.length === 0}
                    className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                      ocrResults.length === 0
                        ? 'bg-gray-800 text-gray-600 cursor-not-allowed'
                        : 'bg-red-500/10 text-red-400 hover:bg-red-500/20'
                    }`}
                  >
                    Clear Captures ({ocrResults.length})
                  </button>
                  <button
                    onClick={clearAllChats}
                    disabled={chatTabs.length <= 1 && chatTabs[0]?.chatHistory.length === 0}
                    className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                      chatTabs.length <= 1 && chatTabs[0]?.chatHistory.length === 0
                        ? 'bg-gray-800 text-gray-600 cursor-not-allowed'
                        : 'bg-red-500/10 text-red-400 hover:bg-red-500/20'
                    }`}
                  >
                    Clear Chats ({chatTabs.length} tabs)
                  </button>
                </div>
              </div>

              {/* About */}
              <div className="bg-[#1a1a1a] border border-gray-800 rounded-xl p-6">
                <h3 className="text-lg font-medium text-white mb-2">About</h3>
                <p className="text-sm text-gray-400">
                  SnipSolve - Overlay RAG Tool for instant documentation search
                </p>
                <p className="text-xs text-gray-600 mt-2">
                  Data stored in: ~/.snipsolve/
                </p>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  )
}

export default MainWindow
