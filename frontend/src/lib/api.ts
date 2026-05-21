import axios from 'axios'

// Create a reusable axios instance with the backend base URL
const api = axios.create({
  baseURL: 'http://localhost:8000',
})

// TypeScript interface representing an OPC UA connection record from the database
export interface Connection {
  id: number
  name: string
  endpoint: string
  is_active: boolean
  created_at: string
}

// Data required to create a new connection
export interface ConnectionCreate {
  name: string
  endpoint: string
}

// TypeScript interface representing a single OPC UA node
export interface NodeInfo {
  node_id: string     // Unique OPC UA node identifier
  name: string        // Display name
  node_class: string  // "Object" (folder) or "Variable" (tag with value)
  value: string | null // Current value — null for Object nodes
}

// All API calls related to OPC UA connections
export const connectionsApi = {
  list: () => api.get<Connection[]>('/api/v1/connections/'),
  create: (data: ConnectionCreate) => api.post<Connection>('/api/v1/connections/', data),
  delete: (id: number) => api.delete(`/api/v1/connections/${id}`),
  connect: (id: number) => api.post<Connection>(`/api/v1/connections/${id}/connect`),
  disconnect: (id: number) => api.post<Connection>(`/api/v1/connections/${id}/disconnect`),
}

// All API calls related to OPC UA tag browsing
export const tagsApi = {
  // Browse children of a node — if node_id is omitted, starts from root Objects folder
  browse: (connectionId: number, nodeId?: string) =>
    api.get<NodeInfo[]>(`/api/v1/tags/${connectionId}/browse`, {
      params: nodeId ? { node_id: nodeId } : {},
    }),
}