// frontend/src/pages/ConnectionsPage.tsx

import { useEffect, useState, useCallback } from 'react'
import type { Connection } from '@/lib/api'
import { connectionsApi } from '@/lib/api'
import { useWatchlist } from '@/lib/watchlist'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import {
  Trash2, Plus, Power, PowerOff, Loader2,
  Cable, AlertCircle, CheckCircle2, Server,
} from 'lucide-react'

// ── Helpers ──────────────────────────────────────────

function StatusBadge({ active }: { active: boolean }) {
  return (
    <span
      className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium"
      style={active
        ? { background: '#F0FDF4', color: '#16A34A', border: '1px solid #BBF7D0' }
        : { background: '#F8FAFC', color: '#94A3B8', border: '1px solid #E2E8F0' }
      }
    >
      <span
        className="inline-block rounded-full shrink-0"
        style={{
          width: '6px', height: '6px',
          background: active ? '#16A34A' : '#CBD5E1',
        }}
      />
      {active ? 'Connected' : 'Disconnected'}
    </span>
  )
}

// ── Page ──────────────────────────────────────────────

export default function ConnectionsPage() {
  const { removeTagsByConnection } = useWatchlist()

  const [connections, setConnections] = useState<Connection[]>([])
  const [open, setOpen] = useState(false)
  const [name, setName] = useState('')
  const [endpoint, setEndpoint] = useState('')
  const [error, setError] = useState('')
  const [loadingId, setLoadingId] = useState<number | null>(null)
  const [connectionErrors, setConnectionErrors] = useState<Record<number, string>>({})

  const fetchConnections = useCallback(async () => {
    const res = await connectionsApi.list()
    setConnections(res.data)
  }, [])

  useEffect(() => {
    fetchConnections()
  }, [fetchConnections])

  const handleCreate = async () => {
    setError('')
    if (!name || !endpoint) {
      setError('All fields are required.')
      return
    }
    try {
      await connectionsApi.create({ name, endpoint })
      setName('')
      setEndpoint('')
      setOpen(false)
      fetchConnections()
    } catch (e) {
      const err = e as { response?: { data?: { detail?: string } } }
      setError(err.response?.data?.detail || 'Something went wrong.')
    }
  }

  const handleDelete = async (id: number) => {
    removeTagsByConnection(id)
    await connectionsApi.delete(id)
    setConnectionErrors(prev => { const n = { ...prev }; delete n[id]; return n })
    fetchConnections()
  }

  const handleConnect = async (id: number) => {
    setLoadingId(id)
    setConnectionErrors(prev => { const n = { ...prev }; delete n[id]; return n })
    try {
      await connectionsApi.connect(id)
      fetchConnections()
    } catch (e) {
      const err = e as { response?: { data?: { detail?: string } } }
      const msg = err.response?.data?.detail || 'Failed to connect.'
      setConnectionErrors(prev => ({ ...prev, [id]: msg }))
      fetchConnections()
    } finally {
      setLoadingId(null)
    }
  }

  const handleDisconnect = async (id: number) => {
    setLoadingId(id)
    try {
      await connectionsApi.disconnect(id)
      fetchConnections()
    } catch (e) {
      console.error('Failed to disconnect:', e)
    } finally {
      setLoadingId(null)
    }
  }

  // ── Stats ──
  const total       = connections.length
  const connected   = connections.filter(c => c.is_active).length
  const disconnected = total - connected

  // ── Render ──────────────────────────────────────────

  return (
    <div className="p-8 max-w-5xl mx-auto">

      {/* ── Page header ── */}
      <div className="flex items-start justify-between mb-8">
        <div>
          <h1 style={{ fontSize: '20px', fontWeight: 600, color: '#0F172A', letterSpacing: '-0.02em', lineHeight: 1.2 }}>
            OPC UA Connections
          </h1>
          <p style={{ fontSize: '12.5px', color: '#94A3B8', marginTop: '4px' }}>
            Manage your OPC UA server connections
          </p>
        </div>

        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <button
              className="flex items-center gap-2 transition-colors"
              style={{
                padding: '8px 14px',
                borderRadius: '8px',
                fontSize: '12.5px',
                fontWeight: 500,
                background: '#6366F1',
                color: '#fff',
                border: 'none',
                cursor: 'pointer',
              }}
              onMouseEnter={e => (e.currentTarget.style.background = '#4F46E5')}
              onMouseLeave={e => (e.currentTarget.style.background = '#6366F1')}
            >
              <Plus className="w-3.5 h-3.5" />
              Add Connection
            </button>
          </DialogTrigger>
          <DialogContent className="border border-slate-200" style={{ borderRadius: '14px' }}>
            <DialogHeader>
              <DialogTitle style={{ fontSize: '15px', fontWeight: 600, color: '#0F172A' }}>
                New OPC UA Connection
              </DialogTitle>
            </DialogHeader>
            <div className="space-y-4 mt-2">
              <div className="space-y-1.5">
                <Label style={{ fontSize: '11.5px', fontWeight: 600, color: '#475569' }}>
                  Name
                </Label>
                <Input
                  placeholder="e.g. Reactor PLC"
                  value={name}
                  onChange={e => setName(e.target.value)}
                  className="border-slate-200 focus:border-indigo-400 focus:ring-indigo-300"
                  style={{ fontSize: '12.5px' }}
                />
              </div>
              <div className="space-y-1.5">
                <Label style={{ fontSize: '11.5px', fontWeight: 600, color: '#475569' }}>
                  Endpoint
                </Label>
                <Input
                  placeholder="opc.tcp://192.168.1.100:4840"
                  value={endpoint}
                  onChange={e => setEndpoint(e.target.value)}
                  className="border-slate-200 focus:border-indigo-400 focus:ring-indigo-300"
                  style={{ fontSize: '12px', fontFamily: 'ui-monospace, monospace' }}
                />
              </div>
              {error && (
                <div className="flex items-center gap-2 text-xs bg-red-50 px-3 py-2.5 rounded-lg"
                     style={{ color: '#DC2626', border: '1px solid #FECACA' }}>
                  <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                  {error}
                </div>
              )}
              <button
                onClick={handleCreate}
                className="w-full transition-colors"
                style={{
                  padding: '9px',
                  borderRadius: '8px',
                  fontSize: '12.5px',
                  fontWeight: 500,
                  background: '#6366F1',
                  color: '#fff',
                  border: 'none',
                  cursor: 'pointer',
                }}
              >
                Create Connection
              </button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {/* ── Stat cards ── */}
      {total > 0 && (
        <div className="grid grid-cols-3 gap-4 mb-7">
          {[
            {
              icon: <Cable className="w-4 h-4" />,
              value: total,
              label: 'Total Connections',
              iconStyle: { background: '#EEF2FF', color: '#6366F1' },
            },
            {
              icon: <CheckCircle2 className="w-4 h-4" />,
              value: connected,
              label: 'Connected',
              iconStyle: { background: '#F0FDF4', color: '#16A34A' },
              valueColor: connected > 0 ? '#16A34A' : undefined,
            },
            {
              icon: <AlertCircle className="w-4 h-4" />,
              value: disconnected,
              label: 'Disconnected',
              iconStyle: { background: '#FFFBEB', color: '#D97706' },
              valueColor: disconnected > 0 ? '#D97706' : undefined,
            },
          ].map(s => (
            <div key={s.label} className="card flex items-center gap-3 px-4 py-3.5">
              <div
                className="flex items-center justify-center shrink-0"
                style={{ width: '36px', height: '36px', borderRadius: '8px', ...s.iconStyle }}
              >
                {s.icon}
              </div>
              <div>
                <div
                  style={{
                    fontSize: '22px', fontWeight: 700, letterSpacing: '-0.03em', lineHeight: 1,
                    color: s.valueColor ?? '#0F172A',
                  }}
                >
                  {s.value}
                </div>
                <div style={{ fontSize: '11px', color: '#94A3B8', marginTop: '3px', fontWeight: 500 }}>
                  {s.label}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ── Empty state ── */}
      {connections.length === 0 ? (
        <div className="card flex flex-col items-center justify-center py-16 text-center">
          <div
            className="flex items-center justify-center mb-4"
            style={{
              width: '48px', height: '48px', borderRadius: '12px',
              background: '#F8FAFC', border: '1px solid #E2E8F0',
            }}
          >
            <Cable className="w-5 h-5" style={{ color: '#CBD5E1' }} />
          </div>
          <p style={{ fontSize: '13.5px', fontWeight: 600, color: '#475569' }}>
            No connections yet
          </p>
          <p style={{ fontSize: '12px', color: '#94A3B8', marginTop: '4px' }}>
            Click "Add Connection" to connect to an OPC UA server
          </p>
        </div>
      ) : (
        <div className="card overflow-hidden">

          {/* Table head */}
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: '1fr 2fr 130px 110px 160px',
              gap: '12px',
              padding: '9px 16px',
              background: '#F8FAFC',
              borderBottom: '1px solid #E2E8F0',
            }}
          >
            {['Name', 'Endpoint', 'Status', 'Created', 'Actions'].map(h => (
              <span
                key={h}
                style={{
                  fontSize: '10.5px', fontWeight: 600,
                  color: '#94A3B8', textTransform: 'uppercase', letterSpacing: '0.07em',
                }}
              >
                {h}
              </span>
            ))}
          </div>

          {/* Table rows */}
          {connections.map((conn, i) => (
            <div key={conn.id}>
              <div
                className="transition-colors"
                style={{
                  display: 'grid',
                  gridTemplateColumns: '1fr 2fr 130px 110px 160px',
                  gap: '12px',
                  padding: '13px 16px',
                  alignItems: 'center',
                  borderBottom: i < connections.length - 1 ? '1px solid #F1F5F9' : 'none',
                }}
                onMouseEnter={e => (e.currentTarget.style.background = '#FAFBFF')}
                onMouseLeave={e => (e.currentTarget.style.background = '')}
              >
                {/* Name */}
                <div className="flex items-center gap-2.5 min-w-0">
                  <div
                    className="flex items-center justify-center shrink-0"
                    style={{
                      width: '28px', height: '28px', borderRadius: '7px',
                      background: conn.is_active ? '#EEF2FF' : '#F8FAFC',
                      border: '1px solid',
                      borderColor: conn.is_active ? '#C7D2FE' : '#E2E8F0',
                    }}
                  >
                    <Server
                      className="w-3.5 h-3.5"
                      style={{ color: conn.is_active ? '#6366F1' : '#CBD5E1' }}
                    />
                  </div>
                  <div className="min-w-0">
                    <div style={{ fontSize: '13px', fontWeight: 600, color: '#0F172A' }}
                         className="truncate">
                      {conn.name}
                    </div>
                    {conn.retry_count > 0 && (
                      <div style={{ fontSize: '10.5px', color: '#EF4444', marginTop: '1px' }}>
                        {conn.retry_count} failed attempt{conn.retry_count > 1 ? 's' : ''}
                      </div>
                    )}
                  </div>
                </div>

                {/* Endpoint */}
                <span
                  className="truncate"
                  style={{
                    display: 'inline-block',
                    background: '#F8FAFC',
                    border: '1px solid #E2E8F0',
                    borderRadius: '5px',
                    padding: '3px 8px',
                    fontFamily: 'ui-monospace, monospace',
                    fontSize: '11.5px',
                    color: '#475569',
                    maxWidth: '100%',
                  }}
                >
                  {conn.endpoint}
                </span>

                {/* Status */}
                <StatusBadge active={conn.is_active} />

                {/* Created */}
                <span style={{ fontSize: '12px', color: '#94A3B8' }}>
                  {new Date(conn.created_at).toLocaleDateString()}
                </span>

                {/* Actions */}
                <div className="flex items-center gap-1.5">
                  {conn.is_active ? (
                    <button
                      disabled={loadingId === conn.id}
                      onClick={() => handleDisconnect(conn.id)}
                      className="flex items-center gap-1.5 transition-colors disabled:opacity-50"
                      style={{
                        padding: '5px 11px',
                        borderRadius: '7px',
                        fontSize: '12px',
                        fontWeight: 500,
                        border: '1px solid #E2E8F0',
                        background: '#fff',
                        color: '#475569',
                        cursor: 'pointer',
                      }}
                    >
                      {loadingId === conn.id
                        ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        : <PowerOff className="w-3.5 h-3.5" />
                      }
                      Disconnect
                    </button>
                  ) : (
                    <button
                      disabled={loadingId === conn.id}
                      onClick={() => handleConnect(conn.id)}
                      className="flex items-center gap-1.5 transition-colors disabled:opacity-50"
                      style={{
                        padding: '5px 11px',
                        borderRadius: '7px',
                        fontSize: '12px',
                        fontWeight: 500,
                        border: '1px solid #6366F1',
                        background: '#6366F1',
                        color: '#fff',
                        cursor: 'pointer',
                      }}
                    >
                      {loadingId === conn.id
                        ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        : <Power className="w-3.5 h-3.5" />
                      }
                      Connect
                    </button>
                  )}

                  <button
                    onClick={() => handleDelete(conn.id)}
                    className="transition-colors"
                    style={{
                      width: '30px', height: '30px',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      borderRadius: '7px',
                      border: '1px solid #E2E8F0',
                      background: '#fff',
                      color: '#CBD5E1',
                      cursor: 'pointer',
                    }}
                    onMouseEnter={e => {
                      (e.currentTarget as HTMLButtonElement).style.color = '#DC2626'
                      ;(e.currentTarget as HTMLButtonElement).style.borderColor = '#FECACA'
                      ;(e.currentTarget as HTMLButtonElement).style.background = '#FEF2F2'
                    }}
                    onMouseLeave={e => {
                      (e.currentTarget as HTMLButtonElement).style.color = '#CBD5E1'
                      ;(e.currentTarget as HTMLButtonElement).style.borderColor = '#E2E8F0'
                      ;(e.currentTarget as HTMLButtonElement).style.background = '#fff'
                    }}
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>

              {/* Error row */}
              {connectionErrors[conn.id] && (
                <div
                  className="flex items-center gap-2 px-4 py-2 text-xs"
                  style={{
                    background: '#FEF2F2',
                    borderBottom: '1px solid #FECACA',
                    color: '#DC2626',
                  }}
                >
                  <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                  {connectionErrors[conn.id]}
                </div>
              )}

              {/* Connected since row */}
              {conn.last_connected_at && conn.is_active && (
                <div
                  className="flex items-center gap-2 px-4 py-1.5 text-xs"
                  style={{
                    background: '#F0FDF4',
                    borderBottom: '1px solid #BBF7D0',
                    color: '#16A34A',
                  }}
                >
                  <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
                  Connected since {new Date(conn.last_connected_at).toLocaleTimeString()}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
