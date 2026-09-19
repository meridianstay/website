import type { ApiErrorBody } from '../api-types'

export class ApiError extends Error {
  constructor(public status: number, message: string, public fields: Record<string, string> = {}) {
    super(message)
  }
}

/** JSON fetch against the API. Every app proxies /api to @meridian/api in dev. */
export async function request<T>(path: string, init: RequestInit & { json?: unknown } = {}): Promise<T> {
  const { json, headers, ...rest } = init
  let res: Response
  try {
    res = await fetch(`/api${path}`, {
      credentials: 'include',
      ...rest,
      headers: json === undefined ? headers : { 'Content-Type': 'application/json', ...headers },
      body: json === undefined ? rest.body : JSON.stringify(json),
    })
  } catch {
    throw new ApiError(0, 'Can’t reach Meridian Stay right now. Check your connection and try again.')
  }
  if (res.status === 204) return undefined as T
  const body = await res.json().catch(() => ({}))
  if (!res.ok) {
    const err = body as Partial<ApiErrorBody>
    throw new ApiError(res.status, err.error ?? 'Something went wrong. Please try again.', err.fields)
  }
  return body as T
}
