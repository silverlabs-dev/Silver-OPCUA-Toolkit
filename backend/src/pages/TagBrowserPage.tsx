import { useEffect, useState } from 'react'
import type { Connection, NodeInfo } from '@/lib/api'
import { connectionsApi, tagsApi } from '@/lib/api'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { ChevronRight, ChevronDown, Folder, Tag } from 'lucide-react'

export default function TagBrowserPage() {
  // List of all connections to show in the selector
  const [connections, setConnections] = useState<Connection[]>([])

  // Currently selected connection id
  const [selectedId, setSelectedId] = useState<number | null>(null)

  // Root level nodes fetched from OPC UA server
  const [nodes, setNodes] = useState<NodeInfo[]>([])

  // Tracks which Object nodes are expanded — key is node_id, value is children
  const [expanded, setExpanded] = useState<Record<string, NodeInfo[]>>({})

  // Loading state for browse requests
  const [loading, setLoading] = useState(false)

  // Error message shown when browse fails
  const [error, setError] = useState('')

  // Fetch all connections on mount to populate the selector
  useEffect(() => {
    connectionsApi.list().then(res => setConnections(res.data))
  }, [])

  // Browse root nodes when a connection is selected
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

  // Toggle expand/collapse of an Object node — fetch children if not yet loaded
  const handleToggleExpand = async (node: NodeInfo) => {
    if (!selectedId) return

    // If already expanded, collapse it
    if (expanded[node.node_id]) {
      const next = { ...expanded }
      delete next[node.node_id]
      setExpanded(next)
      return
    }

    // Fetch children of this node
    try {
      const res = await tagsApi.browse(selectedId, node.node_id)
      setExpanded(prev => ({ ...prev, [node.node_id]: res.data }))
    } catch {
      setError('Failed to browse node children.')
    }
  }

  // Render a single node row with expand/collapse for Object nodes
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
          {/* Expand/collapse chevron for Object nodes */}
          {isObject ? (
            isExpanded
              ? <ChevronDown className="w-4 h-4 text-muted-foreground shrink-0" />
              : <ChevronRight className="w-4 h-4 text-muted-foreground shrink-0" />
          ) : (
            // Spacer to align Variable nodes with Object nodes
            <span className="w-4 shrink-0" />
          )}

          {/* Icon — folder for Object, tag for Variable */}
          {isObject
            ? <Folder className="w-4 h-4 text-amber-500 shrink-0" />
            : <Tag className="w-4 h-4 text-blue-500 shrink-0" />
          }

          {/* Node name */}
          <span className="font-medium">{node.name}</span>

          {/* Show current value for Variable nodes */}
          {node.value !== null && (
            <span className="ml-auto text-muted-foreground font-mono text-xs">
              {node.value}
            </span>
          )}

          {/* Badge showing node type */}
          <Badge variant="outline" className="ml-2 text-xs">
            {node.node_class}
          </Badge>
        </div>

        {/* Render children recursively if expanded */}
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

      {/* Connection selector buttons */}
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
        {connections.filter(c => c.is_active).length === 0 && (
          <p className="text-muted-foreground text-sm">
            No active connections. Go to Connections and connect first.
          </p>
        )}
      </div>

      {/* Error message */}
      {error && <p className="text-destructive text-sm mb-4">{error}</p>}

      {/* Loading state */}
      {loading && <p className="text-muted-foreground text-sm">Loading nodes...</p>}

      {/* Node tree */}
      {nodes.length > 0 && (
        <div className="border rounded-lg overflow-hidden">
          {nodes.map(node => renderNode(node))}
        </div>
      )}
    </div>
  )
}