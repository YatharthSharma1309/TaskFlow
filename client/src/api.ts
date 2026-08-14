import type { AuthUser, Board, Priority, Task } from './types';

export class ApiError extends Error {
  status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
  }
}

type RequestOptions = {
  method?: string;
  body?: unknown;
  signal?: AbortSignal;
};

let onUnauthorized: (() => void) | null = null;

export function setUnauthorizedHandler(handler: (() => void) | null) {
  onUnauthorized = handler;
}

function isAbort(error: unknown): boolean {
  return error instanceof DOMException && error.name === 'AbortError'
    || error instanceof Error && error.name === 'AbortError';
}

function requestSignal(signal?: AbortSignal): AbortSignal {
  const timeout = AbortSignal.timeout(10000);
  if (!signal) return timeout;
  const combine = AbortSignal.any;
  return typeof combine === 'function' ? combine([signal, timeout]) : signal;
}

async function request<T>(path: string, options: RequestOptions = {}): Promise<T> {
  let response: Response;
  try {
    response = await fetch(path, {
      method: options.method ?? 'GET',
      headers: options.body ? { 'Content-Type': 'application/json' } : undefined,
      body: options.body ? JSON.stringify(options.body) : undefined,
      credentials: 'include',
      signal: requestSignal(options.signal),
    });
  } catch (error) {
    if (isAbort(error)) throw error;
    throw new ApiError('Could not reach the server. Is the backend running?', 0);
  }

  if (response.status === 204) return undefined as T;

  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    const isAuthAttempt = path.startsWith('/api/auth/login') || path.startsWith('/api/auth/register');
    if (response.status === 401 && !isAuthAttempt) {
      onUnauthorized?.();
    }
    throw new ApiError(
      typeof payload.error === 'string' ? payload.error : `Request failed (${response.status})`,
      response.status
    );
  }

  return payload as T;
}

export function fetchMe(signal?: AbortSignal): Promise<AuthUser> {
  return request<AuthUser>('/api/auth/me', { signal });
}

export function login(email: string, password: string): Promise<AuthUser> {
  return request<AuthUser>('/api/auth/login', { method: 'POST', body: { email, password } });
}

export function register(email: string, password: string): Promise<AuthUser> {
  return request<AuthUser>('/api/auth/register', { method: 'POST', body: { email, password } });
}

export function logout(): Promise<void> {
  return request<void>('/api/auth/logout', { method: 'POST' });
}

export function fetchBoard(
  boardId: number,
  filters: { priority?: Priority | 'all'; q?: string } = {},
  signal?: AbortSignal
): Promise<Board> {
  const params = new URLSearchParams();
  if (filters.priority && filters.priority !== 'all') {
    params.set('priority', filters.priority);
  }
  if (filters.q?.trim()) params.set('q', filters.q.trim());
  const query = params.toString();
  return request<Board>(`/api/boards/${boardId}${query ? `?${query}` : ''}`, { signal });
}

export function createTask(input: {
  columnId: number;
  title: string;
  description?: string;
  priority?: Priority;
}): Promise<Task> {
  return request<Task>('/api/tasks', { method: 'POST', body: input });
}

export function updateTask(
  taskId: number,
  input: { title?: string; description?: string; priority?: Priority; columnId?: number }
): Promise<Task> {
  return request<Task>(`/api/tasks/${taskId}`, { method: 'PATCH', body: input });
}

export function moveTask(taskId: number, columnId: number): Promise<Task> {
  return request<Task>(`/api/tasks/${taskId}/move`, {
    method: 'PATCH',
    body: { columnId },
  });
}

export function deleteTask(taskId: number): Promise<void> {
  return request<void>(`/api/tasks/${taskId}`, { method: 'DELETE' });
}
