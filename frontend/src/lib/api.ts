// frontend/src/lib/api.ts

import axios from 'axios'

const api = axios.create({
  baseURL: 'http://localhost:8000',
})

export interface Connection {
  id: number
  name: string
  endpoint: string
  is_active: boolean
  created_at: string
  last_connected_at: string | null
  last_error: string | null
  retry_count: number
}

export interface ConnectionCreate {
  name: string
  endpoint: string
}

export interface NodeInfo {
  node_id: string
  name: string
  node_class: string
  value: string | null
}

export const connectionsApi = {
  list:       () => api.get<Connection[]>('/api/v1/connections/'),
  create:     (data: ConnectionCreate) => api.post<Connection>('/api/v1/connections/', data),
  delete:     (id: number) => api.delete(`/api/v1/connections/${id}`),
  connect:    (id: number) => api.post<Connection>(`/api/v1/connections/${id}/connect`),
  disconnect: (id: number) => api.post<Connection>(`/api/v1/connections/${id}/disconnect`),
}

export const tagsApi = {
  browse: (connectionId: number, nodeId?: string) =>
    api.get<NodeInfo[]>(`/api/v1/tags/${connectionId}/browse`, {
      params: nodeId ? { node_id: nodeId } : {},
    }),
}