import { Router } from "express";
import { type ServicesConfig } from "../config/app-config.js";
import { healthRouter } from "./health.js";
import { servicesRouter } from "./services.js";
import { systemRouter } from "./system.js";

/**
 * Main router that aggregates all API routes
 */
export function createRouter(servicesConfig: ServicesConfig): Router {
  const router = Router();

  // Health check endpoint
  router.use(healthRouter());

  // Stack status monitoring endpoint
  router.use(servicesRouter(servicesConfig.services));

  // System info + Docker containers endpoints
  router.use(systemRouter());

  return router;
}
