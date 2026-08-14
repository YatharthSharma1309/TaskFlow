import type { Board, Priority, Task } from './types';

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

function isAbort(error: unknown): boolean {
  return error instanceof DOMException && error.name === 'AbortError'
    || error instanceof Error && error.name === 'AbortError';
}

async function request<T>(path: string, options: RequestOptions = {}): Promise<T> {
  let response: Response;
  try {
    response = await fetch(path, {
      method: options.method ?? 'GET',
      headers: options.body ? { 'Content-Type': 'application/json' } : undefined,
      body: options.body ? JSON.stringify(options.body) : undefined,
      signal: options.signal ?? AbortSignal.timeout(10000),
    });
  } catch (error) {
    if (isAbort(error)) throw error;
    throw new ApiError('Could not reach the server. Is the backend running?', 0);
  }

  if (response.status === 204) return undefined as T;

  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new ApiError(
      typeof payload.error === 'string' ? payload.error : `Request failed (${response.status})`,
      response.status
    );
  }

  return payload as T;
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
