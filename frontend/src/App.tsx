// frontend/src/App.tsx

import { useState } from 'react'
import ConnectionsPage from '@/pages/ConnectionsPage'
import TagBrowserPage from '@/pages/TagBrowserPage'
import MonitorPage from '@/pages/MonitorPage'
import { WatchlistProvider, useWatchlist } from '@/lib/watchlist'
import { Activity, Cable, Tag } from 'lucide-react'

type Page = 'connections' | 'tags' | 'monitor'

const NAV_ITEMS: { id: Page; label: string; icon: React.ReactNode }[] = [
  { id: 'connections', label: 'Connections', icon: <Cable className="w-4 h-4" /> },
  { id: 'tags',        label: 'Tag Browser', icon: <Tag className="w-4 h-4" /> },
  { id: 'monitor',     label: 'Live Monitor', icon: <Activity className="w-4 h-4" /> },
]

function NavBar({ page, setPage }: { page: Page; setPage: (p: Page) => void }) {
  const { watchlist } = useWatchlist()

  return (
    <div className="navbar sticky top-0 z-10">
      <div className="px-8 flex items-center gap-1 h-14">
        <span className="text-sm font-bold tracking-tight mr-8 text-slate-800">
          ⚙ Silver OPC UA
        </span>

        {NAV_ITEMS.map(item => (
          <button
            key={item.id}
            onClick={() => setPage(item.id)}
            style={{
              borderBottom: page === item.id ? '2px solid #6366f1' : '2px solid transparent',
              color: page === item.id ? '#6366f1' : '#64748b',
            }}
            className="relative flex items-center gap-2 px-4 h-full text-sm font-medium
                       transition-colors duration-150 hover:text-slate-800"
          >
            {item.icon}
            {item.label}

            {/* Watchlist badge on Live Monitor tab */}
            {item.id === 'monitor' && watchlist.length > 0 && (
              <span className="absolute top-3 right-1 flex items-center justify-center
                               w-4 h-4 rounded-full bg-indigo-500 text-white text-[10px] font-bold">
                {watchlist.length}
              </span>
            )}
          </button>
        ))}
      </div>
    </div>
  )
}

function AppContent() {
  const [page, setPage] = useState<Page>('connections')

  return (
    <div className="min-h-screen" style={{ backgroundColor: '#f1f5f9' }}>
      <NavBar page={page} setPage={setPage} />
      {page === 'connections' && <ConnectionsPage />}
      {page === 'tags' && <TagBrowserPage />}
      {page === 'monitor' && <MonitorPage />}
    </div>
  )
}

function App() {
  return (
    <WatchlistProvider>
      <AppContent />
    </WatchlistProvider>
  )
}

export default App