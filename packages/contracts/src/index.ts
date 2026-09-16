export type ApiResponse<T> = { data: T };
export type ApiError = { error: { code: string; message: string; fieldErrors?: Record<string, string> } };

export function isApiResponse(value: unknown): value is ApiResponse<unknown> {
  return typeof value === 'object' && value !== null && 'data' in value;
}
