import { LayoutGrid, MonitorPlay } from 'lucide-react'

export type View = 'landing' | 'overview' | 'console'

export function Logo({ size = 22 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden>
      <path d="M12 2.5 20 5.6v6.1c0 4.9-3.3 8.4-8 9.8-4.7-1.4-8-4.9-8-9.8V5.6z" fill="none" stroke="#E6E8EB" strokeWidth="1.6" />
      <path d="M7.5 13.2c1.5-1 3-1 4.5 0s3 1 4.5 0" fill="none" stroke="#5B9BFF" strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  )
}

/** Slim product navigation rail shared by both screens. */
export function Rail({ view, onNav, engineOk }: { view: View; onNav: (v: View) => void; engineOk: boolean }) {
  const item = (v: View, Icon: typeof LayoutGrid, label: string) => (
    <button onClick={() => onNav(v)} title={label}
      className={`flex h-10 w-10 items-center justify-center rounded-md transition-colors ${view === v ? 'bg-surface-2 text-ink' : 'text-muted hover:bg-surface hover:text-ink'}`}>
      <Icon size={18} strokeWidth={1.75} />
    </button>
  )
  return (
    <nav className="flex w-[56px] shrink-0 flex-col items-center gap-1 border-r border-line bg-bg py-3">
      <button className="mb-3" onClick={() => onNav('landing')} title="EdgeGuard AI home"><Logo /></button>
      {item('overview', LayoutGrid, 'Overview')}
      {item('console', MonitorPlay, 'Live view')}
      <div className="mt-auto" title={engineOk ? 'Vision models loaded' : 'Loading vision models'}>
        <span className="dot" style={{ background: engineOk ? '#3FB97A' : '#E0A43A' }} />
      </div>
    </nav>
  )
}
