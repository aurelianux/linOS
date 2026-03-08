import express, { type Express, type Request } from "express";
import pinoHttp from "pino-http";
import pino from "pino";
import rateLimit from "express-rate-limit";
import { type Env } from "./config/env.js";
import { type ServicesConfig } from "./config/app-config.js";
import { headersMiddleware } from "./middleware/headers.js";
import { corsMiddleware } from "./middleware/cors.js";
import { errorMiddleware, notFoundMiddleware } from "./middleware/errors.js";
import { createRouter } from "./routes/index.js";

/** 300 req/min — generous for a local dashboard, blocks runaway pollers */
const limiter = rateLimit({
  windowMs: 60_000,
  limit: 300,
  standardHeaders: "draft-8",
  legacyHeaders: false,
});

/**
 * Create and configure Express application
 * Handles middleware setup, routing, logging, error handling
 */
export function createApp(
  env: Env,
  servicesConfig: ServicesConfig
): { app: Express; logger: pino.Logger } {
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
    if (req.url === "/health") {
      return next();
    }
    pinoHttp({ logger })(req, res, next);
  });

  // ─────────────────────────────────────
  // Middleware
  // ─────────────────────────────────────
  app.use(express.json());
  app.use(headersMiddleware);
  app.use(corsMiddleware(env));
  app.use(limiter);

  // ─────────────────────────────────────
  // Routes
  // ─────────────────────────────────────
  app.use(createRouter(servicesConfig, logger));

  // ─────────────────────────────────────
  // Error handling (must be last)
  // ─────────────────────────────────────
  app.use(notFoundMiddleware);
  app.use(errorMiddleware(logger));

  return { app, logger };
}
