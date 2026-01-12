import { useState, useRef, useEffect } from 'react'

interface Position {
  x: number
  y: number
}

interface SelectionBox {
  startX: number
  startY: number
  endX: number
  endY: number
}

function OverlayCapture() {
  const [isSelecting, setIsSelecting] = useState(false)
  const [selection, setSelection] = useState<SelectionBox | null>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    console.log('OverlayCapture component mounted!')
    console.log('Window hash:', window.location.hash)

    // Ensure transparent backgrounds for overlay mode
    document.documentElement.style.backgroundColor = 'transparent'
    document.body.style.backgroundColor = 'transparent'
    const root = document.getElementById('root')
    if (root) {
      root.style.backgroundColor = 'transparent'
    }

    // Handle escape key to close overlay
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        console.log('ESC pressed, hiding overlay')
        window.electronAPI.hideOverlay()
      }
    }

    window.addEventListener('keydown', handleEscape)
    return () => window.removeEventListener('keydown', handleEscape)
  }, [])

  const handleMouseDown = (e: React.MouseEvent) => {
    setIsSelecting(true)
    setSelection({
      startX: e.clientX,
      startY: e.clientY,
      endX: e.clientX,
      endY: e.clientY
    })
  }

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isSelecting || !selection) return

    setSelection({
      ...selection,
      endX: e.clientX,
      endY: e.clientY
    })
  }

  const handleMouseUp = async () => {
    if (!selection) return

    setIsSelecting(false)

    // Calculate the bounds of the selection
    const x = Math.min(selection.startX, selection.endX)
    const y = Math.min(selection.startY, selection.endY)
    const width = Math.abs(selection.endX - selection.startX)
    const height = Math.abs(selection.endY - selection.startY)

    // Only capture if the selection is large enough
    if (width > 10 && height > 10) {
      console.log('Capturing region:', { x, y, width, height })

      try {
        // Call Electron API to capture the screenshot
        const result = await window.electronAPI.captureScreenshot({ x, y, width, height })
        console.log('Capture result:', result)
      } catch (error) {
        console.error('Failed to capture screenshot:', error)
      }
    }

    // Reset and hide overlay
    setSelection(null)
    window.electronAPI.hideOverlay()
  }

  // Calculate the display box for the selection
  const getSelectionStyle = () => {
    if (!selection) return {}

    const x = Math.min(selection.startX, selection.endX)
    const y = Math.min(selection.startY, selection.endY)
    const width = Math.abs(selection.endX - selection.startX)
    const height = Math.abs(selection.endY - selection.startY)

    return {
      left: `${x}px`,
      top: `${y}px`,
      width: `${width}px`,
      height: `${height}px`
    }
  }

  // Calculate the selection bounds
  const getSelectionBounds = () => {
    if (!selection) return null

    const x = Math.min(selection.startX, selection.endX)
    const y = Math.min(selection.startY, selection.endY)
    const width = Math.abs(selection.endX - selection.startX)
    const height = Math.abs(selection.endY - selection.startY)

    return { x, y, width, height }
  }

  const bounds = getSelectionBounds()

  return (
    <div
      className="fixed inset-0 cursor-crosshair"
      style={{
        width: '100vw',
        height: '100vh',
        position: 'fixed',
        top: 0,
        left: 0,
        zIndex: 9999
      }}
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
    >
      {/* Dark overlay with cutout effect */}
      {!selection ? (
        // Full overlay when no selection
        <div
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            width: '100%',
            height: '100%',
            backgroundColor: 'rgba(0, 0, 0, 0.3)',
            pointerEvents: 'none'
          }}
        />
      ) : (
        // Four panels creating a cutout effect around the selection
        <>
          {/* Top panel */}
          <div
            style={{
              position: 'absolute',
              top: 0,
              left: 0,
              width: '100%',
              height: `${bounds!.y}px`,
              backgroundColor: 'rgba(0, 0, 0, 0.3)',
              pointerEvents: 'none'
            }}
          />
          {/* Bottom panel */}
          <div
            style={{
              position: 'absolute',
              top: `${bounds!.y + bounds!.height}px`,
              left: 0,
              width: '100%',
              height: `calc(100% - ${bounds!.y + bounds!.height}px)`,
              backgroundColor: 'rgba(0, 0, 0, 0.3)',
              pointerEvents: 'none'
            }}
          />
          {/* Left panel */}
          <div
            style={{
              position: 'absolute',
              top: `${bounds!.y}px`,
              left: 0,
              width: `${bounds!.x}px`,
              height: `${bounds!.height}px`,
              backgroundColor: 'rgba(0, 0, 0, 0.3)',
              pointerEvents: 'none'
            }}
          />
          {/* Right panel */}
          <div
            style={{
              position: 'absolute',
              top: `${bounds!.y}px`,
              left: `${bounds!.x + bounds!.width}px`,
              width: `calc(100% - ${bounds!.x + bounds!.width}px)`,
              height: `${bounds!.height}px`,
              backgroundColor: 'rgba(0, 0, 0, 0.3)',
              pointerEvents: 'none'
            }}
          />
        </>
      )}

      {/* Instructions */}
      <div className="absolute top-4 left-1/2 transform -translate-x-1/2 bg-blue-600 px-6 py-3 rounded-lg shadow-xl">
        <p className="text-base font-semibold text-white">
          SnipSolve Active: Click and drag to select a region • Press ESC to cancel
        </p>
      </div>

      {/* Selection box border */}
      {selection && (
        <div
          className="absolute border-2 border-blue-500"
          style={getSelectionStyle()}
        >
          <div className="absolute -bottom-8 left-0 bg-blue-500 text-white text-xs px-2 py-1 rounded">
            {Math.abs(selection.endX - selection.startX)} x {Math.abs(selection.endY - selection.startY)}
          </div>
        </div>
      )}
    </div>
  )
}

export default OverlayCapture
