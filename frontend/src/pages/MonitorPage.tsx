import { useEffect, useState, useRef } from 'react'
import type { Connection, NodeInfo } from '@/lib/api'
import { connectionsApi, tagsApi } from '@/lib/api'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Activity } from 'lucide-react'

// Represents a single live tag reading received from WebSocket
interface TagReading {
  node_id: string
  value: string | null
  error: string | null
}

// Represents a tag selected by the user for monitoring
interface MonitoredTag {
  node_id: string
  name: string
}

export default function MonitorPage() {
  // All connections fetched from the database
  const [connections, setConnections] = useState<Connection[]>([])

  // Currently selected connection id
  const [selectedId, setSelectedId] = useState<number | null>(null)

  // Tags available inside SimulatedDevice (fetched from Tag Browser)
  const [availableTags, setAvailableTags] = useState<NodeInfo[]>([])

  // Tags the user has selected to monitor
  const [monitoredTags, setMonitoredTags] = useState<MonitoredTag[]>([])

  // Latest readings received from the WebSocket
  const [readings, setReadings] = useState<Record<string, TagReading>>({})

  // Whether the WebSocket is currently connected and streaming
  const [isStreaming, setIsStreaming] = useState(false)

  // WebSocket instance stored in a ref so it persists across renders
  const wsRef = useRef<WebSocket | null>(null)

  // Fetch all connections on mount
  useEffect(() => {
    connectionsApi.list().then(res => setConnections(res.data))
  }, [])

  // Cleanup WebSocket when component unmounts
  useEffect(() => {
    return () => {
      wsRef.current?.close()
    }
  }, [])

  // When user selects a connection, fetch its available tags
const handleSelectConnection = async (id: number) => {
    // Stop any existing stream before switching connection
    stopStream()
    setSelectedId(id)
    setMonitoredTags([])
    setReadings({})

    try {
      // Browse SimulatedDevice node to get available tags
      const res = await tagsApi.browse(id, 'ns=2;i=1')
      // Only show Variable nodes and convert node_id to short format
      const vars = res.data
        .filter(n => n.node_class === 'Variable')
        .map(n => {
          // Convert "NodeId(Identifier=2, NamespaceIndex=2, ...)" to "ns=2;i=2"
          const match = n.node_id.match(/Identifier=(\w+).*NamespaceIndex=(\d+)/)
          const short_id = match ? `ns=${match[2]};i=${match[1]}` : n.node_id
          return { ...n, node_id: short_id }
        })
      setAvailableTags(vars)
    } catch {
      setAvailableTags([])
    }
  }

  // Toggle a tag in/out of the monitored list
  const handleToggleTag = (node: NodeInfo) => {
    setMonitoredTags(prev => {
      const exists = prev.find(t => t.node_id === node.node_id)
      if (exists) {
        // Remove from monitored list
        return prev.filter(t => t.node_id !== node.node_id)
      }
      // Add to monitored list
      return [...prev, { node_id: node.node_id, name: node.name }]
    })
  }

  // Start WebSocket stream for the selected tags
  const startStream = () => {
    if (!selectedId || monitoredTags.length === 0) return

    // Build WebSocket URL — note: ws:// not http://
    const ws = new WebSocket(`ws://localhost:8000/ws/${selectedId}/monitor`)
    wsRef.current = ws

    ws.onopen = () => {
      // Send the list of node_ids we want to monitor
      ws.send(JSON.stringify({
        node_ids: monitoredTags.map(t => t.node_id)
      }))
      setIsStreaming(true)
    }

    ws.onmessage = (event) => {
      const data = JSON.parse(event.data)
      if (data.readings) {
        // Convert array of readings into a map keyed by node_id for easy lookup
        const map: Record<string, TagReading> = {}
        data.readings.forEach((r: TagReading) => {
          map[r.node_id] = r
        })
        setReadings(map)
      }
    }

    ws.onclose = () => setIsStreaming(false)
    ws.onerror = () => setIsStreaming(false)
  }

  // Stop the WebSocket stream
  const stopStream = () => {
    wsRef.current?.close()
    wsRef.current = null
    setIsStreaming(false)
  }

  return (
    <div className="p-8">
      <div className="mb-6">
        <h1 className="text-2xl font-semibold">Live Monitor</h1>
        <p className="text-muted-foreground text-sm mt-1">
          Select tags and stream their values in real time
        </p>
      </div>

      {/* Connection selector — only shows active connections */}
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

      {/* Tag selector — shown after a connection is selected */}
      {availableTags.length > 0 && (
        <div className="mb-6">
          <p className="text-sm font-medium mb-2">Select tags to monitor:</p>
          <div className="flex gap-2 flex-wrap">
            {availableTags.map(tag => {
              const isSelected = monitoredTags.some(t => t.node_id === tag.node_id)
              return (
                <Button
                  key={tag.node_id}
                  variant={isSelected ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => handleToggleTag(tag)}
                >
                  {tag.name}
                </Button>
              )
            })}
          </div>
        </div>
      )}

      {/* Start/Stop stream button */}
      {monitoredTags.length > 0 && (
        <div className="mb-6">
          {isStreaming ? (
            <Button variant="destructive" onClick={stopStream}>
              Stop Stream
            </Button>
          ) : (
            <Button onClick={startStream}>
              <Activity className="w-4 h-4 mr-2" />
              Start Stream
            </Button>
          )}
        </div>
      )}

      {/* Live readings display */}
      {monitoredTags.length > 0 && (
        <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
          {monitoredTags.map(tag => {
            const reading = readings[tag.node_id]
            return (
              <div
                key={tag.node_id}
                className="border rounded-lg p-4"
              >
                <p className="text-sm text-muted-foreground mb-1">{tag.name}</p>
                <p className="text-2xl font-mono font-semibold">
                  {reading?.value ?? '—'}
                </p>
                {reading?.error && (
                  <Badge variant="destructive" className="mt-2 text-xs">
                    Error
                  </Badge>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}