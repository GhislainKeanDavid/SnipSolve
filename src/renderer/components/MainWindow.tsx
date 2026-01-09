import { useState, useEffect } from 'react'
import type { OCRResult } from '../electron'

interface Document {
  id: string
  name: string
  path: string
  type: string
  uploadedAt: string
  chunks: number
}

type Tab = 'captures' | 'documents'

function MainWindow() {
  const [activeTab, setActiveTab] = useState<Tab>('captures')
  const [ocrResults, setOcrResults] = useState<OCRResult[]>([])
  const [documents, setDocuments] = useState<Document[]>([])
  const [isProcessing, setIsProcessing] = useState(false)

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

        {/* Tabs */}
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
                    <div className="flex justify-between items-start mb-2">
                      <p className="text-sm text-gray-500">Capture #{ocrResults.length - index}</p>
                      <p className="text-xs text-gray-400">
                        {new Date(result.timestamp).toLocaleTimeString()}
                      </p>
                    </div>
                    <div className="mb-2">
                      <p className="text-xs text-gray-500">
                        Region: {result.bounds.width} x {result.bounds.height} px
                        at ({result.bounds.x}, {result.bounds.y})
                      </p>
                    </div>

                    {result.image && (
                      <div className="mb-3 bg-white border border-gray-200 rounded p-3">
                        <p className="text-xs font-semibold text-gray-600 mb-2">Captured Image:</p>
                        <img
                          src={result.image}
                          alt="Captured screenshot"
                          className="max-w-full h-auto border border-gray-300 rounded"
                        />
                      </div>
                    )}

                    <div className="bg-white border border-gray-200 rounded p-3 mb-3">
                      <p className="text-xs font-semibold text-gray-600 mb-2">Captured Text:</p>
                      <p className="text-gray-800 font-mono text-sm whitespace-pre-wrap">
                        {result.text || '(No text detected)'}
                      </p>
                    </div>

                    {result.relevantDocs && result.relevantDocs.length > 0 && (
                      <div className="mt-3 pt-3 border-t border-gray-300">
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
                      <div className="mt-3 pt-3 border-t border-gray-300">
                        <p className="text-xs text-gray-500 italic">No relevant documentation found</p>
                      </div>
                    )}

                    {result.aiSolution && (
                      <div className="mt-3 pt-3 border-t border-gray-300">
                        <p className="text-xs font-semibold text-green-600 mb-2">
                          🤖 AI Solution:
                        </p>
                        <div className="bg-green-50 border border-green-200 rounded p-3">
                          <p className="text-sm text-gray-800 whitespace-pre-wrap">{result.aiSolution}</p>
                        </div>
                      </div>
                    )}
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
      </div>
    </div>
  )
}

export default MainWindow
