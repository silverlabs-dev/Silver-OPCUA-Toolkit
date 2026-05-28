// frontend/src/lib/watchlist.tsx

import { createContext, useContext, useState, useRef, useCallback, useEffect, type ReactNode } from 'react'
import { WS_BASE } from '@/lib/api'

export interface WatchedTag {
  node_id: string
  name: string
  connection_id: number
  connection_name: string
}

export interface TagReading {
  node_id: string
  value: string | null
  error: string | null
}

export interface ChartDataPoint {
  time: string
  elapsed: number
  [key: string]: string | number
}

export interface StreamSettings {
  timeWindow: number
  updateRate: number
}

interface WatchlistContextType {
  watchlist: WatchedTag[]
  addTag: (tag: WatchedTag) => void
  removeTag: (node_id: string) => void
  removeTagsByConnection: (connection_id: number) => void
  clearWatchlist: () => void
  isWatched: (node_id: string) => boolean
  readings: Record<string, TagReading>
  chartData: ChartDataPoint[]
  fullBuffer: ChartDataPoint[]
  isStreaming: boolean
  isPaused: boolean
  isWsConnected: boolean
  settings: StreamSettings
  startStream: () => void
  stopStream: () => void
  togglePause: () => void
  updateSettings: (s: Partial<StreamSettings>) => void
}

const WatchlistContext = createContext<WatchlistContextType | null>(null)

const STORAGE_KEY  = 'silver_opcua_watchlist'
const SETTINGS_KEY = 'silver_opcua_stream_settings'

function toChartValue(raw: string): number | null {
  const lower = raw.toLowerCase().trim()
  if (lower === 'true')  return 1
  if (lower === 'false') return 0
  const n = Number(raw)
  if (!isNaN(n)) return n
  return null
}

function loadWatchlist(): WatchedTag[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return []
    return JSON.parse(raw) as WatchedTag[]
  } catch { return [] }
}

function saveWatchlist(watchlist: WatchedTag[]): void {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(watchlist)) } catch { /* ignore */ }
}

function loadSettings(): StreamSettings {
  try {
    const raw = localStorage.getItem(SETTINGS_KEY)
    if (!raw) return { timeWindow: 30, updateRate: 1000 }
    return JSON.parse(raw) as StreamSettings
  } catch { return { timeWindow: 30, updateRate: 1000 } }
}

function saveSettings(settings: StreamSettings): void {
  try { localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings)) } catch { /* ignore */ }
}

export function WatchlistProvider({ children }: { children: ReactNode }) {
  const [watchlist, setWatchlist]    = useState<WatchedTag[]>(loadWatchlist)
  const [readings, setReadings]      = useState<Record<string, TagReading>>({})
  const [chartData, setChartData]    = useState<ChartDataPoint[]>([])
  const [fullBuffer, setFullBuffer]  = useState<ChartDataPoint[]>([])
  const [isStreaming, setIsStreaming]       = useState(false)
  const [isPaused, setIsPaused]            = useState(false)
  const [isWsConnected, setIsWsConnected]  = useState(false)
  const [settings, setSettings]      = useState<StreamSettings>(loadSettings)

  const wsRef          = useRef<WebSocket | null>(null)
  const startTimeRef   = useRef<number>(0)
  const watchlistRef   = useRef(watchlist)
  const settingsRef    = useRef(settings)
  const isPausedRef    = useRef(isPaused)
  const isStreamingRef = useRef(isStreaming)

  useEffect(() => { watchlistRef.current   = watchlist },   [watchlist])
  useEffect(() => { settingsRef.current    = settings },    [settings])
  useEffect(() => { isPausedRef.current    = isPaused },    [isPaused])
  useEffect(() => { isStreamingRef.current = isStreaming }, [isStreaming])

  useEffect(() => { saveWatchlist(watchlist) }, [watchlist])
  useEffect(() => { saveSettings(settings) },  [settings])

  const stopStream = useCallback(() => {
    if (wsRef.current) {
      wsRef.current.onclose = null
      wsRef.current.close()
      wsRef.current = null
    }
    setIsStreaming(false)
    setIsPaused(false)
    setIsWsConnected(false)
  }, [])

  const startStream = useCallback(() => {
    const wl = watchlistRef.current
    if (wl.length === 0) return

    // Stop existing stream before restarting
    if (wsRef.current) {
      wsRef.current.onclose = null
      wsRef.current.close()
      wsRef.current = null
    }

    const connectionId = wl[0].connection_id
    // Preserve existing buffer when restarting due to watchlist change
    const isRestart = isStreamingRef.current
    if (!isRestart) {
      setChartData([])
      setFullBuffer([])
      setReadings({})
      startTimeRef.current = Date.now()
    }

    const ws = new WebSocket(`${WS_BASE}/ws/${connectionId}/monitor`)
    wsRef.current = ws

    ws.onopen = () => {
      ws.send(JSON.stringify({
        node_ids: wl.map(t => t.node_id),
        update_rate_ms: settingsRef.current.updateRate,
      }))
      setIsStreaming(true)
      setIsWsConnected(true)
    }

    ws.onmessage = (event) => {
      const data = JSON.parse(event.data) as { type?: string; readings?: TagReading[] }
      if (data.type === 'ping') return
      if (!data.readings) return

      // While paused: freeze chart and readings, do nothing
      if (isPausedRef.current) return

      const elapsedSec = (Date.now() - startTimeRef.current) / 1000
      const label = elapsedSec < 60
        ? `${elapsedSec.toFixed(1)}s`
        : `${(elapsedSec / 60).toFixed(1)}m`

      const readingsMap: Record<string, TagReading> = {}
      data.readings.forEach((r: TagReading) => { readingsMap[r.node_id] = r })
      setReadings(readingsMap)

      const dataPoint: ChartDataPoint = { time: label, elapsed: elapsedSec }
      watchlistRef.current.forEach(tag => {
        const reading = readingsMap[tag.node_id]
        if (!reading?.value || reading.error) return
        const val = toChartValue(reading.value)
        if (val !== null) dataPoint[tag.name] = val
      })

      setChartData(prev => {
        const updated = [...prev, dataPoint]
        const maxPoints = Math.ceil(
          (settingsRef.current.timeWindow * 1000) / settingsRef.current.updateRate
        )
        return updated.slice(-maxPoints)
      })

      setFullBuffer(prev => {
        const updated = [...prev, dataPoint]
        const maxBuffer = Math.ceil((600 * 1000) / settingsRef.current.updateRate)
        return updated.slice(-maxBuffer)
      })
    }

    ws.onclose = () => { setIsStreaming(false); setIsPaused(false); setIsWsConnected(false) }
    ws.onerror = () => { setIsStreaming(false); setIsPaused(false); setIsWsConnected(false) }
  }, [])

  // Auto-restart stream when watchlist changes while streaming
  // This ensures newly added tags are included in the stream
  const prevWatchlistRef = useRef(watchlist)
  useEffect(() => {
    const prev = prevWatchlistRef.current
    prevWatchlistRef.current = watchlist

    if (!isStreamingRef.current) return
    if (watchlist.length === 0) { stopStream(); return }

    // Check if watchlist actually changed
    const changed = watchlist.length !== prev.length ||
      watchlist.some((t, i) => t.node_id !== prev[i]?.node_id)

    if (changed) startStream()
  }, [watchlist, startStream, stopStream])

  // Cleanup on unmount
  useEffect(() => {
    return () => { wsRef.current?.close() }
  }, [])

  const togglePause = useCallback(() => setIsPaused(prev => !prev), [])

  const updateSettings = useCallback((s: Partial<StreamSettings>) => {
    setSettings(prev => ({ ...prev, ...s }))
  }, [])

  const addTag = (tag: WatchedTag) => {
    setWatchlist(prev => {
      if (prev.find(t => t.node_id === tag.node_id)) return prev
      return [...prev, tag]
    })
  }

  const removeTag = (node_id: string) => {
    setWatchlist(prev => prev.filter(t => t.node_id !== node_id))
  }

  const removeTagsByConnection = useCallback((connection_id: number) => {
    if (isStreamingRef.current) {
      const activeId = watchlistRef.current[0]?.connection_id
      if (activeId === connection_id) stopStream()
    }
    setWatchlist(prev => prev.filter(t => t.connection_id !== connection_id))
  }, [stopStream])

  const clearWatchlist = () => {
    stopStream()
    setWatchlist([])
    setChartData([])
    setFullBuffer([])
    setReadings({})
  }

  const isWatched = (node_id: string) => watchlist.some(t => t.node_id === node_id)

  return (
    <WatchlistContext.Provider value={{
      watchlist, addTag, removeTag, removeTagsByConnection, clearWatchlist, isWatched,
      readings, chartData, fullBuffer, isStreaming, isPaused, isWsConnected, settings,
      startStream, stopStream, togglePause, updateSettings,
    }}>
      {children}
    </WatchlistContext.Provider>
  )
}

// eslint-disable-next-line react-refresh/only-export-components
export function useWatchlist() {
  const ctx = useContext(WatchlistContext)
  if (!ctx) throw new Error('useWatchlist must be used inside WatchlistProvider')
  return ctx
}