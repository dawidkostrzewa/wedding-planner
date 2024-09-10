import React from 'react'
import ReactDOM from 'react-dom/client'
import GraphicalEditor from './GraphicalEditor'
import './index.css'

const root = document.getElementById('root')

if (root) {
  ReactDOM.createRoot(root).render(
    <React.StrictMode>
      <GraphicalEditor />
    </React.StrictMode>,
  )
} else {
  console.error("Root element not found")
}
