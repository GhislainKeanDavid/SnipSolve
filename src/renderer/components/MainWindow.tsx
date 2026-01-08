import { useState, useEffect } from 'react'
import type { OCRResult } from '../electron'

function MainWindow() {
  const [ocrResults, setOcrResults] = useState<OCRResult[]>([])

  useEffect(() => {
    // Listen for OCR results
    const cleanup = window.electronAPI.onOCRResult((result) => {
      setOcrResults(prev => [result, ...prev])
    })

    // Cleanup listener when component unmounts
    return cleanup
  }, [])

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
            <p>1. Press <kbd className="px-2 py-1 bg-gray-200 rounded">Ctrl + Shift + S</kbd> (or <kbd className="px-2 py-1 bg-gray-200 rounded">Cmd + Shift + S</kbd> on Mac) to activate the screen capture overlay</p>
            <p>2. Click and drag to select a region of your screen</p>
            <p>3. Release to capture and extract text using OCR</p>
            <p>4. The extracted text will appear below</p>
          </div>
        </div>

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
                  <div className="bg-white border border-gray-200 rounded p-3">
                    <p className="text-gray-800 font-mono text-sm whitespace-pre-wrap">
                      {result.text || '(No text detected)'}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

export default MainWindow
