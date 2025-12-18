import { Router } from "express";
import { healthRouter } from "./health.js";

/**
 * Main router that aggregates all API routes
 */
export function createRouter(): Router {
  const router = Router();

  // Health check endpoint
  router.use(healthRouter());

  // Future routes:
  // - /api/rooms
  // - /api/favorites
  // - /api/actions
  // - etc.

  return router;
}
