import { type Request, type Response, type NextFunction } from "express";

/**
 * Express middleware to set security and common HTTP headers
 * - X-Powered-By disabled (better security)
 * - X-Content-Type-Options: nosniff (prevent MIME sniffing)
 * - Referrer-Policy: strict-origin-when-cross-origin (privacy-aware)
 * - X-Frame-Options: DENY (prevent clickjacking)
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

  // Prevent embedding in iframes
  res.setHeader("X-Frame-Options", "DENY");

  next();
}
