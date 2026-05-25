// frontend/src/pages/MonitorPage.tsx

import { useState, useMemo, useEffect } from 'react'
import { useWatchlist } from '@/lib/watchlist'
import {
  Activity, X, Loader2, Radio, Pause, Play,
  Settings2, Download, FileDown, SlidersHorizontal
} from 'lucide-react'
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid,
  Tooltip, Legend, ResponsiveContainer, ReferenceLine
} from 'recharts'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from '@/components/ui/dialog'

const CHART_COLORS = ['#6366f1', '#ef4444', '#10b981', '#f59e0b', '#3b82f6', '#ec4899']

const TIME_WINDOW_OPTIONS = [
  { label: '30s', value: 30 },
  { label: '1m',  value: 60 },
  { label: '2m',  value: 120 },
  { label: '5m',  value: 300 },
  { label: '10m', value: 600 },
]

const UPDATE_RATE_OPTIONS = [
  { label: '100ms', value: 100 },
  { label: '500ms', value: 500 },
  { label: '1s',    value: 1000 },
  { label: '5s',    value: 5000 },
  { label: '10s',   value: 10000 },
]

interface Threshold {
  warningHigh:  number | null
  warningLow:   number | null
  criticalHigh: number | null
  criticalLow:  number | null
}

type ThresholdMap = Record<string, Threshold>

function emptyThreshold(): Threshold {
  return { warningHigh: null, warningLow: null, criticalHigh: null, criticalLow: null }
}

function getAlarmState(value: string | null, threshold: Threshold | undefined): 'critical' | 'warning' | 'normal' {
  if (!value || !threshold) return 'normal'
  const n = parseFloat(value)
  if (isNaN(n)) return 'normal'

  if (
    (threshold.criticalHigh !== null && n >= threshold.criticalHigh) ||
    (threshold.criticalLow  !== null && n <= threshold.criticalLow)
  ) return 'critical'

  if (
    (threshold.warningHigh !== null && n >= threshold.warningHigh) ||
    (threshold.warningLow  !== null && n <= threshold.warningLow)
  ) return 'warning'

  return 'normal'
}

const ALARM_STYLES = {
  critical: {
    card:   'border-red-300 bg-red-50',
    label:  'text-red-400',
    value:  'text-red-700',
    badge:  'bg-red-100 text-red-600',
  },
  warning: {
    card:   'border-amber-300 bg-amber-50',
    label:  'text-amber-500',
    value:  'text-amber-700',
    badge:  'bg-amber-100 text-amber-600',
  },
  normal: {
    card:   'border-slate-200 bg-white',
    label:  'text-slate-400',
    value:  'text-slate-800',
    badge:  '',
  },
}

export default function MonitorPage() {
  const {
    watchlist, removeTag, clearWatchlist,
    readings, chartData, fullBuffer, isStreaming, isPaused, settings,
    startStream, stopStream, togglePause, updateSettings,
  } = useWatchlist()

  const [showSettings, setShowSettings] = useState(false)
  const [showExport, setShowExport]     = useState(false)
  const [exportSeconds, setExportSeconds] = useState<number>(30)


  // Threshold state — keyed by node_id, persisted to localStorage
  const [thresholds, setThresholds] = useState<ThresholdMap>(() => {
    try {
      const raw = localStorage.getItem('silver_opcua_thresholds')
      if (!raw) return {}
      return JSON.parse(raw) as ThresholdMap
    } catch { return {} }
  })
  // Which tag's threshold dialog is open
  const [thresholdTag, setThresholdTag] = useState<string | null>(null)
  const [thresholdDraft, setThresholdDraft] = useState<Threshold>(emptyThreshold())
  // Persist thresholds to localStorage on every change
  useEffect(() => {
    try {
      localStorage.setItem('silver_opcua_thresholds', JSON.stringify(thresholds))
    } catch { /* ignore */ }
  }, [thresholds])

  const maxBufferSeconds = useMemo(() => {
    if (fullBuffer.length === 0) return 0
    return Math.ceil(fullBuffer[fullBuffer.length - 1].elapsed)
  }, [fullBuffer])

  const exportRowCount = useMemo(() => {
    const cutoff = maxBufferSeconds - exportSeconds
    return fullBuffer.filter(p => p.elapsed >= cutoff).length
  }, [fullBuffer, maxBufferSeconds, exportSeconds])

  const handleExport = () => {
    if (fullBuffer.length === 0) return
    const cutoff = maxBufferSeconds - exportSeconds
    const rows = fullBuffer.filter(p => p.elapsed >= cutoff)
    const tagNames = watchlist.map(t => t.name)
    const header = ['#', 'DateTime', 'Elapsed (s)', ...tagNames].join(',')
    const streamStartMs = Date.now() - (maxBufferSeconds * 1000)
    const lines = rows.map((point, idx) => {
      const recordTime = new Date(streamStartMs + point.elapsed * 1000)
      const dateStr = recordTime.toISOString().replace('T', ' ').slice(0, 23)
      const values = tagNames.map(name => {
        const val = point[name]
        return val !== undefined ? String(val) : ''
      })
      return [idx + 1, dateStr, point.elapsed.toFixed(2), ...values].join(',')
    })
    const csv = [header, ...lines].join('\n')
    const blob = new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8;' })
    const url  = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href     = url
    link.download = `silver_opcua_${new Date().toISOString().slice(0, 19).replace(/[T:]/g, '-')}.csv`
    link.click()
    URL.revokeObjectURL(url)
    setShowExport(false)
  }

  const openThresholdDialog = (node_id: string) => {
    setThresholdDraft(thresholds[node_id] ?? emptyThreshold())
    setThresholdTag(node_id)
  }

  const saveThreshold = () => {
    if (!thresholdTag) return
    setThresholds(prev => ({ ...prev, [thresholdTag]: thresholdDraft }))
    setThresholdTag(null)
  }

  const clearThreshold = () => {
    if (!thresholdTag) return
    setThresholds(prev => { const n = { ...prev }; delete n[thresholdTag]; return n })
    setThresholdTag(null)
  }

  // Collect all reference lines for chart
  const referenceLines = useMemo(() => {
    const lines: { value: number; color: string; label: string }[] = []
    watchlist.forEach(tag => {
      const t = thresholds[tag.node_id]
      if (!t) return
      if (t.criticalHigh !== null) lines.push({ value: t.criticalHigh, color: '#ef4444', label: `${tag.name} Critical High` })
      if (t.criticalLow  !== null) lines.push({ value: t.criticalLow,  color: '#ef4444', label: `${tag.name} Critical Low` })
      if (t.warningHigh  !== null) lines.push({ value: t.warningHigh,  color: '#f59e0b', label: `${tag.name} Warning High` })
      if (t.warningLow   !== null) lines.push({ value: t.warningLow,   color: '#f59e0b', label: `${tag.name} Warning Low` })
    })
    return lines
  }, [thresholds, watchlist])

  // ── Empty state ──
  if (watchlist.length === 0) {
    return (
      <div className="h-[calc(100vh-56px)] flex items-center justify-center"
           style={{ backgroundColor: '#f1f5f9' }}>
        <div className="text-center">
          <Activity className="w-12 h-12 mx-auto text-slate-200 mb-4" />
          <p className="text-slate-500 font-medium">No tags in watchlist</p>
          <p className="text-slate-400 text-sm mt-1">
            Go to <span className="font-medium text-indigo-500">Tag Browser</span> and add tags to monitor
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="h-[calc(100vh-56px)] flex flex-col" style={{ backgroundColor: '#f1f5f9' }}>

      {/* ── Threshold Dialog ── */}
      <Dialog open={thresholdTag !== null} onOpenChange={open => !open && setThresholdTag(null)}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>
              Thresholds — {watchlist.find(t => t.node_id === thresholdTag)?.name}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 mt-2">
            <p className="text-xs text-slate-400">
              Set warning and critical limits. The value card and chart will highlight
              when the tag exceeds these thresholds. Leave blank to disable.
            </p>

            {/* Warning */}
            <div className="space-y-2">
              <p className="text-xs font-semibold text-amber-600 uppercase tracking-wide">
                Warning
              </p>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-xs text-slate-500 mb-1 block">High</label>
                  <input
                    type="number"
                    placeholder="e.g. 35"
                    value={thresholdDraft.warningHigh ?? ''}
                    onChange={e => setThresholdDraft(prev => ({
                      ...prev,
                      warningHigh: e.target.value === '' ? null : parseFloat(e.target.value)
                    }))}
                    className="w-full px-3 py-1.5 text-sm border border-amber-200 rounded-lg
                               focus:outline-none focus:ring-2 focus:ring-amber-300 bg-amber-50"
                  />
                </div>
                <div>
                  <label className="text-xs text-slate-500 mb-1 block">Low</label>
                  <input
                    type="number"
                    placeholder="e.g. 15"
                    value={thresholdDraft.warningLow ?? ''}
                    onChange={e => setThresholdDraft(prev => ({
                      ...prev,
                      warningLow: e.target.value === '' ? null : parseFloat(e.target.value)
                    }))}
                    className="w-full px-3 py-1.5 text-sm border border-amber-200 rounded-lg
                               focus:outline-none focus:ring-2 focus:ring-amber-300 bg-amber-50"
                  />
                </div>
              </div>
            </div>

            {/* Critical */}
            <div className="space-y-2">
              <p className="text-xs font-semibold text-red-600 uppercase tracking-wide">
                Critical
              </p>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-xs text-slate-500 mb-1 block">High</label>
                  <input
                    type="number"
                    placeholder="e.g. 40"
                    value={thresholdDraft.criticalHigh ?? ''}
                    onChange={e => setThresholdDraft(prev => ({
                      ...prev,
                      criticalHigh: e.target.value === '' ? null : parseFloat(e.target.value)
                    }))}
                    className="w-full px-3 py-1.5 text-sm border border-red-200 rounded-lg
                               focus:outline-none focus:ring-2 focus:ring-red-300 bg-red-50"
                  />
                </div>
                <div>
                  <label className="text-xs text-slate-500 mb-1 block">Low</label>
                  <input
                    type="number"
                    placeholder="e.g. 10"
                    value={thresholdDraft.criticalLow ?? ''}
                    onChange={e => setThresholdDraft(prev => ({
                      ...prev,
                      criticalLow: e.target.value === '' ? null : parseFloat(e.target.value)
                    }))}
                    className="w-full px-3 py-1.5 text-sm border border-red-200 rounded-lg
                               focus:outline-none focus:ring-2 focus:ring-red-300 bg-red-50"
                  />
                </div>
              </div>
            </div>

            {/* Actions */}
            <div className="flex gap-2 pt-1">
              <button
                onClick={saveThreshold}
                className="flex-1 py-2 rounded-lg text-sm font-medium
                           bg-indigo-500 text-white hover:bg-indigo-600 transition-colors"
              >
                Apply
              </button>
              <button
                onClick={clearThreshold}
                className="px-4 py-2 rounded-lg text-sm font-medium
                           border border-slate-200 text-slate-500 hover:bg-slate-100 transition-colors"
              >
                Clear
              </button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* ── Export Dialog ── */}
      <Dialog open={showExport} onOpenChange={setShowExport}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Export Data</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 mt-2">
            <p className="text-xs text-slate-500">
              Select how many seconds of recorded data to export.
              The file opens directly in Excel with separate columns for each tag.
            </p>
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-slate-700">Export window</span>
                <span className="text-sm font-mono font-semibold text-indigo-600">
                  {exportSeconds >= 60
                    ? `${(exportSeconds / 60).toFixed(1)}m`
                    : `${exportSeconds}s`
                  }
                </span>
              </div>
              <input
                type="range"
                min={1}
                max={Math.max(exportSeconds, maxBufferSeconds)}
                value={exportSeconds}
                onChange={e => setExportSeconds(Number(e.target.value))}
                className="w-full accent-indigo-500"
              />
              <div className="flex justify-between text-xs text-slate-400">
                <span>1s</span>
                <span>Total recorded: {maxBufferSeconds}s</span>
              </div>
            </div>
            <div className="bg-slate-50 rounded-lg px-4 py-3 space-y-1">
              <div className="flex justify-between text-xs">
                <span className="text-slate-500">Records</span>
                <span className="font-medium text-slate-700">{exportRowCount}</span>
              </div>
              <div className="flex justify-between text-xs">
                <span className="text-slate-500">Tags</span>
                <span className="font-medium text-slate-700">{watchlist.length}</span>
              </div>
              <div className="flex justify-between text-xs">
                <span className="text-slate-500">Columns</span>
                <span className="font-medium text-slate-700">
                  #, DateTime, Elapsed, {watchlist.map(t => t.name).join(', ')}
                </span>
              </div>
            </div>
            <button
              onClick={handleExport}
              disabled={fullBuffer.length === 0}
              className="w-full flex items-center justify-center gap-2 py-2 rounded-lg text-sm font-medium
                         bg-emerald-500 text-white hover:bg-emerald-600 disabled:opacity-50 transition-colors"
            >
              <FileDown className="w-4 h-4" />
              Download CSV
            </button>
          </div>
        </DialogContent>
      </Dialog>

      {/* ── Toolbar ── */}
      <div className="bg-white border-b px-6 py-3 flex items-center gap-3 shrink-0"
           style={{ boxShadow: '0 1px 4px rgba(0,0,0,0.06)' }}>
        <div className="flex items-center gap-3 flex-1">
          {isStreaming && (
            <span className="flex items-center gap-1.5 text-xs font-medium text-green-600">
              <span className={`w-2 h-2 rounded-full bg-green-500 ${isPaused ? '' : 'animate-pulse'}`} />
              {isPaused ? 'Paused' : 'Live'}
            </span>
          )}
          <span className="text-sm text-slate-500">
            {watchlist.length} tag{watchlist.length > 1 ? 's' : ''} in watchlist
          </span>
          {fullBuffer.length > 0 && (
            <span className="text-xs text-slate-400">· {maxBufferSeconds}s recorded</span>
          )}
        </div>

        <div className="flex items-center gap-2">
          {fullBuffer.length > 0 && (
            <button
              onClick={() => setShowExport(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium
                         border border-emerald-200 text-emerald-700 hover:bg-emerald-50 transition-colors"
            >
              <Download className="w-3.5 h-3.5" />
              Export CSV
            </button>
          )}

          <button
            onClick={() => setShowSettings(p => !p)}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium
                       border transition-colors
                       ${showSettings
                         ? 'bg-slate-100 text-slate-700 border-slate-300'
                         : 'text-slate-500 border-slate-200 hover:bg-slate-100'
                       }`}
          >
            <Settings2 className="w-3.5 h-3.5" />
            Settings
          </button>

          {isStreaming && (
            <button
              onClick={togglePause}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium
                         border border-slate-200 text-slate-600 hover:bg-slate-100 transition-colors"
            >
              {isPaused
                ? <><Play className="w-3.5 h-3.5" /> Resume</>
                : <><Pause className="w-3.5 h-3.5" /> Pause</>
              }
            </button>
          )}

          {isStreaming ? (
            <button
              onClick={stopStream}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium
                         bg-red-50 text-red-600 border border-red-200 hover:bg-red-100 transition-colors"
            >
              Stop
            </button>
          ) : (
            <button
              onClick={startStream}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium
                         bg-indigo-500 text-white hover:bg-indigo-600 transition-colors"
            >
              <Radio className="w-3.5 h-3.5" />
              Start Stream
            </button>
          )}

          <button
            onClick={clearWatchlist}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium
                       text-slate-500 border border-slate-200 hover:bg-slate-100 transition-colors"
          >
            Clear All
          </button>
        </div>
      </div>

      {/* ── Settings panel ── */}
      {showSettings && (
        <div className="bg-white border-b px-6 py-3 flex items-center gap-8 shrink-0">
          <div className="flex items-center gap-3">
            <span className="text-xs font-semibold text-slate-400 uppercase tracking-wide whitespace-nowrap">
              Time Window
            </span>
            <div className="flex gap-1">
              {TIME_WINDOW_OPTIONS.map(opt => (
                <button
                  key={opt.value}
                  onClick={() => updateSettings({ timeWindow: opt.value })}
                  className={`px-2.5 py-1 rounded text-xs font-medium transition-colors
                    ${settings.timeWindow === opt.value
                      ? 'bg-indigo-500 text-white'
                      : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                    }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>
          <div className="w-px h-6 bg-slate-200" />
          <div className="flex items-center gap-3">
            <span className="text-xs font-semibold text-slate-400 uppercase tracking-wide whitespace-nowrap">
              Update Rate
            </span>
            <div className="flex gap-1">
              {UPDATE_RATE_OPTIONS.map(opt => (
                <button
                  key={opt.value}
                  onClick={() => updateSettings({ updateRate: opt.value })}
                  className={`px-2.5 py-1 rounded text-xs font-medium transition-colors
                    ${settings.updateRate === opt.value
                      ? 'bg-indigo-500 text-white'
                      : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                    }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>
          <p className="text-xs text-slate-400 ml-auto">
            * Update rate takes effect on next stream start
          </p>
        </div>
      )}

      {/* ── Main content ── */}
      <div className="flex flex-1 overflow-hidden">

        {/* ── Left — watchlist ── */}
        <div className="w-64 border-r bg-white flex flex-col shrink-0"
             style={{ boxShadow: '2px 0 8px rgba(0,0,0,0.04)' }}>
          <div className="p-3 border-b">
            <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide">
              Watchlist
            </p>
          </div>
          <div className="flex-1 overflow-y-auto p-2">
            {watchlist.map((tag, index) => {
              const reading = readings[tag.node_id]
              const color = CHART_COLORS[index % CHART_COLORS.length]
              const alarm = getAlarmState(reading?.value ?? null, thresholds[tag.node_id])

              let displayValue = reading?.value ?? null
              if (displayValue?.toLowerCase() === 'true')  displayValue = 'ON'
              if (displayValue?.toLowerCase() === 'false') displayValue = 'OFF'

              return (
                <div
                  key={tag.node_id}
                  className={`flex items-center gap-2 px-2 py-2 rounded-md group
                    ${alarm === 'critical' ? 'bg-red-50' : alarm === 'warning' ? 'bg-amber-50' : 'hover:bg-slate-50'}
                  `}
                >
                  <span className="w-2.5 h-2.5 rounded-full shrink-0"
                        style={{ backgroundColor: color }} />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-slate-700 truncate">{tag.name}</p>
                    <p className="text-xs text-slate-400 truncate">{tag.connection_name}</p>
                  </div>
                  {displayValue && (
                    <span className={`font-mono text-xs shrink-0 font-medium
                      ${alarm === 'critical' ? 'text-red-600' : alarm === 'warning' ? 'text-amber-600' : 'text-slate-600'}
                    `}>
                      {displayValue}
                    </span>
                  )}
                  {isStreaming && !reading && (
                    <Loader2 className="w-3 h-3 animate-spin text-slate-300 shrink-0" />
                  )}
                  {/* Threshold settings button */}
                  <button
                    onClick={() => openThresholdDialog(tag.node_id)}
                    className={`shrink-0 p-0.5 rounded transition-colors
                      ${thresholds[tag.node_id]
                        ? 'text-indigo-400 opacity-100'
                        : 'text-slate-300 opacity-0 group-hover:opacity-100 hover:text-indigo-400'
                      }
                    `}
                    title="Set thresholds"
                  >
                    <SlidersHorizontal className="w-3.5 h-3.5" />
                  </button>
                  <button
                    onClick={() => removeTag(tag.node_id)}
                    className="opacity-0 group-hover:opacity-100 transition-opacity shrink-0"
                  >
                    <X className="w-3.5 h-3.5 text-slate-400 hover:text-red-400" />
                  </button>
                </div>
              )
            })}
          </div>
        </div>

        {/* ── Right — charts + value cards ── */}
        <div className="flex-1 overflow-y-auto p-6">
          {!isStreaming ? (
            <div className="h-full flex items-center justify-center">
              <div className="text-center">
                <Activity className="w-10 h-10 mx-auto text-slate-200 mb-3" />
                <p className="text-slate-400 font-medium text-sm">Ready to stream</p>
                <p className="text-slate-300 text-xs mt-1">
                  {watchlist.length} tag{watchlist.length > 1 ? 's' : ''} selected — click "Start Stream"
                </p>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              {/* Value cards */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                {watchlist.map((tag, index) => {
                  const reading = readings[tag.node_id]
                  const color   = CHART_COLORS[index % CHART_COLORS.length]
                  const alarm   = getAlarmState(reading?.value ?? null, thresholds[tag.node_id])
                  const style   = ALARM_STYLES[alarm]

                  let displayValue = reading?.value ?? '—'
                  if (displayValue.toLowerCase() === 'true')  displayValue = 'ON'
                  if (displayValue.toLowerCase() === 'false') displayValue = 'OFF'

                  return (
                    <div
                      key={tag.node_id}
                      className={`border rounded-xl p-4 relative transition-colors ${style.card}`}
                      style={{
                        borderLeftWidth: 3,
                        borderLeftColor: alarm === 'critical' ? '#ef4444' : alarm === 'warning' ? '#f59e0b' : color,
                        boxShadow: '0 1px 3px rgba(0,0,0,0.06)'
                      }}
                    >
                      <div className="flex items-start justify-between mb-1">
                        <p className={`text-xs font-medium uppercase tracking-wide truncate ${style.label}`}>
                          {tag.name}
                        </p>
                        {/* Alarm badge */}
                        {alarm !== 'normal' && (
                          <span className={`text-xs font-semibold px-1.5 py-0.5 rounded shrink-0 ml-1 ${style.badge}`}>
                            {alarm === 'critical' ? '⚠ CRIT' : '⚠ WARN'}
                          </span>
                        )}
                      </div>
                      <p className={`font-mono font-semibold tabular-nums ${style.value}
                        ${displayValue === 'ON' || displayValue === 'OFF' ? 'text-lg' : 'text-2xl'}
                      `}>
                        {displayValue}
                      </p>
                      {/* Threshold settings button on card */}
                      <button
                        onClick={() => openThresholdDialog(tag.node_id)}
                        className="absolute top-2 right-2 p-1 rounded text-slate-300
                                   hover:text-indigo-400 hover:bg-white/60 transition-colors opacity-0
                                   group-hover:opacity-100"
                        title="Set thresholds"
                      >
                        <SlidersHorizontal className="w-3 h-3" />
                      </button>
                      {reading?.error && (
                        <p className="text-xs text-red-400 mt-1 truncate">{reading.error}</p>
                      )}
                    </div>
                  )
                })}
              </div>

              {/* Chart */}
              <div className="bg-white border rounded-xl p-4"
                   style={{ boxShadow: '0 1px 3px rgba(0,0,0,0.06)' }}>
                <div className="flex items-center justify-between mb-4">
                  <p className="text-sm font-medium text-slate-700">
                    Trend (last {settings.timeWindow >= 60
                      ? `${settings.timeWindow / 60}m`
                      : `${settings.timeWindow}s`
                    })
                  </p>
                  {isPaused && (
                    <span className="text-xs text-amber-500 font-medium px-2 py-0.5 bg-amber-50 rounded">
                      Paused
                    </span>
                  )}
                </div>
                <ResponsiveContainer width="100%" height={300}>
                  <LineChart data={chartData} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                    <XAxis dataKey="time" stroke="#94a3b8" style={{ fontSize: '11px' }} />
                    <YAxis stroke="#94a3b8" style={{ fontSize: '11px' }} />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: '#fff',
                        border: '1px solid #e2e8f0',
                        borderRadius: '8px',
                        fontSize: '12px'
                      }}
                      formatter={(value, name) => {
                        if (value === 1) return ['ON', name]
                        if (value === 0) return ['OFF', name]
                        return [value, name]
                      }}
                    />
                    <Legend />

                    {/* Threshold reference lines */}
                    {referenceLines.map((ref, i) => (
                      <ReferenceLine
                        key={i}
                        y={ref.value}
                        stroke={ref.color}
                        strokeDasharray="4 4"
                        strokeWidth={1.5}
                        label={{
                          value: ref.label,
                          position: 'insideTopRight',
                          fontSize: 10,
                          fill: ref.color,
                        }}
                      />
                    ))}

                    {watchlist.map((tag, index) => (
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
          )}
        </div>
      </div>
    </div>
  )
}