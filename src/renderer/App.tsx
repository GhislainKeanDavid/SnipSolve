import { useEffect, useState } from 'react'
import OverlayCapture from './components/OverlayCapture'
import MainWindow from './components/MainWindow'

function App() {
  const [isOverlay, setIsOverlay] = useState(false)

  useEffect(() => {
    // Check if we're in overlay mode based on URL hash
    const checkMode = () => {
      setIsOverlay(window.location.hash === '#overlay')
    }

    checkMode()
    window.addEventListener('hashchange', checkMode)

    return () => window.removeEventListener('hashchange', checkMode)
  }, [])

  if (isOverlay) {
    return <OverlayCapture />
  }

  return <MainWindow />
}

export default App
