/** Success body wrapper; the interceptor fills meta.requestId (PRD §10.1). */
export class ApiResponse<T> {
  constructor(
    public readonly data: T,
    public readonly meta: Record<string, unknown> = {},
  ) {}
}

export function respond<T>(data: T, meta: Record<string, unknown> = {}): ApiResponse<T> {
  return new ApiResponse(data, meta);
}
