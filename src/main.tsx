import './index.css'

import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'

import App from './App'
import { isTauriRuntime } from './platform'

if (isTauriRuntime()) {
  document.documentElement.classList.add('is-native')
}

const rootElement = document.getElementById('root')

if (!rootElement) {
  throw new Error('Could not find the application root.')
}

createRoot(rootElement).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
