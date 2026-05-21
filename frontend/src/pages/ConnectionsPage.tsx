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
import { Trash2, Plus, Power, PowerOff } from 'lucide-react'

export default function ConnectionsPage() {
  // List of all connections fetched from the database
  const [connections, setConnections] = useState<Connection[]>([])

  // Controls whether the Add Connection dialog is open
  const [open, setOpen] = useState(false)

  // Form field values for creating a new connection
  const [name, setName] = useState('')
  const [endpoint, setEndpoint] = useState('')

  // Validation or server error message shown inside the form
  const [error, setError] = useState('')

  // Tracks which connection is currently being connected/disconnected
  // Prevents double-clicking and shows loading state
  const [loadingId, setLoadingId] = useState<number | null>(null)

  // Fetch all connections from the backend and update local state
  const fetchConnections = async () => {
    const res = await connectionsApi.list()
    setConnections(res.data)
  }

  // Fetch connections once when the component first renders
  useEffect(() => {
    fetchConnections()
  }, [])

  // Handle creating a new connection via the form
  const handleCreate = async () => {
    setError('')

    // Basic validation — both fields are required
    if (!name || !endpoint) {
      setError('All fields are required.')
      return
    }

    try {
      await connectionsApi.create({ name, endpoint })
      // Reset form and close dialog on success
      setName('')
      setEndpoint('')
      setOpen(false)
      // Refresh the list to show the new connection
      fetchConnections()
    } catch (e) {
      const err = e as { response?: { data?: { detail?: string } } }
      setError(err.response?.data?.detail || 'Something went wrong.')
    }
  }

  // Handle deleting a connection by id
  const handleDelete = async (id: number) => {
    await connectionsApi.delete(id)
    fetchConnections()
  }

  // Handle connecting to an OPC UA server
  const handleConnect = async (id: number) => {
    setLoadingId(id)
    try {
      await connectionsApi.connect(id)
      fetchConnections()
    } catch (e) {
      console.error('Failed to connect:', e)
    } finally {
      // Always clear loading state whether success or failure
      setLoadingId(null)
    }
  }

  // Handle disconnecting from an OPC UA server
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
    <div className="p-8">
      {/* Page header with title and Add Connection button */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-semibold">OPC UA Connections</h1>
          <p className="text-muted-foreground text-sm mt-1">
            Manage your OPC UA server connections
          </p>
        </div>

        {/* Dialog for adding a new connection */}
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
              {/* Show validation or server errors */}
              {error && (
                <p className="text-sm text-destructive">{error}</p>
              )}
              <Button className="w-full" onClick={handleCreate}>
                Create Connection
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {/* Connections table */}
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Name</TableHead>
            <TableHead>Endpoint</TableHead>
            <TableHead>Status</TableHead>
            <TableHead>Created</TableHead>
            <TableHead>Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {connections.map(conn => (
            <TableRow key={conn.id}>
              <TableCell className="font-medium">{conn.name}</TableCell>
              <TableCell className="font-mono text-sm">{conn.endpoint}</TableCell>

              {/* Status badge — green when connected, gray when disconnected */}
              <TableCell>
                <Badge variant={conn.is_active ? 'default' : 'secondary'}>
                  {conn.is_active ? 'Connected' : 'Disconnected'}
                </Badge>
              </TableCell>

              <TableCell className="text-muted-foreground text-sm">
                {new Date(conn.created_at).toLocaleDateString()}
              </TableCell>

              {/* Action buttons — Connect/Disconnect + Delete */}
              <TableCell className="flex items-center gap-2">
                {conn.is_active ? (
                  // Show Disconnect button when currently connected
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={loadingId === conn.id}
                    onClick={() => handleDisconnect(conn.id)}
                  >
                    <PowerOff className="w-4 h-4 mr-1" />
                    Disconnect
                  </Button>
                ) : (
                  // Show Connect button when currently disconnected
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={loadingId === conn.id}
                    onClick={() => handleConnect(conn.id)}
                  >
                    <Power className="w-4 h-4 mr-1" />
                    Connect
                  </Button>
                )}

                {/* Delete button — removes connection from database */}
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => handleDelete(conn.id)}
                >
                  <Trash2 className="w-4 h-4 text-destructive" />
                </Button>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  )
}