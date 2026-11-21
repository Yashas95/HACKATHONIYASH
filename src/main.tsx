import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'

// No StrictMode: the Monitor owns a camera stream + render loop that must not be double-started.
createRoot(document.getElementById('root')!).render(<App />)
