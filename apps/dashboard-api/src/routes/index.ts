import { Router } from "express";
import type pino from "pino";
import { type ServicesConfig } from "../config/app-config.js";
import { healthRouter } from "./health.js";
import { servicesRouter } from "./services.js";
import { systemRouter } from "./system.js";

/**
 * Main router that aggregates all API routes
 */
export function createRouter(servicesConfig: ServicesConfig, logger: pino.Logger): Router {
  const router = Router();

  router.use(healthRouter());
  router.use(servicesRouter(servicesConfig.services, logger));
  router.use(systemRouter());

  return router;
}
