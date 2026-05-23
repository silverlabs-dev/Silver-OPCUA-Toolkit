// frontend/src/pages/ConnectionsPage.tsx

import { useEffect, useState } from 'react'
import type { Connection } from '@/lib/api'
import { connectionsApi } from '@/lib/api'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { Trash2, Plus, Power, PowerOff, Loader2, Cable, AlertCircle, CheckCircle2 } from 'lucide-react'

export default function ConnectionsPage() {
  const [connections, setConnections] = useState<Connection[]>([])
  const [open, setOpen] = useState(false)
  const [name, setName] = useState('')
  const [endpoint, setEndpoint] = useState('')
  const [error, setError] = useState('')
  const [loadingId, setLoadingId] = useState<number | null>(null)
  const [connectionErrors, setConnectionErrors] = useState<Record<number, string>>({})

  const fetchConnections = async () => {
    const res = await connectionsApi.list()
    setConnections(res.data)
  }

  useEffect(() => {
    fetchConnections()
  }, [])

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

  return (
    <div className="p-8 max-w-5xl mx-auto">

      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-slate-800">OPC UA Connections</h1>
          <p className="text-slate-500 text-sm mt-1">Manage your OPC UA server connections</p>
        </div>

        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <button className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium
                               bg-indigo-500 text-white hover:bg-indigo-600 transition-colors shadow-sm">
              <Plus className="w-4 h-4" />
              Add Connection
            </button>
          </DialogTrigger>
          <DialogContent className="border border-slate-200 shadow-elevated">
            <DialogHeader>
              <DialogTitle className="text-slate-800">New OPC UA Connection</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 mt-2">
              <div className="space-y-1.5">
                <Label className="text-slate-700 font-medium">Name</Label>
                <Input
                  placeholder="e.g. Reactor PLC"
                  value={name}
                  onChange={e => setName(e.target.value)}
                  className="border-slate-200 focus:border-indigo-400 focus:ring-indigo-300"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-slate-700 font-medium">Endpoint</Label>
                <Input
                  placeholder="opc.tcp://192.168.1.100:4840"
                  value={endpoint}
                  onChange={e => setEndpoint(e.target.value)}
                  className="border-slate-200 focus:border-indigo-400 focus:ring-indigo-300 font-mono text-sm"
                />
              </div>
              {error && (
                <div className="flex items-center gap-2 text-sm text-red-600 bg-red-50 px-3 py-2 rounded-lg">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  {error}
                </div>
              )}
              <button
                onClick={handleCreate}
                className="w-full py-2 rounded-lg text-sm font-medium
                           bg-indigo-500 text-white hover:bg-indigo-600 transition-colors"
              >
                Create Connection
              </button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {/* Empty state */}
      {connections.length === 0 ? (
        <div className="card p-16 text-center">
          <Cable className="w-10 h-10 mx-auto text-slate-300 mb-3" />
          <p className="text-slate-500 font-medium">No connections yet</p>
          <p className="text-slate-400 text-sm mt-1">
            Click "Add Connection" to connect to an OPC UA server
          </p>
        </div>
      ) : (
        <div className="card overflow-hidden">
          {/* Table header */}
          <div className="grid grid-cols-[1fr_2fr_1fr_1fr_1fr] gap-4 px-5 py-3
                          bg-slate-50 border-b border-slate-100">
            {['Name', 'Endpoint', 'Status', 'Created', 'Actions'].map(h => (
              <span key={h} className="text-xs font-semibold text-slate-400 uppercase tracking-wide">
                {h}
              </span>
            ))}
          </div>

          {/* Table rows */}
          {connections.map((conn, i) => (
            <div key={conn.id}>
              <div className={`
                grid grid-cols-[1fr_2fr_1fr_1fr_1fr] gap-4 px-5 py-4 items-center
                transition-colors hover:bg-slate-50
                ${i < connections.length - 1 ? 'border-b border-slate-100' : ''}
              `}>

                {/* Name */}
                <span className="font-medium text-slate-800 text-sm truncate">
                  {conn.name}
                </span>

                {/* Endpoint */}
                <span className="font-mono text-xs text-slate-500 bg-slate-100
                                 px-2 py-1 rounded truncate">
                  {conn.endpoint}
                </span>

                {/* Status */}
                <div className="flex items-center gap-2">
                  <span className={`w-2 h-2 rounded-full shrink-0 ${
                    conn.is_active ? 'bg-green-400' : 'bg-slate-300'
                  }`} />
                  <span className={`text-xs font-medium ${
                    conn.is_active ? 'text-green-600' : 'text-slate-400'
                  }`}>
                    {conn.is_active ? 'Connected' : 'Disconnected'}
                  </span>
                  {conn.retry_count > 0 && (
                    <span className="text-xs text-red-400">
                      ({conn.retry_count} failed)
                    </span>
                  )}
                </div>

                {/* Created */}
                <span className="text-xs text-slate-400">
                  {new Date(conn.created_at).toLocaleDateString()}
                </span>

                {/* Actions */}
                <div className="flex items-center gap-2">
                  {conn.is_active ? (
                    <button
                      disabled={loadingId === conn.id}
                      onClick={() => handleDisconnect(conn.id)}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium
                                 border border-slate-200 text-slate-600 hover:bg-slate-100
                                 disabled:opacity-50 transition-colors"
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
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium
                                 border border-indigo-200 text-indigo-600 hover:bg-indigo-50
                                 disabled:opacity-50 transition-colors"
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
                    className="p-1.5 rounded-lg text-slate-400 hover:text-red-500
                               hover:bg-red-50 transition-colors"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>

              {/* Inline error row */}
              {connectionErrors[conn.id] && (
                <div className="px-5 py-2 bg-red-50 border-b border-red-100
                                flex items-center gap-2 text-xs text-red-600">
                  <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                  {connectionErrors[conn.id]}
                </div>
              )}

              {/* Last connected info */}
              {conn.last_connected_at && conn.is_active && (
                <div className="px-5 py-1.5 bg-green-50 border-b border-green-100
                                flex items-center gap-2 text-xs text-green-600">
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