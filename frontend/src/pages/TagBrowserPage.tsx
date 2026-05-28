// frontend/src/pages/TagBrowserPage.tsx

import { useEffect, useState, useMemo } from 'react'
import type { Connection, NodeInfo } from '@/lib/api'
import { connectionsApi, tagsApi, parseNodeId } from '@/lib/api'
import { useWatchlist } from '@/lib/watchlist'
import {
  ChevronRight, ChevronDown, Folder, Tag,
  Search, X, Loader2, Plus, Check,
} from 'lucide-react'

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

// ── Detail field row ──
function DetailRow({ label, value, mono = false, accent = false }: {
  label: string; value: string; mono?: boolean; accent?: boolean
}) {
  return (
    <div
      className="flex items-start px-4 py-2.5"
      style={{
        borderBottom: '1px solid #F1F5F9',
        background: accent ? '#F5F3FF' : undefined,
      }}
    >
      <span
        className="shrink-0 pt-0.5"
        style={{
          width: '120px',
          fontSize: '10.5px',
          fontWeight: 600,
          color: '#94A3B8',
          textTransform: 'uppercase',
          letterSpacing: '0.05em',
        }}
      >
        {label}
      </span>
      <span
        style={{
          fontSize: accent ? '18px' : '12.5px',
          color: accent ? '#5B21B6' : '#0F172A',
          fontWeight: accent ? 700 : 500,
          fontFamily: mono ? 'ui-monospace, monospace' : undefined,
          wordBreak: 'break-all',
          letterSpacing: accent ? '-0.02em' : undefined,
        }}
      >
        {value}
      </span>
    </div>
  )
}

// ── Page ──────────────────────────────────────────────

export default function TagBrowserPage() {
  const { addTag, removeTag, isWatched } = useWatchlist()

  const [connections, setConnections]       = useState<Connection[]>([])
  const [selectedConnection, setSelectedConnection] = useState<Connection | null>(null)
  const [nodes, setNodes]                   = useState<TreeNode[]>([])
  const [expanded, setExpanded]             = useState<Record<string, TreeNode[]>>({})
  const [loadingNodes, setLoadingNodes]     = useState<Record<string, boolean>>({})
  const [loading, setLoading]               = useState(false)
  const [error, setError]                   = useState('')
  const [search, setSearch]                 = useState('')
  const [selectedTag, setSelectedTag]       = useState<NodeInfo | null>(null)

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

  const isNodeWatched = (node: NodeInfo) => isWatched(parseNodeId(node.node_id))

  const allNodes     = useMemo(() => flattenTree(nodes, expanded), [nodes, expanded])
  const filteredNodes = useMemo(() => {
    if (!search) return null
    return allNodes.filter(n => n.name.toLowerCase().includes(search.toLowerCase()))
  }, [allNodes, search])

  const activeConnections = connections.filter(c => c.is_active)

  // ── Tree node renderer ──
  const renderNode = (node: TreeNode, depth: number = 0) => {
    const isObject     = node.node_class === 'Object'
    const isExp        = !!expanded[node.node_id]
    const isNodeLoading = !!loadingNodes[node.node_id]
    const isSelected   = selectedTag?.node_id === node.node_id
    const watched      = isNodeWatched(node)
    const children     = expanded[node.node_id] || []

    return (
      <div key={node.node_id}>
        <div
          className="flex items-center gap-1.5 rounded-md cursor-pointer group"
          style={{
            paddingTop: '5px',
            paddingBottom: '5px',
            paddingLeft: `${depth * 14 + 8}px`,
            paddingRight: '6px',
            fontSize: '12.5px',
            color: isSelected ? '#5B21B6' : '#475569',
            background: isSelected ? '#F5F3FF' : undefined,
            transition: 'background 0.1s',
          }}
          onMouseEnter={e => {
            if (!isSelected) (e.currentTarget as HTMLDivElement).style.background = '#F8FAFC'
          }}
          onMouseLeave={e => {
            if (!isSelected) (e.currentTarget as HTMLDivElement).style.background = ''
          }}
          onClick={() => isObject ? handleToggleExpand(node) : handleSelectTag(node)}
        >
          {/* Chevron */}
          <span className="w-3.5 shrink-0 flex items-center justify-center">
            {isObject && (
              isNodeLoading
                ? <Loader2 className="w-3 h-3 animate-spin" style={{ color: '#94A3B8' }} />
                : isExp
                  ? <ChevronDown className="w-3 h-3" style={{ color: '#94A3B8' }} />
                  : <ChevronRight className="w-3 h-3" style={{ color: '#94A3B8' }} />
            )}
          </span>

          {/* Icon */}
          {isObject
            ? <Folder className="w-3.5 h-3.5 shrink-0" style={{ color: '#F59E0B' }} />
            : <Tag    className="w-3.5 h-3.5 shrink-0" style={{ color: '#6366F1' }} />
          }

          {/* Name */}
          <span
            className="flex-1 truncate"
            style={{ fontWeight: isObject ? 600 : 400, color: isObject ? '#0F172A' : undefined }}
          >
            {node.name}
          </span>

          {/* Live value chip */}
          {node.value !== null && node.node_class === 'Variable' && (
            <span
              className="font-mono shrink-0"
              style={{
                fontSize: '11px',
                padding: '1px 5px',
                borderRadius: '4px',
                background: isSelected ? '#EDE9FE' : '#F1F5F9',
                color: isSelected ? '#6D28D9' : '#64748B',
              }}
            >
              {node.value}
            </span>
          )}

          {/* Watch toggle */}
          {node.node_class === 'Variable' && (
            <button
              onClick={e => { e.stopPropagation(); handleToggleWatch(node) }}
              title={watched ? 'Remove from watchlist' : 'Add to watchlist'}
              className="shrink-0 transition-colors"
              style={{
                padding: '2px',
                borderRadius: '4px',
                border: 'none',
                background: 'transparent',
                cursor: 'pointer',
                color: watched ? '#6366F1' : '#CBD5E1',
                opacity: watched ? 1 : 0,
              }}
              onMouseEnter={e => {
                (e.currentTarget as HTMLButtonElement).style.opacity = '1'
                if (!watched) (e.currentTarget as HTMLButtonElement).style.color = '#6366F1'
              }}
              onMouseLeave={e => {
                if (!watched) {
                  (e.currentTarget as HTMLButtonElement).style.opacity = '0'
                  ;(e.currentTarget as HTMLButtonElement).style.color = '#CBD5E1'
                }
              }}
            >
              {watched
                ? <Check className="w-3.5 h-3.5" />
                : <Plus  className="w-3.5 h-3.5" />
              }
            </button>
          )}
        </div>
        {isExp && children.map(child => renderNode(child, depth + 1))}
      </div>
    )
  }

  const renderSearchResults = () => {
    if (!filteredNodes) return null
    if (filteredNodes.length === 0) {
      return (
        <div className="py-8 text-center" style={{ fontSize: '12px', color: '#94A3B8' }}>
          No tags matching "{search}"
        </div>
      )
    }
    return filteredNodes.map(node => renderNode(node, 0))
  }

  // ── Layout ──────────────────────────────────────────

  return (
    <div className="flex" style={{ height: 'calc(100vh - 0px)', background: '#F1F5F9' }}>

      {/* ── Left: tree panel ── */}
      <div
        className="flex flex-col shrink-0"
        style={{
          width: '288px',
          background: '#fff',
          borderRight: '1px solid #E2E8F0',
        }}
      >
        {/* Connection selector */}
        <div style={{ padding: '12px', borderBottom: '1px solid #E2E8F0' }}>
          <div
            style={{
              fontSize: '9.5px', fontWeight: 600, color: '#94A3B8',
              textTransform: 'uppercase', letterSpacing: '0.08em',
              marginBottom: '8px',
            }}
          >
            Connection
          </div>

          {activeConnections.length === 0 ? (
            <p style={{ fontSize: '12px', color: '#94A3B8' }}>No active connections.</p>
          ) : (
            <div className="flex flex-col gap-1">
              {activeConnections.map(conn => {
                const isSelected = selectedConnection?.id === conn.id
                return (
                  <button
                    key={conn.id}
                    onClick={() => handleSelectConnection(conn)}
                    className="flex items-center gap-2 text-left transition-colors"
                    style={{
                      padding: '7px 10px',
                      borderRadius: '7px',
                      fontSize: '12.5px',
                      fontWeight: 500,
                      border: 'none',
                      cursor: 'pointer',
                      background: isSelected ? '#EEF2FF' : 'transparent',
                      color: isSelected ? '#6366F1' : '#475569',
                    }}
                  >
                    <span
                      style={{
                        width: '7px', height: '7px', borderRadius: '50%',
                        background: '#22C55E', flexShrink: 0, display: 'inline-block',
                      }}
                    />
                    {conn.name}
                  </button>
                )
              })}
            </div>
          )}
        </div>

        {/* Search */}
        {nodes.length > 0 && (
          <div style={{ padding: '10px 12px', borderBottom: '1px solid #E2E8F0' }}>
            <div
              className="flex items-center gap-2"
              style={{
                background: '#F8FAFC',
                border: '1px solid #E2E8F0',
                borderRadius: '7px',
                padding: '6px 10px',
                transition: 'border-color 0.15s',
              }}
            >
              <Search style={{ width: '13px', height: '13px', color: '#94A3B8', flexShrink: 0 }} />
              <input
                type="text"
                placeholder="Search tags..."
                value={search}
                onChange={e => setSearch(e.target.value)}
                style={{
                  flex: 1,
                  border: 'none',
                  outline: 'none',
                  background: 'transparent',
                  fontSize: '12.5px',
                  color: '#0F172A',
                  minWidth: 0,
                }}
              />
              {search && (
                <button onClick={() => setSearch('')} style={{ border: 'none', background: 'none', cursor: 'pointer', padding: 0 }}>
                  <X style={{ width: '13px', height: '13px', color: '#94A3B8' }} />
                </button>
              )}
            </div>
          </div>
        )}

        {/* Tree */}
        <div className="flex-1 overflow-y-auto" style={{ padding: '6px 8px' }}>
          {loading && (
            <div className="flex items-center gap-2 py-4 px-1" style={{ fontSize: '12px', color: '#94A3B8' }}>
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
              Loading nodes...
            </div>
          )}
          {error && (
            <p style={{ fontSize: '12px', color: '#DC2626', padding: '8px 4px' }}>{error}</p>
          )}
          {!loading && !error && nodes.length === 0 && selectedConnection && (
            <p style={{ fontSize: '12px', color: '#94A3B8', padding: '12px 4px' }}>
              No nodes found.
            </p>
          )}
          {!loading && !selectedConnection && (
            <p style={{ fontSize: '12px', color: '#94A3B8', padding: '12px 4px' }}>
              Select a connection to browse tags.
            </p>
          )}
          {search ? renderSearchResults() : nodes.map(node => renderNode(node, 0))}
        </div>
      </div>

      {/* ── Right: details panel ── */}
      <div className="flex-1 overflow-y-auto" style={{ padding: '24px' }}>
        {selectedTag ? (
          <div style={{ maxWidth: '520px' }}>

            {/* Header */}
            <div className="flex items-center justify-between mb-5">
              <div className="flex items-center gap-2.5">
                <div
                  style={{
                    width: '32px', height: '32px', borderRadius: '8px',
                    background: '#EEF2FF', border: '1px solid #C7D2FE',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                  }}
                >
                  <Tag style={{ width: '15px', height: '15px', color: '#6366F1' }} />
                </div>
                <div>
                  <h2 style={{ fontSize: '16px', fontWeight: 600, color: '#0F172A', letterSpacing: '-0.01em' }}>
                    {selectedTag.name}
                  </h2>
                  <p style={{ fontSize: '11px', color: '#94A3B8', marginTop: '1px' }}>
                    {selectedTag.node_class}
                  </p>
                </div>
              </div>

              {/* Watch button */}
              <button
                onClick={() => handleToggleWatch(selectedTag)}
                className="flex items-center gap-1.5 transition-colors"
                style={{
                  padding: '7px 13px',
                  borderRadius: '8px',
                  fontSize: '12.5px',
                  fontWeight: 500,
                  cursor: 'pointer',
                  border: '1px solid',
                  ...(isNodeWatched(selectedTag)
                    ? { background: '#EEF2FF', color: '#6366F1', borderColor: '#C7D2FE' }
                    : { background: '#fff', color: '#475569', borderColor: '#E2E8F0' }
                  ),
                }}
              >
                {isNodeWatched(selectedTag)
                  ? <><Check className="w-3.5 h-3.5" /> In Watchlist</>
                  : <><Plus  className="w-3.5 h-3.5" /> Add to Watchlist</>
                }
              </button>
            </div>

            {/* Details card */}
            <div className="card overflow-hidden">
              <div style={{ borderBottom: '1px solid #E2E8F0', padding: '10px 16px', background: '#F8FAFC' }}>
                <span style={{ fontSize: '10.5px', fontWeight: 600, color: '#94A3B8', textTransform: 'uppercase', letterSpacing: '0.07em' }}>
                  Tag Details
                </span>
              </div>
              <DetailRow label="Name"          value={selectedTag.name} />
              <DetailRow label="Node ID"       value={parseNodeId(selectedTag.node_id)} mono />
              <DetailRow label="Node Class"    value={selectedTag.node_class} />
              <DetailRow label="Current Value" value={String(selectedTag.value ?? '—')} mono accent />
            </div>

            <p style={{ fontSize: '11.5px', color: '#94A3B8', marginTop: '12px' }}>
              Click another tag to inspect it, or click the same tag to deselect.
            </p>
          </div>
        ) : (
          <div className="h-full flex items-center justify-center">
            <div className="text-center">
              <div
                style={{
                  width: '48px', height: '48px', borderRadius: '12px',
                  background: '#F8FAFC', border: '1px solid #E2E8F0',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  margin: '0 auto 12px',
                }}
              >
                <Tag style={{ width: '20px', height: '20px', color: '#CBD5E1' }} />
              </div>
              <p style={{ fontSize: '13.5px', fontWeight: 600, color: '#475569' }}>
                No tag selected
              </p>
              <p style={{ fontSize: '12px', color: '#94A3B8', marginTop: '4px' }}>
                Click on a Variable tag in the tree to inspect it
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
