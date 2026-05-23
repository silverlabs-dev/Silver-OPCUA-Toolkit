// frontend/src/lib/api.ts

import axios from 'axios'

// In production (Docker), nginx proxies /api/ and /ws/ to backend.
// In development, we talk directly to localhost:8000.
const BASE_URL = import.meta.env.PROD ? '' : 'http://localhost:8000'
const WS_BASE  = import.meta.env.PROD
  ? `ws://${window.location.host}`
  : 'ws://localhost:8000'

const api = axios.create({
  baseURL: BASE_URL,
})

export { WS_BASE }

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

/**
 * Converts asyncua repr format to standard OPC UA node_id string.
 * Input:  "NodeId(Identifier=2, NamespaceIndex=2, NodeIdType=<NodeIdType.FourByte: 1>)"
 * Output: "ns=2;i=2"
 */
export function parseNodeId(raw: string): string {
  if (!raw.startsWith('NodeId(')) return raw

  const identifierMatch = raw.match(/Identifier=(\w+)/)
  const namespaceMatch  = raw.match(/NamespaceIndex=(\d+)/)

  if (identifierMatch && namespaceMatch) {
    const identifier = identifierMatch[1]
    const namespace  = namespaceMatch[1]
    if (/^\d+$/.test(identifier)) {
      return `ns=${namespace};i=${identifier}`
    } else {
      return `ns=${namespace};s=${identifier}`
    }
  }

  return raw
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