/**
 * API response envelope types
 */
export interface ApiSuccess<T> {
  ok: true;
  data: T;
}

export interface ApiError {
  ok: false;
  error: {
    message: string;
    code?: string;
  };
}

export type ApiResponse<T> = ApiSuccess<T> | ApiError;

/**
 * Health check response
 */
export interface HealthResponse {
  status: string;
}

/**
 * A single monitored service and its current probe result.
 * Returned by GET /api/services/status
 */
export interface ServiceStatus {
  id: string;
  label: string;
  category: string;
  status: "ok" | "error" | "unknown";
  latencyMs: number | null;
}

/**
 * API error class for typed error handling
 */
export class ApiErrorException extends Error {
  constructor(
    public message: string,
    public code?: string
  ) {
    super(message);
    this.name = "ApiErrorException";
  }
}
