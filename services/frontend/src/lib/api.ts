import { supabase } from './supabase'

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8080'

interface RequestOptions {
  method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE'
  body?: unknown
  headers?: Record<string, string>
}

export class APIError extends Error {
  constructor(
    public code: string,
    message: string,
    public status: number,
    public requestId?: string
  ) {
    super(message)
    this.name = 'APIError'
  }
}

async function getAuthHeader(): Promise<Record<string, string>> {
  const { data: { session } } = await supabase.auth.getSession()

  if (!session?.access_token) {
    throw new APIError('UNAUTHORIZED', 'No active session', 401)
  }

  return {
    'Authorization': `Bearer ${session.access_token}`,
  }
}

export async function api<T>(
  endpoint: string,
  options: RequestOptions = {}
): Promise<T> {
  const { method = 'GET', body, headers = {} } = options

  const authHeader = await getAuthHeader()

  const response = await fetch(`${API_URL}${endpoint}`, {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...authHeader,
      ...headers,
    },
    body: body ? JSON.stringify(body) : undefined,
  })

  const data = await response.json()

  if (!response.ok) {
    throw new APIError(
      data.error?.code || 'UNKNOWN_ERROR',
      data.error?.message || 'An error occurred',
      response.status,
      data.error?.requestId
    )
  }

  return data as T
}

// Convenience methods
export const apiGet = <T>(endpoint: string) => api<T>(endpoint)
export const apiPost = <T>(endpoint: string, body: unknown) =>
  api<T>(endpoint, { method: 'POST', body })
export const apiPut = <T>(endpoint: string, body: unknown) =>
  api<T>(endpoint, { method: 'PUT', body })
export const apiPatch = <T>(endpoint: string, body: unknown) =>
  api<T>(endpoint, { method: 'PATCH', body })
export const apiDelete = <T>(endpoint: string) =>
  api<T>(endpoint, { method: 'DELETE' })

// File upload helper (for multipart/form-data)
export async function apiUpload<T>(endpoint: string, file: File): Promise<T> {
  const authHeader = await getAuthHeader()

  const formData = new FormData()
  formData.append('file', file)

  const response = await fetch(`${API_URL}${endpoint}`, {
    method: 'POST',
    headers: {
      ...authHeader,
      // Don't set Content-Type - browser will set it with boundary
    },
    body: formData,
  })

  const data = await response.json()

  if (!response.ok) {
    throw new APIError(
      data.error?.code || 'UNKNOWN_ERROR',
      data.error?.message || 'An error occurred',
      response.status,
      data.error?.requestId
    )
  }

  return data as T
}
