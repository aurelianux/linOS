import express, { type Express, type Request } from "express";
import pinoHttp from "pino-http";
import pino from "pino";
import { type Env } from "./config/env.js";
import { headersMiddleware } from "./middleware/headers.js";
import { corsMiddleware } from "./middleware/cors.js";
import { errorMiddleware, notFoundMiddleware } from "./middleware/errors.js";
import { createRouter } from "./routes/index.js";

/**
 * Create and configure Express application
 * Handles middleware setup, routing, logging, error handling
 */
export function createApp(env: Env): { app: Express; logger: pino.Logger } {
  // Initialize logger (dev: pretty colors, prod: JSON)
  const isDev = env.NODE_ENV === "development";
  const logger = isDev
    ? pino({
        level: env.LOG_LEVEL,
        transport: {
          target: "pino-pretty",
          options: { colorize: true },
        },
      })
    : pino({
        level: env.LOG_LEVEL,
      });

  const app = express();

  // ─────────────────────────────────────
  // Request logging (exclude /health)
  // ─────────────────────────────────────
  app.use((req: Request, res, next) => {
    // Skip logging for /health
    if (req.url === "/health") {
      return next();
    }
    // Use pino-http for all other requests
    pinoHttp({ logger })(req, res, next);
  });

  // ─────────────────────────────────────
  // Middleware
  // ─────────────────────────────────────
  app.use(express.json());
  app.use(headersMiddleware);
  app.use(corsMiddleware(env));

  // ─────────────────────────────────────
  // Routes
  // ─────────────────────────────────────
  app.use(createRouter());

  // ─────────────────────────────────────
  // Error handling (must be last)
  // ─────────────────────────────────────
  app.use(notFoundMiddleware);
  app.use(errorMiddleware(logger));

  return { app, logger };
}
