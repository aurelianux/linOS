import { type Request, type Response, type NextFunction } from "express";
import { type Env } from "../config/env.js";

/**
 * CORS middleware configuration
 * LAN-first approach: allows dev origin (localhost:4000) + dashboard.lan
 * Configurable via CORS_ALLOW_ORIGINS env var (comma-separated)
 */
export function corsMiddleware(env: Env) {
  return (req: Request, res: Response, next: NextFunction) => {
    const origin = req.headers.origin as string | undefined;
    const allowedOrigins = env.CORS_ALLOW_ORIGINS.split(",").map((o) =>
      o.trim()
    );

    // Allow if origin is in allowlist
    if (origin && allowedOrigins.includes(origin)) {
      res.setHeader("Access-Control-Allow-Origin", origin);
      res.setHeader(
        "Access-Control-Allow-Methods",
        "GET, POST, PUT, DELETE, OPTIONS"
      );
      res.setHeader(
        "Access-Control-Allow-Headers",
        "Content-Type, Authorization"
      );
      res.setHeader("Access-Control-Max-Age", "86400"); // 24h
    }

    // Handle preflight requests
    if (req.method === "OPTIONS") {
      return res.sendStatus(200);
    }

    next();
  };
}
