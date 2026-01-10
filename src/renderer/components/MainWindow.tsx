import { useState, useEffect } from 'react'
import type { OCRResult, ChatMessage } from '../electron'

interface Document {
  id: string
  name: string
  path: string
  type: string
  uploadedAt: string
  chunks: number
}

type Tab = 'captures' | 'documents' | 'chat'

// Chat tab structure (browser-style)
interface ChatTab {
  id: string
  type: 'general' | 'capture'
  captureTimestamp?: string
  title: string
  chatHistory: ChatMessage[]
}

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

  useEffect(() => {
    // Listen for OCR results
    const cleanup = window.electronAPI.onOCRResult((result) => {
      setOcrResults(prev => [result, ...prev])
    })

    // Load existing documents
    loadDocuments()

    // Cleanup listener when component unmounts
    return cleanup
  }, [])

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
      setChatTabs(prev => [...prev, newTab])
      setActiveChatTabId(tabId)
    }
    setActiveTab('chat')
  }

  const closeChatTab = (tabId: string) => {
    if (tabId === 'general') return // Can't close general tab

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
        setChatTabs(prev => prev.map(t =>
          t.id === activeChatTabId
            ? { ...t, chatHistory: [...updatedHistory, { role: 'assistant', content: response.reply! }] }
            : t
        ))
      } else {
        setChatTabs(prev => prev.map(t =>
          t.id === activeChatTabId
            ? { ...t, chatHistory: [...updatedHistory, { role: 'assistant', content: `Error: ${response.error || 'Failed to get response'}` }] }
            : t
        ))
      }
    } catch (error) {
      console.error('Chat error:', error)
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
            <p>2. Press <kbd className="px-2 py-1 bg-gray-200 rounded">Ctrl + Shift + S</kbd> to capture screen region</p>
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
          </nav>
        </div>

        {/* Captures Tab */}
        {activeTab === 'captures' && (
          <div className="bg-white rounded-lg shadow-md p-6">
            <h2 className="text-2xl font-semibold text-gray-800 mb-4">OCR Results</h2>
            {ocrResults.length === 0 ? (
              <p className="text-gray-500 italic">No captures yet. Use Ctrl+Shift+S to start capturing!</p>
            ) : (
              <div className="space-y-4">
                {ocrResults.map((result, index) => (
                  <div key={index} className="border border-gray-200 rounded p-4 bg-gray-50">
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

                    {/* AI Solution with Ask Follow-up button */}
                    {result.aiSolution && (
                      <div className="mb-3">
                        <div className="flex justify-between items-center mb-2">
                          <p className="text-xs font-semibold text-green-600">
                            🤖 AI Solution:
                          </p>
                          <button
                            onClick={() => openCaptureChat(result.timestamp, ocrResults.length - index)}
                            className="px-3 py-1 rounded-md text-xs font-medium bg-purple-600 text-white hover:bg-purple-700 transition-colors"
                          >
                            💬 Ask Follow-up
                          </button>
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
                        <p className="text-sm text-gray-500">Capture #{ocrResults.length - index}</p>
                        <p className="text-xs text-gray-400">
                          {new Date(result.timestamp).toLocaleTimeString()}
                        </p>
                      </div>
                      <p className="text-xs text-gray-500">
                        Region: {result.bounds.width} x {result.bounds.height} px
                        at ({result.bounds.x}, {result.bounds.y})
                      </p>
                      {/* Captured Text (collapsible) */}
                      <details className="mt-2">
                        <summary className="text-xs font-semibold text-gray-600 cursor-pointer hover:text-gray-800">
                          View Captured Text
                        </summary>
                        <div className="mt-2 bg-white border border-gray-200 rounded p-3">
                          <p className="text-gray-800 font-mono text-sm whitespace-pre-wrap">
                            {result.text || '(No text detected)'}
                          </p>
                        </div>
                      </details>
                    </div>
                  </div>
                ))}
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
      </div>
    </div>
  )
}

export default MainWindow
