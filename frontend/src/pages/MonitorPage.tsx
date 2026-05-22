// frontend/src/pages/MonitorPage.tsx

import { useEffect, useState, useRef } from 'react'
import type { Connection, NodeInfo } from '@/lib/api'
import { connectionsApi, tagsApi } from '@/lib/api'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Activity, CheckCircle2, Circle } from 'lucide-react'
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid,
  Tooltip, Legend, ResponsiveContainer
} from 'recharts'

interface TagReading {
  node_id: string
  value: string | null
  error: string | null
}

interface MonitoredTag {
  node_id: string
  name: string
}

interface ChartDataPoint {
  time: string
  [key: string]: string | number
}

const CHART_COLORS = ['#3b82f6', '#ef4444', '#10b981', '#f59e0b']

export default function MonitorPage() {
  const [connections, setConnections] = useState<Connection[]>([])
  const [selectedId, setSelectedId] = useState<number | null>(null)
  const [availableTags, setAvailableTags] = useState<NodeInfo[]>([])
  const [monitoredTags, setMonitoredTags] = useState<MonitoredTag[]>([])
  const [readings, setReadings] = useState<Record<string, TagReading>>({})
  const [chartData, setChartData] = useState<ChartDataPoint[]>([])
  const [isStreaming, setIsStreaming] = useState(false)
  const wsRef = useRef<WebSocket | null>(null)
  const counterRef = useRef(0)

  useEffect(() => {
    connectionsApi.list().then(res => setConnections(res.data))
  }, [])

  useEffect(() => {
    return () => { wsRef.current?.close() }
  }, [])

  const handleSelectConnection = async (id: number) => {
    stopStream()
    setSelectedId(id)
    setMonitoredTags([])
    setReadings({})
    setChartData([])
    try {
      const res = await tagsApi.browse(id, 'ns=2;i=1')
      const vars = res.data
        .filter(n => n.node_class === 'Variable')
        .map(n => {
          const match = n.node_id.match(/Identifier=(\w+).*NamespaceIndex=(\d+)/)
          const short_id = match ? `ns=${match[2]};i=${match[1]}` : n.node_id
          return { ...n, node_id: short_id }
        })
      setAvailableTags(vars)
    } catch {
      setAvailableTags([])
    }
  }

  const handleToggleTag = (node: NodeInfo) => {
    setMonitoredTags(prev => {
      const exists = prev.find(t => t.node_id === node.node_id)
      if (exists) return prev.filter(t => t.node_id !== node.node_id)
      return [...prev, { node_id: node.node_id, name: node.name }]
    })
  }

  const startStream = () => {
    if (!selectedId || monitoredTags.length === 0) return
    setChartData([])
    counterRef.current = 0

    const ws = new WebSocket(`ws://localhost:8000/ws/${selectedId}/monitor`)
    wsRef.current = ws

    ws.onopen = () => {
      ws.send(JSON.stringify({ node_ids: monitoredTags.map(t => t.node_id) }))
      setIsStreaming(true)
    }

    ws.onmessage = (event) => {
      const data = JSON.parse(event.data)
      if (data.type === 'ping') return // Ignore ping messages
      if (data.readings) {
        const readingsMap: Record<string, TagReading> = {}
        data.readings.forEach((r: TagReading) => { readingsMap[r.node_id] = r })
        setReadings(readingsMap)

        const dataPoint: ChartDataPoint = { time: `${counterRef.current}s` }
        monitoredTags.forEach(tag => {
          const reading = readingsMap[tag.node_id]
          if (reading?.value && !reading.error) {
            const numValue = parseFloat(reading.value)
            dataPoint[tag.name] = isNaN(numValue) ? reading.value : numValue
          }
        })
        setChartData(prev => [...prev, dataPoint].slice(-30))
        counterRef.current += 1
      }
    }

    ws.onclose = () => setIsStreaming(false)
    ws.onerror = () => setIsStreaming(false)
  }

  const stopStream = () => {
    wsRef.current?.close()
    wsRef.current = null
    setIsStreaming(false)
  }

  const activeConnections = connections.filter(c => c.is_active)

  return (
    <div className="p-8 max-w-6xl mx-auto">
      <div className="mb-8">
        <h1 className="text-2xl font-semibold tracking-tight">Live Monitor</h1>
        <p className="text-muted-foreground text-sm mt-1">
          Select tags and stream their values in real time with live charts
        </p>
      </div>

      {/* Connection selector */}
      {activeConnections.length === 0 ? (
        <div className="border-2 border-dashed rounded-xl p-8 text-center mb-6">
          <p className="text-muted-foreground text-sm">
            No active connections. Go to <span className="font-medium">Connections</span> and connect first.
          </p>
        </div>
      ) : (
        <div className="mb-6">
          <p className="text-sm font-medium mb-2 text-muted-foreground">Select connection:</p>
          <div className="flex gap-2 flex-wrap">
            {activeConnections.map(conn => (
              <button
                key={conn.id}
                onClick={() => handleSelectConnection(conn.id)}
                className={`
                  flex items-center gap-2 px-4 py-2 rounded-lg border text-sm font-medium
                  transition-colors duration-150
                  ${selectedId === conn.id
                    ? 'bg-primary text-primary-foreground border-primary'
                    : 'bg-background text-foreground border-border hover:bg-muted'
                  }
                `}
              >
                <span className={`w-2 h-2 rounded-full ${selectedId === conn.id ? 'bg-primary-foreground' : 'bg-green-500'}`} />
                {conn.name}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Tag selector */}
      {availableTags.length > 0 && (
        <div className="mb-6">
          <p className="text-sm font-medium mb-2 text-muted-foreground">Select tags to monitor:</p>
          <div className="flex gap-2 flex-wrap">
            {availableTags.map(tag => {
              const isSelected = monitoredTags.some(t => t.node_id === tag.node_id)
              return (
                <button
                  key={tag.node_id}
                  onClick={() => handleToggleTag(tag)}
                  className={`
                    flex items-center gap-2 px-3 py-1.5 rounded-lg border text-sm font-medium
                    transition-all duration-150
                    ${isSelected
                      ? 'bg-primary text-primary-foreground border-primary shadow-sm'
                      : 'bg-background text-muted-foreground border-border hover:text-foreground hover:bg-muted'
                    }
                  `}
                >
                  {isSelected
                    ? <CheckCircle2 className="w-3.5 h-3.5" />
                    : <Circle className="w-3.5 h-3.5" />
                  }
                  {tag.name}
                </button>
              )
            })}
          </div>
        </div>
      )}

      {/* Start/Stop button */}
      {monitoredTags.length > 0 && (
        <div className="mb-6">
          {isStreaming ? (
            <Button variant="destructive" size="sm" onClick={stopStream}>
              Stop Stream
            </Button>
          ) : (
            <Button size="sm" onClick={startStream}>
              <Activity className="w-4 h-4 mr-2" />
              Start Stream
            </Button>
          )}
        </div>
      )}

      {/* Live data grid */}
      {monitoredTags.length > 0 && isStreaming && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Value cards */}
          <div className="space-y-3">
            {monitoredTags.map((tag, index) => {
              const reading = readings[tag.node_id]
              const color = CHART_COLORS[index % CHART_COLORS.length]
              return (
                <div
                  key={tag.node_id}
                  className="border rounded-xl p-4 bg-background"
                  style={{ borderLeftWidth: 4, borderLeftColor: color }}
                >
                  <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-1">
                    {tag.name}
                  </p>
                  <p className="text-3xl font-mono font-semibold tabular-nums">
                    {reading?.value ?? '—'}
                  </p>
                  {reading?.error && (
                    <Badge variant="destructive" className="mt-2 text-xs">
                      Error: {reading.error}
                    </Badge>
                  )}
                </div>
              )
            })}
          </div>

          {/* Chart */}
          <div className="lg:col-span-2">
            <div className="border rounded-xl p-4 bg-background">
              <p className="text-sm font-medium mb-4">Trend (last 30s)</p>
              <ResponsiveContainer width="100%" height={300}>
                <LineChart data={chartData} margin={{ top: 5, right: 30, left: 0, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                  <XAxis dataKey="time" stroke="#6b7280" style={{ fontSize: '11px' }} />
                  <YAxis stroke="#6b7280" style={{ fontSize: '11px' }} />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: '#fff',
                      border: '1px solid #e5e7eb',
                      borderRadius: '8px',
                      fontSize: '12px'
                    }}
                  />
                  <Legend />
                  {monitoredTags.map((tag, index) => (
                    <Line
                      key={tag.node_id}
                      type="monotone"
                      dataKey={tag.name}
                      stroke={CHART_COLORS[index % CHART_COLORS.length]}
                      dot={false}
                      isAnimationActive={false}
                      strokeWidth={2}
                    />
                  ))}
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>
      )}

      {/* Empty state */}
      {monitoredTags.length > 0 && !isStreaming && (
        <div className="border-2 border-dashed rounded-xl p-12 text-center">
          <Activity className="w-10 h-10 mx-auto text-muted-foreground mb-3 opacity-40" />
          <p className="text-muted-foreground font-medium">Ready to stream</p>
          <p className="text-muted-foreground text-sm mt-1">
            {monitoredTags.length} tag{monitoredTags.length > 1 ? 's' : ''} selected — click "Start Stream" to begin
          </p>
        </div>
      )}
    </div>
  )
}