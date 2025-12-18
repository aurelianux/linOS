import { type Request, type Response, type NextFunction } from "express";

/**
 * Express middleware to set security and common HTTP headers
 * - X-Powered-By disabled (better security)
 * - X-Content-Type-Options: nosniff (prevent MIME sniffing)
 * - Referrer-Policy: strict-origin-when-cross-origin (privacy-aware)
 * - X-Frame-Options: SAMEORIGIN (allow same-origin embeds; LAN-first approach)
 */
export function headersMiddleware(
  _req: Request,
  res: Response,
  next: NextFunction
) {
  // Remove default Express header
  res.removeHeader("X-Powered-By");

  // Prevent MIME type sniffing
  res.setHeader("X-Content-Type-Options", "nosniff");

  // Privacy: send referrer only for same-origin or more secure contexts
  res.setHeader("Referrer-Policy", "strict-origin-when-cross-origin");

  // Allow same-origin embeds (LAN kiosks/dashboards)
  res.setHeader("X-Frame-Options", "SAMEORIGIN");

  next();
}
