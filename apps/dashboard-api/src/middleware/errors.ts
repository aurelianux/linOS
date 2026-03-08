import pino from "pino";
import { type Request, type Response, type NextFunction } from "express";

/**
 * Typed error class for all route handlers.
 * Throw this instead of plain Error to control HTTP status and error code.
 */
export class AppError extends Error {
  constructor(
    message: string,
    public readonly statusCode: number = 500,
    public readonly code: string = "INTERNAL_ERROR"
  ) {
    super(message);
    this.name = "AppError";
  }
}

/**
 * Standard response format for all API responses
 */
export interface ApiResponse<T = unknown> {
  ok: boolean;
  data?: T;
  error?: {
    message: string;
    code?: string;
  };
}

/**
 * Global error handler middleware.
 * err is typed as unknown — instanceof guards are used before property access.
 */
export function errorMiddleware(logger: pino.Logger) {
  return (
    err: unknown,
    _req: Request,
    res: Response,
    _next: NextFunction
  ): void => {
    if (!(err instanceof Error)) {
      logger.error({ err }, "Non-Error thrown");
      res.status(500).json({
        ok: false,
        error: { message: "Internal Server Error", code: "UNKNOWN" },
      });
      return;
    }

    const statusCode = err instanceof AppError ? err.statusCode : 500;
    const code = err instanceof AppError ? err.code : "INTERNAL_ERROR";

    logger.error(
      { message: err.message, stack: err.stack, statusCode },
      "Request error"
    );

    res.status(statusCode).json({
      ok: false,
      error: { message: err.message, code },
    });
  };
}

/**
 * 404 handler for unmatched routes
 */
export function notFoundMiddleware(_req: Request, res: Response): void {
  const response: ApiResponse = {
    ok: false,
    error: { message: "Not Found", code: "NOT_FOUND" },
  };
  res.status(404).json(response);
}
