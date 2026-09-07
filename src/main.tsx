import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './lib/installPrompt'
import { registerServiceWorker } from './lib/registerServiceWorker'
import './index.css'
import App from './App.tsx'

registerServiceWorker()

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
