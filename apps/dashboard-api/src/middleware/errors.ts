import pino from "pino";
import { type Request, type Response } from "express";

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
 * Global error handler middleware
 * Catches all errors and returns standardized JSON response
 * Logs error for debugging (prod: JSON, dev: pretty)
 */
export function errorMiddleware(logger: pino.Logger) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return (err: any, _req: Request, res: Response) => {
    // Log error for debugging
    if (err instanceof Error) {
      logger.error(
        {
          error: err.message,
          stack: err.stack,
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          statusCode: (err as any).statusCode || 500,
        },
        "Error handler caught exception"
      );
    } else {
      logger.error({ err }, "Unexpected error");
    }

    // Determine status code
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const statusCode = (err as any).statusCode || 500;

    // Send standardized error response
    const response: ApiResponse = {
      ok: false,
      error: {
        message: err.message || "Internal Server Error",
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        code: (err as any).code || "UNKNOWN_ERROR",
      },
    };

    res.status(statusCode).json(response);
  };
}

/**
 * 404 handler for unmatched routes
 */
export function notFoundMiddleware(
  _req: Request,
  res: Response
) {
  const response: ApiResponse = {
    ok: false,
    error: {
      message: "Not Found",
      code: "NOT_FOUND",
    },
  };

  res.status(404).json(response);
}
