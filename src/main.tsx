import { Component, type ReactNode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'

/** Crash guard: an unexpected error shows a recovery screen instead of a blank page. */
class Guard extends Component<{ children: ReactNode }, { error: Error | null }> {
  state = { error: null as Error | null }
  static getDerivedStateFromError(error: Error) { return { error } }
  componentDidCatch(error: Error) { console.error('EdgeGuard UI error', error) }
  render() {
    if (!this.state.error) return this.props.children
    return (
      <div className="flex h-full items-center justify-center p-6">
        <div className="card max-w-md p-5">
          <div className="text-[14px] font-semibold">Something went wrong</div>
          <p className="mt-1 text-[12.5px] text-muted">{this.state.error.message}</p>
          <p className="mt-2 text-[12px] text-muted">Incidents and saved yellow lines are kept. Reloading restores the console.</p>
          <button className="btn btn-primary mt-4" onClick={() => location.reload()}>Reload</button>
        </div>
      </div>
    )
  }
}

// No StrictMode: the Monitor owns a camera stream + render loop that must not be double-started.
createRoot(document.getElementById('root')!).render(<Guard><App /></Guard>)
