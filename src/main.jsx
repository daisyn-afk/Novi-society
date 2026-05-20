import React from 'react'
import ReactDOM from 'react-dom/client'
import App from '@/App.jsx'
import '@/index.css'
import { bootstrapPasswordResetFromHash } from '@/lib/bootstrapPasswordResetHash.js'

if (!bootstrapPasswordResetFromHash()) {
  ReactDOM.createRoot(document.getElementById('root')).render(
    <App />
  )
}
