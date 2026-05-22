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
    <div className="min-h-screen" style={{ backgroundColor: '#f5f7fa' }}>
      {/* Top navigation bar */}
      <div className="border-b bg-white sticky top-0 z-10 shadow-sm">
        <div className="px-8 flex items-center gap-1 h-14">
          {/* App logo / title */}
          <span className="text-sm font-bold tracking-tight mr-8 text-slate-800">
            ⚙ Silver OPC UA
          </span>

          {/* Nav tabs */}
          {NAV_ITEMS.map(item => (
            <button
              key={item.id}
              onClick={() => setPage(item.id)}
              className={`
                relative flex items-center gap-2 px-4 py-4 text-sm font-medium
                transition-colors duration-150 border-b-2
                ${page === item.id
                  ? 'border-indigo-500 text-indigo-600'
                  : 'border-transparent text-slate-500 hover:text-slate-800 hover:border-slate-300'
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