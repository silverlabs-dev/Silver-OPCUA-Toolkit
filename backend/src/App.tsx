import { useState } from 'react'
import ConnectionsPage from '@/pages/ConnectionsPage'
import TagBrowserPage from '@/pages/TagBrowserPage'

// Simple tab-based navigation between pages
function App() {
  const [page, setPage] = useState<'connections' | 'tags'>('connections')

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
      </div>

      {/* Page content */}
      {page === 'connections' && <ConnectionsPage />}
      {page === 'tags' && <TagBrowserPage />}
    </div>
  )
}

export default App