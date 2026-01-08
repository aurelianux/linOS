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
