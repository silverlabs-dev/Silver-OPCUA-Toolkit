// frontend/src/lib/useSystemStatus.ts
// Polls backend health endpoint and derives runtime status indicators.

import { useEffect, useRef, useState } from 'react'
import { connectionsApi } from '@/lib/api'

export type StatusLevel = 'green' | 'yellow' | 'red' | 'gray'

export interface StatusItem {
  label: string
  level: StatusLevel
  detail?: string
}

export interface SystemStatus {
  items: StatusItem[]
  overall: StatusLevel
}

const POLL_INTERVAL_MS = 5000

// Derive worst-case overall level from all items
function worstLevel(items: StatusItem[]): StatusLevel {
  if (items.some(i => i.level === 'red'))    return 'red'
  if (items.some(i => i.level === 'yellow')) return 'yellow'
  if (items.some(i => i.level === 'green'))  return 'green'
  return 'gray'
}

interface UseSystemStatusOptions {
  isStreaming:    boolean
  isPaused:       boolean
  watchlistCount: number
  isWsConnected:  boolean
}

export function useSystemStatus({
  isStreaming,
  isPaused,
  watchlistCount,
  isWsConnected,
}: UseSystemStatusOptions): SystemStatus {
  const [backendOnline, setBackendOnline]         = useState<boolean | null>(null)
  const [connectedCount, setConnectedCount]       = useState<number>(0)
  const [totalConnections, setTotalConnections]   = useState<number>(0)
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const poll = async () => {
    try {
      const res = await connectionsApi.list()
      setBackendOnline(true)
      const active = res.data.filter(c => c.is_active).length
      setConnectedCount(active)
      setTotalConnections(res.data.length)
    } catch {
      setBackendOnline(false)
      setConnectedCount(0)
    }
  }

  useEffect(() => {
    poll()
    timerRef.current = setInterval(poll, POLL_INTERVAL_MS)
    return () => {
      if (timerRef.current) clearInterval(timerRef.current)
    }
  }, [])

  // ── Derive status items ──

  const backendItem: StatusItem = backendOnline === null
    ? { label: 'Backend API',    level: 'gray',   detail: 'Checking...' }
    : backendOnline
      ? { label: 'Backend API',  level: 'green',  detail: 'Online' }
      : { label: 'Backend API',  level: 'red',    detail: 'Offline' }

  const wsItem: StatusItem = !isStreaming
    ? { label: 'WebSocket',      level: 'gray',   detail: 'Idle' }
    : isWsConnected
      ? { label: 'WebSocket',    level: 'green',  detail: 'Connected' }
      : { label: 'WebSocket',    level: 'red',    detail: 'Disconnected' }

  const opcuaItem: StatusItem = connectedCount > 0
    ? { label: 'OPC UA',         level: 'green',  detail: `${connectedCount}/${totalConnections} connected` }
    : totalConnections > 0
      ? { label: 'OPC UA',       level: 'red',    detail: 'No active connections' }
      : { label: 'OPC UA',       level: 'gray',   detail: 'No connections' }

  const streamItem: StatusItem = !isStreaming
    ? { label: 'Stream',         level: 'gray',   detail: 'Stopped' }
    : isPaused
      ? { label: 'Stream',       level: 'yellow', detail: 'Paused' }
      : { label: 'Stream',       level: 'green',  detail: 'Running' }

  const watchlistItem: StatusItem = watchlistCount === 0
    ? { label: 'Watchlist',      level: 'gray',   detail: 'Empty' }
    : { label: 'Watchlist',      level: 'green',  detail: `${watchlistCount} active tag${watchlistCount > 1 ? 's' : ''}` }

  const items = [backendItem, wsItem, opcuaItem, streamItem, watchlistItem]

  return { items, overall: worstLevel(items) }
}
