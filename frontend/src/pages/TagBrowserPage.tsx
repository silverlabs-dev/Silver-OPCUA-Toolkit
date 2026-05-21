import { useEffect, useState } from 'react'
import type { Connection, NodeInfo } from '@/lib/api'
import { connectionsApi, tagsApi } from '@/lib/api'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { ChevronRight, ChevronDown, Folder, Tag } from 'lucide-react'

export default function TagBrowserPage() {
  // List of all connections to populate the selector
  const [connections, setConnections] = useState<Connection[]>([])

  // Currently selected active connection id
  const [selectedId, setSelectedId] = useState<number | null>(null)

  // Root level nodes fetched from the OPC UA server
  const [nodes, setNodes] = useState<NodeInfo[]>([])

  // Tracks expanded Object nodes — key is node_id, value is its children
  const [expanded, setExpanded] = useState<Record<string, NodeInfo[]>>({})

  // Loading state while fetching nodes
  const [loading, setLoading] = useState(false)

  // Error message when browse fails
  const [error, setError] = useState('')

  // Fetch all connections on mount
  useEffect(() => {
    connectionsApi.list().then(res => setConnections(res.data))
  }, [])

  // Browse root nodes when user selects a connection
  const handleSelectConnection = async (id: number) => {
    setSelectedId(id)
    setNodes([])
    setExpanded({})
    setError('')
    setLoading(true)
    try {
      const res = await tagsApi.browse(id)
      setNodes(res.data)
    } catch {
      setError('Failed to browse tags. Is the connection active?')
    } finally {
      setLoading(false)
    }
  }

  // Toggle expand/collapse for Object (folder) nodes
  const handleToggleExpand = async (node: NodeInfo) => {
    if (!selectedId) return

    // If already expanded, collapse it by removing from expanded map
    if (expanded[node.node_id]) {
      const next = { ...expanded }
      delete next[node.node_id]
      setExpanded(next)
      return
    }

    // Fetch and store children of this node
    try {
      const res = await tagsApi.browse(selectedId, node.node_id)
      setExpanded(prev => ({ ...prev, [node.node_id]: res.data }))
    } catch {
      setError('Failed to browse node children.')
    }
  }

  // Render a single node row — recursive for nested folders
  const renderNode = (node: NodeInfo, depth: number = 0) => {
    const isObject = node.node_class === 'Object'
    const isExpanded = !!expanded[node.node_id]
    const children = expanded[node.node_id] || []

    return (
      <div key={node.node_id}>
        <div
          className="flex items-center gap-2 py-1.5 px-2 rounded hover:bg-muted cursor-pointer text-sm"
          style={{ paddingLeft: `${depth * 20 + 8}px` }}
          onClick={() => isObject && handleToggleExpand(node)}
        >
          {/* Chevron icon for expandable Object nodes */}
          {isObject ? (
            isExpanded
              ? <ChevronDown className="w-4 h-4 text-muted-foreground shrink-0" />
              : <ChevronRight className="w-4 h-4 text-muted-foreground shrink-0" />
          ) : (
            <span className="w-4 shrink-0" />
          )}

          {/* Folder icon for Object, tag icon for Variable */}
          {isObject
            ? <Folder className="w-4 h-4 text-amber-500 shrink-0" />
            : <Tag className="w-4 h-4 text-blue-500 shrink-0" />
          }

          {/* Node display name */}
          <span className="font-medium">{node.name}</span>

          {/* Current value shown only for Variable nodes */}
          {node.value !== null && (
            <span className="ml-auto text-muted-foreground font-mono text-xs">
              {node.value}
            </span>
          )}

          {/* Badge showing node class */}
          <Badge variant="outline" className="ml-2 text-xs">
            {node.node_class}
          </Badge>
        </div>

        {/* Recursively render children if this node is expanded */}
        {isExpanded && children.map(child => renderNode(child, depth + 1))}
      </div>
    )
  }

  return (
    <div className="p-8">
      <div className="mb-6">
        <h1 className="text-2xl font-semibold">Tag Browser</h1>
        <p className="text-muted-foreground text-sm mt-1">
          Browse OPC UA node tree and explore available tags
        </p>
      </div>

      {/* Show only active connections as selectable buttons */}
      <div className="flex gap-2 mb-6 flex-wrap">
        {connections
          .filter(c => c.is_active)
          .map(conn => (
            <Button
              key={conn.id}
              variant={selectedId === conn.id ? 'default' : 'outline'}
              size="sm"
              onClick={() => handleSelectConnection(conn.id)}
            >
              {conn.name}
            </Button>
          ))}

        {/* Message when no active connections exist */}
        {connections.filter(c => c.is_active).length === 0 && (
          <p className="text-muted-foreground text-sm">
            No active connections. Go to Connections and connect first.
          </p>
        )}
      </div>

      {/* Error message */}
      {error && <p className="text-destructive text-sm mb-4">{error}</p>}

      {/* Loading indicator */}
      {loading && <p className="text-muted-foreground text-sm">Loading nodes...</p>}

      {/* Node tree rendered inside a bordered container */}
      {nodes.length > 0 && (
        <div className="border rounded-lg overflow-hidden">
          {nodes.map(node => renderNode(node))}
        </div>
      )}
    </div>
  )
}