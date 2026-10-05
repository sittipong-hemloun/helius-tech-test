/** Shapes returned by the NestJS API (apps/api/src/employees). Salary and dates stay strings end-to-end. */
export interface Employee {
  id: number;
  name: string;
  departmentId: string;
  departmentName: string;
  salary: string;
  joinDate: string;
  isActive: boolean;
  lastUpdatedDate: string;
  version: number;
}

export type EmployeeInput = Pick<Employee, 'name' | 'departmentId' | 'salary' | 'joinDate' | 'isActive'>;

export interface EmployeePage {
  items: Employee[];
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
}

/** HTTP error with the server's message; status 0 means the server could not be reached. */
export class ApiError extends Error {
  constructor(
    readonly status: number,
    message: string,
  ) {
    super(message);
  }
}

interface RequestOptions {
  method?: 'GET' | 'POST' | 'PATCH' | 'DELETE';
  body?: unknown;
  headers?: Record<string, string>;
  signal?: AbortSignal;
}

/** fetch to the NestJS API through the Next.js `/api` rewrite (same origin). */
export async function api<T>(path: string, { method = 'GET', body, headers, signal }: RequestOptions = {}): Promise<T> {
  let res: Response;
  try {
    res = await fetch(path, {
      method,
      signal,
      headers: body === undefined ? headers : { 'Content-Type': 'application/json', ...headers },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
  } catch (err) {
    if (signal?.aborted) throw err; // replaced by a newer request, not a failure
    throw new ApiError(0, 'Could not reach the server. Check your connection and try again.');
  }
  if (res.status === 204) return undefined as T;

  const json = await res.json().catch(() => null);
  if (!res.ok) {
    // NestJS errors look like { statusCode, message, error }; validation errors have a message array.
    const message: unknown = json?.message;
    throw new ApiError(res.status, Array.isArray(message) ? message.join(' ') : String(message ?? 'Something went wrong. Try again.'));
  }
  return json as T;
}

/** Text to show the user for an error thrown by `api`. */
export function errorMessage(err: unknown): string {
  if (err instanceof ApiError && err.status < 500) return err.message;
  return 'The server could not complete the request. Try again.';
}
