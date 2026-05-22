// frontend/src/App.tsx

import { useState } from 'react'
import ConnectionsPage from '@/pages/ConnectionsPage'
import TagBrowserPage from '@/pages/TagBrowserPage'
import MonitorPage from '@/pages/MonitorPage'
import { Activity, Cable, Tag } from 'lucide-react'

type Page = 'connections' | 'tags' | 'monitor'

const NAV_ITEMS: { id: Page; label: string; icon: React.ReactNode }[] = [
  { id: 'connections', label: 'Connections', icon: <Cable className="w-4 h-4" /> },
  { id: 'tags',        label: 'Tag Browser', icon: <Tag className="w-4 h-4" /> },
  { id: 'monitor',     label: 'Live Monitor', icon: <Activity className="w-4 h-4" /> },
]

function App() {
  const [page, setPage] = useState<Page>('connections')

  return (
    <div className="min-h-screen bg-background">
      {/* Top navigation bar */}
      <div className="border-b bg-background/95 backdrop-blur sticky top-0 z-10">
        <div className="px-8 flex items-center gap-1 h-14">
          {/* App logo / title */}
          <span className="text-sm font-semibold tracking-tight mr-6 text-foreground">
            ⚙ Silver OPC UA
          </span>

          {/* Nav tabs */}
          {NAV_ITEMS.map(item => (
            <button
              key={item.id}
              onClick={() => setPage(item.id)}
              className={`
                flex items-center gap-2 px-3 py-1.5 rounded-md text-sm font-medium
                transition-colors duration-150
                ${page === item.id
                  ? 'bg-primary text-primary-foreground'
                  : 'text-muted-foreground hover:text-foreground hover:bg-muted'
                }
              `}
            >
              {item.icon}
              {item.label}
            </button>
          ))}
        </div>
      </div>

      {/* Render the active page */}
      {page === 'connections' && <ConnectionsPage />}
      {page === 'tags' && <TagBrowserPage />}
      {page === 'monitor' && <MonitorPage />}
    </div>
  )
}

export default App