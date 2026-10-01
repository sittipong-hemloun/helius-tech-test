import type { ApiErrorBody } from '@employee-console/api-client';

export interface FieldError {
  field: string;
  code: string;
  message: string;
}

/** Normalized failure: HTTP errors keep the server code/requestId; network failures use status 0. */
export class ApiError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: string,
    message: string,
    public readonly requestId?: string | null,
    public readonly details: FieldError[] = [],
    public readonly body?: ApiErrorBody['error'],
    public readonly retryAfter?: number | null,
  ) {
    super(message);
    this.name = 'ApiError';
  }

  /** True when we cannot know whether the server applied the request. */
  get outcomeUnknown(): boolean {
    return this.status === 0;
  }
}

export interface ApiResult<T, M = Record<string, unknown>> {
  data: T;
  meta: { requestId?: string } & M;
  headers: Headers;
  status: number;
}

let csrfToken: string | null = null;
let onUnauthorized: ((code: string) => void) | null = null;

export function setCsrfToken(token: string | null): void {
  csrfToken = token;
}

export function setUnauthorizedHandler(handler: ((code: string) => void) | null): void {
  onUnauthorized = handler;
}

interface RequestOptions {
  method?: 'GET' | 'POST' | 'PATCH' | 'DELETE';
  body?: unknown;
  headers?: Record<string, string>;
  signal?: AbortSignal;
  timeoutMs?: number;
}

/** Same-origin fetch to the NestJS API through the Next.js /api rewrite. Cookies only; no tokens in storage. */
export async function api<T, M = Record<string, unknown>>(path: string, opts: RequestOptions = {}): Promise<ApiResult<T, M>> {
  const method = opts.method ?? 'GET';
  const timeout = AbortSignal.timeout(opts.timeoutMs ?? 15_000);
  const signal = opts.signal ? AbortSignal.any([opts.signal, timeout]) : timeout;
  const headers: Record<string, string> = { Accept: 'application/json', ...opts.headers };
  if (opts.body !== undefined) headers['Content-Type'] = 'application/json';
  if (method !== 'GET' && csrfToken) headers['X-CSRF-Token'] = csrfToken;

  let res: Response;
  try {
    res = await fetch(path, {
      method,
      headers,
      body: opts.body === undefined ? undefined : JSON.stringify(opts.body),
      credentials: 'same-origin',
      cache: 'no-store',
      signal,
    });
  } catch (err) {
    if (opts.signal?.aborted) throw err; // superseded by a newer request — not an error
    const timedOut = timeout.aborted;
    throw new ApiError(
      0,
      timedOut ? 'TIMEOUT' : 'NETWORK_ERROR',
      timedOut ? 'The server took too long to respond.' : 'Could not reach the server. Check your connection.',
    );
  }

  if (res.status === 204) return { data: undefined as T, meta: {} as ApiResult<T, M>['meta'], headers: res.headers, status: 204 };

  let json: unknown = null;
  try {
    json = await res.json();
  } catch {
    json = null;
  }

  if (!res.ok) {
    const err = (json as ApiErrorBody | null)?.error;
    const code = err?.code ?? (res.status >= 500 ? 'INTERNAL_ERROR' : 'HTTP_ERROR');
    if (res.status === 401 && onUnauthorized && !path.startsWith('/api/auth/providers')) onUnauthorized(code);
    const retryAfter = res.headers.get('retry-after');
    throw new ApiError(
      res.status,
      code,
      err?.message ?? 'Something went wrong. Try again.',
      err?.requestId ?? res.headers.get('x-request-id'),
      err?.details ?? [],
      err,
      retryAfter ? Number(retryAfter) : null,
    );
  }

  const body = json as { data: T; meta: ApiResult<T, M>['meta'] };
  return { data: body.data, meta: body.meta ?? {}, headers: res.headers, status: res.status };
}

/** Human message for an error, with the request ID for support when the server produced one. */
export function describeError(err: unknown): { title: string; detail?: string } {
  if (err instanceof ApiError) {
    const ref = err.requestId ? `Request ID ${err.requestId}` : undefined;
    if (err.status === 0) return { title: err.message, detail: 'Nothing was shown as saved. Check the record before trying again.' };
    if (err.status >= 500) return { title: 'The server could not complete the request. Try again.', detail: ref };
    return { title: err.message, detail: ref };
  }
  return { title: 'Something went wrong. Try again.' };
}
