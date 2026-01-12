import { useEffect, useState } from 'react'
import OverlayCapture from './components/OverlayCapture'
import MainWindow from './components/MainWindow'

function App() {
  const [isOverlay, setIsOverlay] = useState(false)

  useEffect(() => {
    // Check if we're in overlay mode based on URL hash
    const checkMode = () => {
      const overlayMode = window.location.hash === '#overlay'
      setIsOverlay(overlayMode)

      // Add/remove overlay-mode class on html element for CSS targeting
      if (overlayMode) {
        document.documentElement.classList.add('overlay-mode')
        document.body.classList.add('overlay-mode')
      } else {
        document.documentElement.classList.remove('overlay-mode')
        document.body.classList.remove('overlay-mode')
      }
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
