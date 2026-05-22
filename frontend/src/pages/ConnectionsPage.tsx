// frontend/src/pages/ConnectionsPage.tsx

import { useEffect, useState } from 'react'
import type { Connection } from '@/lib/api'
import { connectionsApi } from '@/lib/api'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { Trash2, Plus, Power, PowerOff, Loader2, Cable, AlertCircle } from 'lucide-react'

export default function ConnectionsPage() {
  const [connections, setConnections] = useState<Connection[]>([])
  const [open, setOpen] = useState(false)
  const [name, setName] = useState('')
  const [endpoint, setEndpoint] = useState('')
  const [error, setError] = useState('')
  const [loadingId, setLoadingId] = useState<number | null>(null)

  // Per-connection error messages shown inline in the table
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
      fetchConnections() // Refresh to get updated retry_count
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
    <div className="p-8 max-w-6xl mx-auto">
      {/* Page header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">OPC UA Connections</h1>
          <p className="text-muted-foreground text-sm mt-1">
            Manage your OPC UA server connections
          </p>
        </div>

        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="w-4 h-4 mr-2" />
              Add Connection
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>New OPC UA Connection</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 mt-2">
              <div className="space-y-1">
                <Label>Name</Label>
                <Input
                  placeholder="e.g. Reactor PLC"
                  value={name}
                  onChange={e => setName(e.target.value)}
                />
              </div>
              <div className="space-y-1">
                <Label>Endpoint</Label>
                <Input
                  placeholder="opc.tcp://192.168.1.100:4840"
                  value={endpoint}
                  onChange={e => setEndpoint(e.target.value)}
                />
              </div>
              {error && (
                <div className="flex items-center gap-2 text-sm text-destructive">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  {error}
                </div>
              )}
              <Button className="w-full" onClick={handleCreate}>
                Create Connection
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {/* Empty state */}
      {connections.length === 0 ? (
        <div className="border-2 border-dashed rounded-xl p-16 text-center">
          <Cable className="w-10 h-10 mx-auto text-muted-foreground opacity-40 mb-3" />
          <p className="text-muted-foreground font-medium">No connections yet</p>
          <p className="text-muted-foreground text-sm mt-1">
            Click "Add Connection" to connect to an OPC UA server
          </p>
        </div>
      ) : (
        <div className="border rounded-xl overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/40">
                <TableHead className="font-semibold">Name</TableHead>
                <TableHead className="font-semibold">Endpoint</TableHead>
                <TableHead className="font-semibold">Status</TableHead>
                <TableHead className="font-semibold">Created</TableHead>
                <TableHead className="font-semibold">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {connections.map(conn => (
                <>
                  <TableRow key={conn.id} className="hover:bg-muted/20 transition-colors">
                    <TableCell className="font-medium">{conn.name}</TableCell>
                    <TableCell>
                      <span className="font-mono text-sm bg-muted px-2 py-0.5 rounded">
                        {conn.endpoint}
                      </span>
                    </TableCell>

                    <TableCell>
                      <div className="flex items-center gap-2">
                        <span className={`w-2 h-2 rounded-full ${conn.is_active ? 'bg-green-500' : 'bg-gray-300'}`} />
                        <Badge variant={conn.is_active ? 'default' : 'secondary'}>
                          {conn.is_active ? 'Connected' : 'Disconnected'}
                        </Badge>
                        {conn.retry_count > 0 && (
                          <span className="text-xs text-muted-foreground">
                            {conn.retry_count} failed attempt{conn.retry_count > 1 ? 's' : ''}
                          </span>
                        )}
                      </div>
                    </TableCell>

                    <TableCell className="text-muted-foreground text-sm">
                      {new Date(conn.created_at).toLocaleDateString()}
                    </TableCell>

                    <TableCell>
                      <div className="flex items-center gap-2">
                        {conn.is_active ? (
                          <Button
                            variant="outline"
                            size="sm"
                            disabled={loadingId === conn.id}
                            onClick={() => handleDisconnect(conn.id)}
                          >
                            {loadingId === conn.id
                              ? <Loader2 className="w-4 h-4 mr-1 animate-spin" />
                              : <PowerOff className="w-4 h-4 mr-1" />
                            }
                            Disconnect
                          </Button>
                        ) : (
                          <Button
                            variant="outline"
                            size="sm"
                            disabled={loadingId === conn.id}
                            onClick={() => handleConnect(conn.id)}
                          >
                            {loadingId === conn.id
                              ? <Loader2 className="w-4 h-4 mr-1 animate-spin" />
                              : <Power className="w-4 h-4 mr-1" />
                            }
                            Connect
                          </Button>
                        )}

                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleDelete(conn.id)}
                        >
                          <Trash2 className="w-4 h-4 text-destructive" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>

                  {/* Inline error row — shown when connect fails */}
                  {connectionErrors[conn.id] && (
                    <TableRow key={`${conn.id}-error`} className="bg-destructive/5 hover:bg-destructive/5">
                      <TableCell colSpan={5}>
                        <div className="flex items-center gap-2 text-sm text-destructive py-0.5">
                          <AlertCircle className="w-4 h-4 shrink-0" />
                          {connectionErrors[conn.id]}
                        </div>
                      </TableCell>
                    </TableRow>
                  )}
                </>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  )
}