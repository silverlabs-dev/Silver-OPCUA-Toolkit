// frontend/src/pages/MonitorPage.tsx

import { useState } from 'react'
import { useWatchlist } from '@/lib/watchlist'
import { Activity, X, Loader2, Radio, Pause, Play, Settings2 } from 'lucide-react'
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid,
  Tooltip, Legend, ResponsiveContainer
} from 'recharts'

const CHART_COLORS = ['#6366f1', '#ef4444', '#10b981', '#f59e0b', '#3b82f6', '#ec4899']

// Time window options in seconds
const TIME_WINDOW_OPTIONS = [
  { label: '30s',  value: 30 },
  { label: '1m',   value: 60 },
  { label: '2m',   value: 120 },
  { label: '5m',   value: 300 },
  { label: '10m',  value: 600 },
]

// Update rate options in milliseconds
const UPDATE_RATE_OPTIONS = [
  { label: '100ms', value: 100 },
  { label: '500ms', value: 500 },
  { label: '1s',    value: 1000 },
  { label: '5s',    value: 5000 },
  { label: '10s',   value: 10000 },
]

export default function MonitorPage() {
  const {
    watchlist, removeTag, clearWatchlist,
    readings, chartData, isStreaming, isPaused, settings,
    startStream, stopStream, togglePause, updateSettings,
  } = useWatchlist()

  const [showSettings, setShowSettings] = useState(false)

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
        </div>

        <div className="flex items-center gap-2">
          {/* Settings toggle */}
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

          {/* Pause/Resume — only when streaming */}
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

          {/* Start/Stop */}
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

          {/* Time window */}
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

          {/* Divider */}
          <div className="w-px h-6 bg-slate-200" />

          {/* Update rate */}
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

              // Format display value — bool shows ON/OFF
              let displayValue = reading?.value ?? null
              if (displayValue?.toLowerCase() === 'true')  displayValue = 'ON'
              if (displayValue?.toLowerCase() === 'false') displayValue = 'OFF'

              return (
                <div
                  key={tag.node_id}
                  className="flex items-center gap-2 px-2 py-2 rounded-md hover:bg-slate-50 group"
                >
                  <span className="w-2.5 h-2.5 rounded-full shrink-0"
                        style={{ backgroundColor: color }} />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-slate-700 truncate">{tag.name}</p>
                    <p className="text-xs text-slate-400 truncate">{tag.connection_name}</p>
                  </div>
                  {displayValue && (
                    <span className="font-mono text-xs text-slate-600 shrink-0">
                      {displayValue}
                    </span>
                  )}
                  {isStreaming && !reading && (
                    <Loader2 className="w-3 h-3 animate-spin text-slate-300 shrink-0" />
                  )}
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
                  const color = CHART_COLORS[index % CHART_COLORS.length]

                  let displayValue = reading?.value ?? '—'
                  if (displayValue.toLowerCase() === 'true')  displayValue = 'ON'
                  if (displayValue.toLowerCase() === 'false') displayValue = 'OFF'

                  return (
                    <div
                      key={tag.node_id}
                      className="bg-white border rounded-xl p-4"
                      style={{
                        borderLeftWidth: 3,
                        borderLeftColor: color,
                        boxShadow: '0 1px 3px rgba(0,0,0,0.06)'
                      }}
                    >
                      <p className="text-xs font-medium text-slate-400 uppercase tracking-wide mb-1 truncate">
                        {tag.name}
                      </p>
                      <p className={`font-mono font-semibold text-slate-800 tabular-nums
                        ${displayValue === 'ON' || displayValue === 'OFF' ? 'text-lg' : 'text-2xl'}
                      `}>
                        {displayValue}
                      </p>
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
                        // Show ON/OFF for boolean values in tooltip
                        if (value === 1) return ['ON', name]
                        if (value === 0) return ['OFF', name]
                        return [value, name]
                      }}
                    />
                    <Legend />
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