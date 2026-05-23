// frontend/src/pages/TagBrowserPage.tsx

import { useEffect, useState, useMemo } from 'react'
import type { Connection, NodeInfo } from '@/lib/api'
import { connectionsApi, tagsApi, parseNodeId } from '@/lib/api'
import { useWatchlist } from '@/lib/watchlist'
import { ChevronRight, ChevronDown, Folder, Tag, Search, X, Loader2, Info, Plus, Check } from 'lucide-react'

interface TreeNode extends NodeInfo {
  children?: TreeNode[]
  isLoading?: boolean
  isExpanded?: boolean
}

function flattenTree(nodes: TreeNode[], expanded: Record<string, TreeNode[]>): TreeNode[] {
  const result: TreeNode[] = []
  for (const node of nodes) {
    result.push(node)
    if (expanded[node.node_id]) {
      result.push(...flattenTree(expanded[node.node_id], expanded))
    }
  }
  return result
}

export default function TagBrowserPage() {
  const { addTag, removeTag, isWatched } = useWatchlist()

  const [connections, setConnections] = useState<Connection[]>([])
  const [selectedConnection, setSelectedConnection] = useState<Connection | null>(null)
  const [nodes, setNodes] = useState<TreeNode[]>([])
  const [expanded, setExpanded] = useState<Record<string, TreeNode[]>>({})
  const [loadingNodes, setLoadingNodes] = useState<Record<string, boolean>>({})
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [search, setSearch] = useState('')
  const [selectedTag, setSelectedTag] = useState<NodeInfo | null>(null)

  useEffect(() => {
    connectionsApi.list().then(res => setConnections(res.data))
  }, [])

  const handleSelectConnection = async (conn: Connection) => {
    setSelectedConnection(conn)
    setNodes([])
    setExpanded({})
    setError('')
    setSearch('')
    setSelectedTag(null)
    setLoading(true)
    try {
      const res = await tagsApi.browse(conn.id)
      setNodes(res.data)
    } catch {
      setError('Failed to browse tags. Is the connection active?')
    } finally {
      setLoading(false)
    }
  }

  const handleToggleExpand = async (node: TreeNode) => {
    if (!selectedConnection) return
    if (expanded[node.node_id]) {
      const next = { ...expanded }
      delete next[node.node_id]
      setExpanded(next)
      return
    }
    setLoadingNodes(prev => ({ ...prev, [node.node_id]: true }))
    try {
      const res = await tagsApi.browse(selectedConnection.id, node.node_id)
      setExpanded(prev => ({ ...prev, [node.node_id]: res.data }))
    } catch {
      setError('Failed to browse node children.')
    } finally {
      setLoadingNodes(prev => ({ ...prev, [node.node_id]: false }))
    }
  }

  const handleSelectTag = (node: NodeInfo) => {
    if (node.node_class === 'Variable') {
      setSelectedTag(prev => prev?.node_id === node.node_id ? null : node)
    }
  }

  const handleToggleWatch = (node: NodeInfo) => {
    if (!selectedConnection) return
    const cleanNodeId = parseNodeId(node.node_id)
    if (isWatched(cleanNodeId)) {
      removeTag(cleanNodeId)
    } else {
      addTag({
        node_id: cleanNodeId,
        name: node.name,
        connection_id: selectedConnection.id,
        connection_name: selectedConnection.name,
      })
    }
  }

  // Use clean node_id for isWatched check too
  const isNodeWatched = (node: NodeInfo) => isWatched(parseNodeId(node.node_id))

  const allNodes = useMemo(() => flattenTree(nodes, expanded), [nodes, expanded])
  const filteredNodes = useMemo(() => {
    if (!search) return null
    return allNodes.filter(n => n.name.toLowerCase().includes(search.toLowerCase()))
  }, [allNodes, search])

  const activeConnections = connections.filter(c => c.is_active)

  const renderNode = (node: TreeNode, depth: number = 0) => {
    const isObject = node.node_class === 'Object'
    const isExpanded = !!expanded[node.node_id]
    const isNodeLoading = !!loadingNodes[node.node_id]
    const isSelected = selectedTag?.node_id === node.node_id
    const watched = isNodeWatched(node)
    const children = expanded[node.node_id] || []

    return (
      <div key={node.node_id}>
        <div
          className={`
            flex items-center gap-2 py-1.5 rounded-md text-sm cursor-pointer
            transition-colors duration-100 group
            ${isSelected ? 'bg-indigo-50 text-indigo-700' : 'hover:bg-slate-100 text-slate-700'}
          `}
          style={{ paddingLeft: `${depth * 16 + 8}px`, paddingRight: '8px' }}
          onClick={() => isObject ? handleToggleExpand(node) : handleSelectTag(node)}
        >
          {/* Expand chevron */}
          <span className="w-4 shrink-0">
            {isObject && (
              isNodeLoading
                ? <Loader2 className="w-3.5 h-3.5 animate-spin text-slate-400" />
                : isExpanded
                  ? <ChevronDown className="w-3.5 h-3.5 text-slate-400" />
                  : <ChevronRight className="w-3.5 h-3.5 text-slate-400" />
            )}
          </span>

          {/* Icon */}
          {isObject
            ? <Folder className="w-4 h-4 text-amber-400 shrink-0" />
            : <Tag className="w-4 h-4 text-indigo-400 shrink-0" />
          }

          {/* Name */}
          <span className={`flex-1 truncate ${isObject ? 'font-medium text-slate-800' : ''}`}>
            {node.name}
          </span>

          {/* Value */}
          {node.value !== null && node.node_class === 'Variable' && (
            <span className={`
              font-mono text-xs px-1.5 py-0.5 rounded
              ${isSelected ? 'bg-indigo-100 text-indigo-600' : 'bg-slate-100 text-slate-500'}
            `}>
              {node.value}
            </span>
          )}

          {/* Add to watchlist button */}
          {node.node_class === 'Variable' && (
            <button
              onClick={e => { e.stopPropagation(); handleToggleWatch(node) }}
              title={watched ? 'Remove from watchlist' : 'Add to watchlist'}
              className={`
                ml-1 p-0.5 rounded transition-colors shrink-0
                ${watched
                  ? 'text-indigo-500 hover:text-red-400'
                  : 'text-slate-300 hover:text-indigo-500 opacity-0 group-hover:opacity-100'
                }
              `}
            >
              {watched
                ? <Check className="w-3.5 h-3.5" />
                : <Plus className="w-3.5 h-3.5" />
              }
            </button>
          )}
        </div>

        {isExpanded && children.map(child => renderNode(child, depth + 1))}
      </div>
    )
  }

  const renderSearchResults = () => {
    if (!filteredNodes) return null
    if (filteredNodes.length === 0) {
      return (
        <div className="py-8 text-center text-slate-400 text-sm">
          No tags matching "{search}"
        </div>
      )
    }
    return filteredNodes.map(node => renderNode(node, 0))
  }

  return (
    <div className="flex h-[calc(100vh-56px)]" style={{ backgroundColor: '#f5f7fa' }}>

      {/* Left panel — tree */}
      <div className="flex flex-col w-80 border-r bg-white shrink-0">

        {/* Connection selector */}
        <div className="p-3 border-b">
          <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-2">
            Connection
          </p>
          {activeConnections.length === 0 ? (
            <p className="text-xs text-slate-400">No active connections.</p>
          ) : (
            <div className="flex flex-col gap-1">
              {activeConnections.map(conn => (
                <button
                  key={conn.id}
                  onClick={() => handleSelectConnection(conn)}
                  className={`
                    flex items-center gap-2 px-3 py-2 rounded-md text-sm font-medium
                    transition-colors text-left
                    ${selectedConnection?.id === conn.id
                      ? 'bg-indigo-50 text-indigo-700'
                      : 'text-slate-600 hover:bg-slate-100'
                    }
                  `}
                >
                  <span className="w-2 h-2 rounded-full bg-green-400 shrink-0" />
                  {conn.name}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Search */}
        {nodes.length > 0 && (
          <div className="p-3 border-b">
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
              <input
                type="text"
                placeholder="Search tags..."
                value={search}
                onChange={e => setSearch(e.target.value)}
                className="w-full pl-8 pr-8 py-1.5 text-sm border rounded-md bg-slate-50
                           focus:outline-none focus:ring-2 focus:ring-indigo-300 focus:border-indigo-400"
              />
              {search && (
                <button onClick={() => setSearch('')} className="absolute right-2.5 top-1/2 -translate-y-1/2">
                  <X className="w-3.5 h-3.5 text-slate-400 hover:text-slate-600" />
                </button>
              )}
            </div>
          </div>
        )}

        {/* Tree */}
        <div className="flex-1 overflow-y-auto p-2">
          {loading && (
            <div className="flex items-center gap-2 py-4 px-2 text-sm text-slate-400">
              <Loader2 className="w-4 h-4 animate-spin" />
              Loading nodes...
            </div>
          )}
          {error && <p className="text-xs text-red-500 px-2 py-2">{error}</p>}
          {!loading && !error && nodes.length === 0 && selectedConnection && (
            <p className="text-xs text-slate-400 px-2 py-4">No nodes found.</p>
          )}
          {!loading && !selectedConnection && (
            <p className="text-xs text-slate-400 px-2 py-4">Select a connection to browse tags.</p>
          )}
          {search ? renderSearchResults() : nodes.map(node => renderNode(node, 0))}
        </div>
      </div>

      {/* Right panel — tag details */}
      <div className="flex-1 overflow-y-auto p-6">
        {selectedTag ? (
          <div className="max-w-lg">
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-2">
                <Tag className="w-5 h-5 text-indigo-500" />
                <h2 className="text-lg font-semibold text-slate-800">{selectedTag.name}</h2>
              </div>

              {/* Add/Remove watchlist button in details panel */}
              <button
                onClick={() => handleToggleWatch(selectedTag)}
                className={`
                  flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium
                  transition-colors border
                  ${isNodeWatched(selectedTag)
                    ? 'bg-indigo-50 text-indigo-600 border-indigo-200 hover:bg-red-50 hover:text-red-500 hover:border-red-200'
                    : 'bg-white text-slate-600 border-slate-200 hover:bg-indigo-50 hover:text-indigo-600 hover:border-indigo-200'
                  }
                `}
              >
                {isNodeWatched(selectedTag)
                  ? <><Check className="w-3.5 h-3.5" /> In Watchlist</>
                  : <><Plus className="w-3.5 h-3.5" /> Add to Watchlist</>
                }
              </button>
            </div>

            <div className="bg-white border rounded-xl overflow-hidden">
              {[
                { label: 'Name',          value: selectedTag.name },
                { label: 'Node ID',       value: parseNodeId(selectedTag.node_id), mono: true },
                { label: 'Node Class',    value: selectedTag.node_class },
                { label: 'Current Value', value: selectedTag.value ?? '—', mono: true, highlight: true },
              ].map(row => (
                <div
                  key={row.label}
                  className={`flex items-start px-4 py-3 border-b last:border-0 ${row.highlight ? 'bg-indigo-50' : ''}`}
                >
                  <span className="w-36 text-xs font-medium text-slate-400 uppercase tracking-wide pt-0.5 shrink-0">
                    {row.label}
                  </span>
                  <span className={`text-sm text-slate-800 break-all
                    ${row.mono ? 'font-mono' : ''}
                    ${row.highlight ? 'text-indigo-700 font-semibold text-base' : ''}
                  `}>
                    {row.value}
                  </span>
                </div>
              ))}
            </div>

            <p className="text-xs text-slate-400 mt-4 flex items-center gap-1">
              <Info className="w-3.5 h-3.5" />
              Click another tag to inspect it, or click the same tag to deselect.
            </p>
          </div>
        ) : (
          <div className="h-full flex items-center justify-center">
            <div className="text-center">
              <Tag className="w-10 h-10 mx-auto text-slate-200 mb-3" />
              <p className="text-slate-400 font-medium text-sm">No tag selected</p>
              <p className="text-slate-300 text-xs mt-1">
                Click on a Variable tag in the tree to inspect it
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}