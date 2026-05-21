import { useState } from 'react'
import ConnectionsPage from '@/pages/ConnectionsPage'
import TagBrowserPage from '@/pages/TagBrowserPage'
import MonitorPage from '@/pages/MonitorPage'

function App() {
  const [page, setPage] = useState<'connections' | 'tags' | 'monitor'>('connections')

  return (
    <div>
      {/* Top navigation bar */}
      <div className="border-b px-8 py-3 flex gap-4">
        <button
          className={`text-sm font-medium ${page === 'connections' ? 'text-foreground' : 'text-muted-foreground'}`}
          onClick={() => setPage('connections')}
        >
          Connections
        </button>
        <button
          className={`text-sm font-medium ${page === 'tags' ? 'text-foreground' : 'text-muted-foreground'}`}
          onClick={() => setPage('tags')}
        >
          Tag Browser
        </button>
        <button
          className={`text-sm font-medium ${page === 'monitor' ? 'text-foreground' : 'text-muted-foreground'}`}
          onClick={() => setPage('monitor')}
        >
          Live Monitor
        </button>
      </div>

      {/* Render the active page */}
      {page === 'connections' && <ConnectionsPage />}
      {page === 'tags' && <TagBrowserPage />}
      {page === 'monitor' && <MonitorPage />}
    </div>
  )
}

export default App