import { Router } from "express";
import type pino from "pino";
import { type ServicesConfig, type DashboardConfig } from "../config/app-config.js";
import { healthRouter } from "./health.js";
import { servicesRouter } from "./services.js";
import { systemRouter } from "./system.js";
import { dashboardRouter } from "./dashboard.js";
import { adminRouter } from "./admin.js";

/**
 * Main router that aggregates all API routes
 */
export function createRouter(
  servicesConfig: ServicesConfig,
  logger: pino.Logger,
  dashboardConfig: DashboardConfig
): Router {
  const router = Router();

  router.use(healthRouter());
  router.use(servicesRouter(servicesConfig.services, logger));
  router.use(systemRouter());
  router.use(dashboardRouter(dashboardConfig));
  router.use(adminRouter(dashboardConfig, logger));

  return router;
}
