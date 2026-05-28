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

function getAlarmState(
  value: string | null,
  threshold: Threshold | undefined
): 'critical' | 'warning' | 'normal' {
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

// Alarm state → inline style tokens (no Tailwind strings for dynamic values)
const ALARM_CARD_STYLE = {
  critical: {
    border: '#FECACA', background: '#FEF2F2',
    labelColor: '#F87171', valueColor: '#DC2626',
    badgeBg: '#FEE2E2', badgeColor: '#DC2626',
    accentBar: '#EF4444',
  },
  warning: {
    border: '#FDE68A', background: '#FFFBEB',
    labelColor: '#FBBF24', valueColor: '#D97706',
    badgeBg: '#FEF3C7', badgeColor: '#D97706',
    accentBar: '#F59E0B',
  },
  normal: {
    border: '#E2E8F0', background: '#FFFFFF',
    labelColor: '#94A3B8', valueColor: '#0F172A',
    badgeBg: '', badgeColor: '',
    accentBar: '',
  },
}

// ── Pill button ──
function Pill({
  active, onClick, children,
}: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      style={{
        padding: '4px 10px',
        borderRadius: '20px',
        fontSize: '11.5px',
        fontWeight: 500,
        cursor: 'pointer',
        border: '1px solid',
        borderColor: active ? '#6366F1' : '#E2E8F0',
        background: active ? '#6366F1' : '#fff',
        color: active ? '#fff' : '#475569',
        transition: 'all 0.15s',
      }}
    >
      {children}
    </button>
  )
}

// ── Toolbar button ──
function ToolbarBtn({
  onClick, children, variant = 'default', disabled,
}: {
  onClick: () => void
  children: React.ReactNode
  variant?: 'default' | 'danger' | 'primary' | 'success'
  disabled?: boolean
}) {
  const styles = {
    default:  { background: '#fff', color: '#475569', borderColor: '#E2E8F0' },
    danger:   { background: '#FEF2F2', color: '#DC2626', borderColor: '#FECACA' },
    primary:  { background: '#6366F1', color: '#fff', borderColor: '#6366F1' },
    success:  { background: '#fff', color: '#16A34A', borderColor: '#BBF7D0' },
  }
  const s = styles[variant]
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className="flex items-center gap-1.5 transition-colors disabled:opacity-50"
      style={{
        padding: '6px 12px',
        borderRadius: '7px',
        fontSize: '12px',
        fontWeight: 500,
        border: '1px solid',
        cursor: disabled ? 'not-allowed' : 'pointer',
        whiteSpace: 'nowrap',
        ...s,
      }}
    >
      {children}
    </button>
  )
}

// ── Threshold number input ──
function ThresholdInput({
  label, value, onChange, colorScheme,
}: {
  label: string
  value: number | null
  onChange: (v: number | null) => void
  colorScheme: 'amber' | 'red'
}) {
  const colors = {
    amber: { border: '#FDE68A', bg: '#FFFBEB', ring: '#FCD34D' },
    red:   { border: '#FECACA', bg: '#FEF2F2', ring: '#FCA5A5' },
  }[colorScheme]

  return (
    <div>
      <label style={{ fontSize: '11px', color: '#94A3B8', display: 'block', marginBottom: '4px' }}>
        {label}
      </label>
      <input
        type="number"
        placeholder="—"
        value={value ?? ''}
        onChange={e => onChange(e.target.value === '' ? null : parseFloat(e.target.value))}
        style={{
          width: '100%',
          padding: '7px 10px',
          fontSize: '12.5px',
          borderRadius: '7px',
          border: `1px solid ${colors.border}`,
          background: colors.bg,
          outline: 'none',
          color: '#0F172A',
        }}
        onFocus={e => { e.target.style.boxShadow = `0 0 0 3px ${colors.ring}40` }}
        onBlur={e  => { e.target.style.boxShadow = 'none' }}
      />
    </div>
  )
}

// ─────────────────────────────────────────────────────
// Main component
// ─────────────────────────────────────────────────────

export default function MonitorPage() {
  const {
    watchlist, removeTag, clearWatchlist,
    readings, chartData, fullBuffer, isStreaming, isPaused, settings,
    startStream, stopStream, togglePause, updateSettings,
  } = useWatchlist()

  const [showSettings, setShowSettings]   = useState(false)
  const [showExport, setShowExport]       = useState(false)
  const [exportSeconds, setExportSeconds] = useState<number>(30)
  const [hoveredTag, setHoveredTag]       = useState<string | null>(null)

  // Threshold state — keyed by node_id, persisted to localStorage
  const [thresholds, setThresholds] = useState<ThresholdMap>(() => {
    try {
      const raw = localStorage.getItem('silver_opcua_thresholds')
      if (!raw) return {}
      return JSON.parse(raw) as ThresholdMap
    } catch { return {} }
  })
  const [thresholdTag, setThresholdTag]     = useState<string | null>(null)
  const [thresholdDraft, setThresholdDraft] = useState<Threshold>(emptyThreshold())

  // Persist thresholds on change
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
    const cutoff      = maxBufferSeconds - exportSeconds
    const rows        = fullBuffer.filter(p => p.elapsed >= cutoff)
    const tagNames    = watchlist.map(t => t.name)
    const header      = ['#', 'DateTime', 'Elapsed (s)', ...tagNames].join(',')
    const startMs     = Date.now() - (maxBufferSeconds * 1000)
    const lines = rows.map((point, idx) => {
      const dt     = new Date(startMs + point.elapsed * 1000)
      const dateStr = dt.toISOString().replace('T', ' ').slice(0, 23)
      const values  = tagNames.map(name => {
        const val = point[name]
        return val !== undefined ? String(val) : ''
      })
      return [idx + 1, dateStr, point.elapsed.toFixed(2), ...values].join(',')
    })
    const csv  = [header, ...lines].join('\n')
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
      <div
        className="flex items-center justify-center"
        style={{ height: '100vh', background: '#F1F5F9' }}
      >
        <div className="text-center">
          <div
            style={{
              width: '52px', height: '52px', borderRadius: '14px',
              background: '#F8FAFC', border: '1px solid #E2E8F0',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              margin: '0 auto 14px',
            }}
          >
            <Activity style={{ width: '22px', height: '22px', color: '#CBD5E1' }} />
          </div>
          <p style={{ fontSize: '14px', fontWeight: 600, color: '#475569' }}>
            No tags in watchlist
          </p>
          <p style={{ fontSize: '12px', color: '#94A3B8', marginTop: '5px' }}>
            Go to <span style={{ color: '#6366F1', fontWeight: 500 }}>Tag Browser</span> and add tags to monitor
          </p>
        </div>
      </div>
    )
  }

  // ── Main render ──
  return (
    <div
      className="flex flex-col"
      style={{ height: '100vh', background: '#F1F5F9' }}
    >

      {/* ── Threshold Dialog ── */}
      <Dialog open={thresholdTag !== null} onOpenChange={open => !open && setThresholdTag(null)}>
        <DialogContent className="sm:max-w-sm" style={{ borderRadius: '14px' }}>
          <DialogHeader>
            <DialogTitle style={{ fontSize: '15px', fontWeight: 600, color: '#0F172A' }}>
              Thresholds — {watchlist.find(t => t.node_id === thresholdTag)?.name}
            </DialogTitle>
          </DialogHeader>
          <p style={{ fontSize: '11.5px', color: '#94A3B8', marginTop: '4px', marginBottom: '4px' }}>
            Set warning and critical limits. The card and chart highlight when exceeded.
            Leave blank to disable.
          </p>

          <div style={{ marginTop: '8px' }}>
            {/* Warning */}
            <div style={{ marginBottom: '16px' }}>
              <p style={{ fontSize: '10.5px', fontWeight: 700, color: '#D97706', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: '8px' }}>
                Warning
              </p>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                <ThresholdInput
                  label="High"
                  value={thresholdDraft.warningHigh}
                  onChange={v => setThresholdDraft(p => ({ ...p, warningHigh: v }))}
                  colorScheme="amber"
                />
                <ThresholdInput
                  label="Low"
                  value={thresholdDraft.warningLow}
                  onChange={v => setThresholdDraft(p => ({ ...p, warningLow: v }))}
                  colorScheme="amber"
                />
              </div>
            </div>

            {/* Critical */}
            <div style={{ marginBottom: '16px' }}>
              <p style={{ fontSize: '10.5px', fontWeight: 700, color: '#DC2626', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: '8px' }}>
                Critical
              </p>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                <ThresholdInput
                  label="High"
                  value={thresholdDraft.criticalHigh}
                  onChange={v => setThresholdDraft(p => ({ ...p, criticalHigh: v }))}
                  colorScheme="red"
                />
                <ThresholdInput
                  label="Low"
                  value={thresholdDraft.criticalLow}
                  onChange={v => setThresholdDraft(p => ({ ...p, criticalLow: v }))}
                  colorScheme="red"
                />
              </div>
            </div>

            {/* Actions */}
            <div style={{ display: 'flex', gap: '8px' }}>
              <button
                onClick={saveThreshold}
                style={{
                  flex: 1, padding: '8px', borderRadius: '8px',
                  fontSize: '12.5px', fontWeight: 500,
                  background: '#6366F1', color: '#fff', border: 'none', cursor: 'pointer',
                }}
              >
                Apply
              </button>
              <button
                onClick={clearThreshold}
                style={{
                  padding: '8px 16px', borderRadius: '8px',
                  fontSize: '12.5px', fontWeight: 500,
                  background: '#fff', color: '#475569',
                  border: '1px solid #E2E8F0', cursor: 'pointer',
                }}
              >
                Clear
              </button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* ── Export Dialog ── */}
      <Dialog open={showExport} onOpenChange={setShowExport}>
        <DialogContent className="sm:max-w-md" style={{ borderRadius: '14px' }}>
          <DialogHeader>
            <DialogTitle style={{ fontSize: '15px', fontWeight: 600, color: '#0F172A' }}>
              Export Data
            </DialogTitle>
          </DialogHeader>
          <div style={{ marginTop: '8px' }}>
            <p style={{ fontSize: '11.5px', color: '#94A3B8', marginBottom: '16px' }}>
              Select how many seconds of recorded data to export.
              Opens directly in Excel with separate columns per tag.
            </p>

            <div style={{ marginBottom: '16px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                <span style={{ fontSize: '12.5px', fontWeight: 500, color: '#0F172A' }}>
                  Export window
                </span>
                <span style={{ fontSize: '13px', fontWeight: 700, color: '#6366F1', fontFamily: 'ui-monospace, monospace' }}>
                  {exportSeconds >= 60 ? `${(exportSeconds / 60).toFixed(1)}m` : `${exportSeconds}s`}
                </span>
              </div>
              <input
                type="range"
                min={1}
                max={Math.max(exportSeconds, maxBufferSeconds)}
                value={exportSeconds}
                onChange={e => setExportSeconds(Number(e.target.value))}
                style={{ width: '100%', accentColor: '#6366F1' }}
              />
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', color: '#94A3B8', marginTop: '4px' }}>
                <span>1s</span>
                <span>Total recorded: {maxBufferSeconds}s</span>
              </div>
            </div>

            {/* Summary */}
            <div
              style={{
                background: '#F8FAFC', border: '1px solid #E2E8F0',
                borderRadius: '8px', padding: '12px 14px',
                marginBottom: '16px',
              }}
            >
              {[
                { label: 'Records',  value: exportRowCount },
                { label: 'Tags',     value: watchlist.length },
                { label: 'Columns',  value: `#, DateTime, Elapsed, ${watchlist.map(t => t.name).join(', ')}` },
              ].map(row => (
                <div
                  key={row.label}
                  style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}
                >
                  <span style={{ fontSize: '11.5px', color: '#94A3B8' }}>{row.label}</span>
                  <span style={{ fontSize: '11.5px', fontWeight: 500, color: '#0F172A', maxWidth: '60%', textAlign: 'right', wordBreak: 'break-all' }}>
                    {row.value}
                  </span>
                </div>
              ))}
            </div>

            <button
              onClick={handleExport}
              disabled={fullBuffer.length === 0}
              className="w-full flex items-center justify-center gap-2 disabled:opacity-50 transition-colors"
              style={{
                padding: '9px', borderRadius: '8px',
                fontSize: '12.5px', fontWeight: 500,
                background: '#059669', color: '#fff', border: 'none', cursor: 'pointer',
              }}
            >
              <FileDown className="w-4 h-4" />
              Download CSV
            </button>
          </div>
        </DialogContent>
      </Dialog>

      {/* ── Toolbar ── */}
      <div
        style={{
          background: '#fff',
          borderBottom: '1px solid #E2E8F0',
          padding: '0 20px',
          height: '52px',
          display: 'flex',
          alignItems: 'center',
          gap: '10px',
          flexShrink: 0,
        }}
      >
        {/* Left: status */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flex: 1 }}>
          {isStreaming && (
            <span
              style={{
                display: 'inline-flex', alignItems: 'center', gap: '6px',
                padding: '3px 9px', borderRadius: '20px',
                background: isPaused ? '#FFFBEB' : '#F0FDF4',
                border: `1px solid ${isPaused ? '#FDE68A' : '#BBF7D0'}`,
                color: isPaused ? '#D97706' : '#16A34A',
                fontSize: '11.5px', fontWeight: 600,
              }}
            >
              <span
                style={{
                  width: '6px', height: '6px', borderRadius: '50%',
                  background: isPaused ? '#D97706' : '#22C55E',
                  ...(isPaused ? {} : { animation: 'pulse-dot 1.5s ease-in-out infinite' }),
                }}
              />
              {isPaused ? 'Paused' : 'Live'}
            </span>
          )}
          <span style={{ fontSize: '12.5px', color: '#94A3B8' }}>
            {watchlist.length} tag{watchlist.length > 1 ? 's' : ''} in watchlist
          </span>
          {fullBuffer.length > 0 && (
            <span style={{ fontSize: '11.5px', color: '#CBD5E1' }}>
              · {maxBufferSeconds}s recorded
            </span>
          )}
        </div>

        {/* Right: actions */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          {fullBuffer.length > 0 && (
            <ToolbarBtn onClick={() => setShowExport(true)} variant="success">
              <Download className="w-3.5 h-3.5" />
              Export CSV
            </ToolbarBtn>
          )}

          <ToolbarBtn
            onClick={() => setShowSettings(p => !p)}
            variant={showSettings ? 'default' : 'default'}
          >
            <Settings2 className="w-3.5 h-3.5" />
            Settings
          </ToolbarBtn>

          {isStreaming && (
            <ToolbarBtn onClick={togglePause}>
              {isPaused
                ? <><Play  className="w-3.5 h-3.5" /> Resume</>
                : <><Pause className="w-3.5 h-3.5" /> Pause</>
              }
            </ToolbarBtn>
          )}

          {isStreaming ? (
            <ToolbarBtn onClick={stopStream} variant="danger">
              Stop
            </ToolbarBtn>
          ) : (
            <ToolbarBtn onClick={startStream} variant="primary">
              <Radio className="w-3.5 h-3.5" />
              Start Stream
            </ToolbarBtn>
          )}

          <ToolbarBtn onClick={clearWatchlist}>
            Clear All
          </ToolbarBtn>
        </div>
      </div>

      {/* ── Settings panel ── */}
      {showSettings && (
        <div
          style={{
            background: '#fff',
            borderBottom: '1px solid #E2E8F0',
            padding: '10px 20px',
            display: 'flex',
            alignItems: 'center',
            gap: '24px',
            flexShrink: 0,
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <span style={{ fontSize: '10.5px', fontWeight: 600, color: '#94A3B8', textTransform: 'uppercase', letterSpacing: '0.07em', whiteSpace: 'nowrap' }}>
              Time Window
            </span>
            <div style={{ display: 'flex', gap: '4px' }}>
              {TIME_WINDOW_OPTIONS.map(opt => (
                <Pill
                  key={opt.value}
                  active={settings.timeWindow === opt.value}
                  onClick={() => updateSettings({ timeWindow: opt.value })}
                >
                  {opt.label}
                </Pill>
              ))}
            </div>
          </div>

          <div style={{ width: '1px', height: '20px', background: '#E2E8F0' }} />

          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <span style={{ fontSize: '10.5px', fontWeight: 600, color: '#94A3B8', textTransform: 'uppercase', letterSpacing: '0.07em', whiteSpace: 'nowrap' }}>
              Update Rate
            </span>
            <div style={{ display: 'flex', gap: '4px' }}>
              {UPDATE_RATE_OPTIONS.map(opt => (
                <Pill
                  key={opt.value}
                  active={settings.updateRate === opt.value}
                  onClick={() => updateSettings({ updateRate: opt.value })}
                >
                  {opt.label}
                </Pill>
              ))}
            </div>
          </div>

          <p style={{ fontSize: '11.5px', color: '#CBD5E1', marginLeft: 'auto' }}>
            * Update rate takes effect on next stream start
          </p>
        </div>
      )}

      {/* ── Main content ── */}
      <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>

        {/* ── Left: watchlist sidebar ── */}
        <div
          style={{
            width: '220px',
            background: '#fff',
            borderRight: '1px solid #E2E8F0',
            display: 'flex',
            flexDirection: 'column',
            flexShrink: 0,
          }}
        >
          <div
            style={{
              padding: '10px 12px 8px',
              borderBottom: '1px solid #E2E8F0',
            }}
          >
            <span style={{ fontSize: '9.5px', fontWeight: 600, color: '#94A3B8', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
              Watchlist
            </span>
          </div>

          <div style={{ flex: 1, overflowY: 'auto', padding: '6px 8px' }}>
            {watchlist.map((tag, index) => {
              const reading      = readings[tag.node_id]
              const color        = CHART_COLORS[index % CHART_COLORS.length]
              const alarm        = getAlarmState(reading?.value ?? null, thresholds[tag.node_id])
              const alarmStyle   = ALARM_CARD_STYLE[alarm]
              const isHovered    = hoveredTag === tag.node_id
              const hasThreshold = !!thresholds[tag.node_id]

              let displayValue = reading?.value ?? null
              if (displayValue?.toLowerCase() === 'true')  displayValue = 'ON'
              if (displayValue?.toLowerCase() === 'false') displayValue = 'OFF'

              return (
                <div
                  key={tag.node_id}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                    padding: '7px 8px',
                    borderRadius: '7px',
                    marginBottom: '2px',
                    background: alarm === 'critical' ? '#FEF2F2'
                              : alarm === 'warning'  ? '#FFFBEB'
                              : isHovered            ? '#F8FAFC'
                              : 'transparent',
                    transition: 'background 0.1s',
                  }}
                  onMouseEnter={() => setHoveredTag(tag.node_id)}
                  onMouseLeave={() => setHoveredTag(null)}
                >
                  {/* Color dot */}
                  <span
                    style={{
                      width: '8px', height: '8px', borderRadius: '50%',
                      background: alarm !== 'normal' ? alarmStyle.accentBar : color,
                      flexShrink: 0,
                    }}
                  />

                  {/* Name + source */}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <p style={{ fontSize: '12px', fontWeight: 600, color: '#0F172A', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {tag.name}
                    </p>
                    <p style={{ fontSize: '10.5px', color: '#94A3B8', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {tag.connection_name}
                    </p>
                  </div>

                  {/* Value */}
                  {displayValue && (
                    <span
                      style={{
                        fontFamily: 'ui-monospace, monospace',
                        fontSize: '11.5px',
                        fontWeight: 600,
                        flexShrink: 0,
                        color: alarm === 'critical' ? '#DC2626' : alarm === 'warning' ? '#D97706' : '#475569',
                      }}
                    >
                      {displayValue}
                    </span>
                  )}

                  {isStreaming && !reading && (
                    <Loader2 style={{ width: '12px', height: '12px', flexShrink: 0, color: '#CBD5E1' }}
                             className="animate-spin" />
                  )}

                  {/* Threshold button — always visible if threshold set, else on hover */}
                  <button
                    onClick={() => openThresholdDialog(tag.node_id)}
                    title="Set thresholds"
                    style={{
                      flexShrink: 0,
                      padding: '2px',
                      borderRadius: '4px',
                      border: 'none',
                      background: 'transparent',
                      cursor: 'pointer',
                      color: hasThreshold ? '#6366F1' : '#CBD5E1',
                      opacity: hasThreshold || isHovered ? 1 : 0,
                      transition: 'opacity 0.15s',
                    }}
                  >
                    <SlidersHorizontal style={{ width: '13px', height: '13px' }} />
                  </button>

                  {/* Remove button — visible on hover */}
                  <button
                    onClick={() => removeTag(tag.node_id)}
                    title="Remove from watchlist"
                    style={{
                      flexShrink: 0,
                      padding: '2px',
                      borderRadius: '4px',
                      border: 'none',
                      background: 'transparent',
                      cursor: 'pointer',
                      color: '#CBD5E1',
                      opacity: isHovered ? 1 : 0,
                      transition: 'opacity 0.15s',
                    }}
                  >
                    <X style={{ width: '13px', height: '13px' }} />
                  </button>
                </div>
              )
            })}
          </div>
        </div>

        {/* ── Right: charts + value cards ── */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '20px 24px' }}>
          {!isStreaming ? (
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
                  <Activity style={{ width: '20px', height: '20px', color: '#CBD5E1' }} />
                </div>
                <p style={{ fontSize: '13.5px', fontWeight: 600, color: '#475569' }}>
                  Ready to stream
                </p>
                <p style={{ fontSize: '12px', color: '#94A3B8', marginTop: '4px' }}>
                  {watchlist.length} tag{watchlist.length > 1 ? 's' : ''} selected — click "Start Stream"
                </p>
              </div>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>

              {/* ── Value cards ── */}
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))',
                  gap: '10px',
                }}
              >
                {watchlist.map((tag, index) => {
                  const reading    = readings[tag.node_id]
                  const color      = CHART_COLORS[index % CHART_COLORS.length]
                  const alarm      = getAlarmState(reading?.value ?? null, thresholds[tag.node_id])
                  const alarmStyle = ALARM_CARD_STYLE[alarm]

                  let displayValue = reading?.value ?? '—'
                  if (displayValue.toLowerCase() === 'true')  displayValue = 'ON'
                  if (displayValue.toLowerCase() === 'false') displayValue = 'OFF'

                  return (
                    <div
                      key={tag.node_id}
                      className="group relative"
                      style={{
                        background: alarmStyle.background,
                        border: `1px solid ${alarmStyle.border}`,
                        borderLeft: `3px solid ${alarm !== 'normal' ? alarmStyle.accentBar : color}`,
                        borderRadius: '10px',
                        padding: '12px 14px',
                        boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
                        transition: 'border-color 0.2s',
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: '6px' }}>
                        <p
                          style={{
                            fontSize: '10.5px', fontWeight: 600, textTransform: 'uppercase',
                            letterSpacing: '0.05em', color: alarmStyle.labelColor,
                            overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                            flex: 1,
                          }}
                        >
                          {tag.name}
                        </p>
                        {alarm !== 'normal' && (
                          <span
                            style={{
                              fontSize: '10px', fontWeight: 700,
                              padding: '2px 6px', borderRadius: '4px',
                              background: alarmStyle.badgeBg,
                              color: alarmStyle.badgeColor,
                              marginLeft: '6px', flexShrink: 0,
                            }}
                          >
                            {alarm === 'critical' ? '⚠ CRIT' : '⚠ WARN'}
                          </span>
                        )}
                      </div>

                      <p
                        style={{
                          fontFamily: 'ui-monospace, monospace',
                          fontWeight: 700,
                          color: alarmStyle.valueColor,
                          fontSize: (displayValue === 'ON' || displayValue === 'OFF') ? '18px' : '24px',
                          letterSpacing: '-0.02em',
                          lineHeight: 1,
                        }}
                      >
                        {displayValue}
                      </p>

                      {/* Threshold button — visible on hover */}
                      <button
                        onClick={() => openThresholdDialog(tag.node_id)}
                        title="Set thresholds"
                        style={{
                          position: 'absolute', top: '8px', right: '8px',
                          padding: '3px',
                          borderRadius: '5px',
                          border: 'none',
                          background: 'rgba(255,255,255,0.8)',
                          cursor: 'pointer',
                          color: '#CBD5E1',
                          opacity: 0,
                          transition: 'opacity 0.15s',
                        }}
                        className="group-hover:opacity-100"
                      >
                        <SlidersHorizontal style={{ width: '12px', height: '12px' }} />
                      </button>

                      {reading?.error && (
                        <p style={{ fontSize: '11px', color: '#EF4444', marginTop: '4px' }}>
                          {reading.error}
                        </p>
                      )}
                    </div>
                  )
                })}
              </div>

              {/* ── Chart ── */}
              <div
                style={{
                  background: '#fff',
                  border: '1px solid #E2E8F0',
                  borderRadius: '12px',
                  padding: '16px',
                  boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
                }}
              >
                {/* Chart header */}
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '14px' }}>
                  <p style={{ fontSize: '13px', fontWeight: 600, color: '#0F172A' }}>
                    Trend — last {settings.timeWindow >= 60
                      ? `${settings.timeWindow / 60}m`
                      : `${settings.timeWindow}s`
                    }
                  </p>
                  {isPaused && (
                    <span
                      style={{
                        fontSize: '11px', fontWeight: 600,
                        padding: '3px 9px', borderRadius: '20px',
                        background: '#FFFBEB', color: '#D97706',
                        border: '1px solid #FDE68A',
                      }}
                    >
                      Paused
                    </span>
                  )}
                </div>

                <ResponsiveContainer width="100%" height={300}>
                  <LineChart data={chartData} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#F1F5F9" />
                    <XAxis
                      dataKey="time"
                      stroke="#E2E8F0"
                      tick={{ fill: '#94A3B8', fontSize: 10.5 }}
                    />
                    <YAxis
                      stroke="#E2E8F0"
                      tick={{ fill: '#94A3B8', fontSize: 10.5 }}
                    />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: '#1E293B',
                        border: 'none',
                        borderRadius: '8px',
                        fontSize: '12px',
                        boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
                      }}
                      labelStyle={{ color: '#94A3B8', marginBottom: '4px', fontSize: '11px' }}
                      itemStyle={{ color: '#F1F5F9' }}
                      formatter={(value, name) => {
                        if (value === 1) return ['ON', name]
                        if (value === 0) return ['OFF', name]
                        return [value, name]
                      }}
                    />
                    <Legend
                      wrapperStyle={{ fontSize: '11.5px', paddingTop: '8px' }}
                    />

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
