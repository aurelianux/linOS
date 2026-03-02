import { Router } from "express";
import { healthRouter } from "./health.js";
import { haRouter } from "./ha.js";
import type { HomeAssistantService } from "../services/home-assistant.js";

interface RouterServices {
  ha?: HomeAssistantService | null;
}

/**
 * Main router that aggregates all API routes
 */
export function createRouter(services: RouterServices = {}): Router {
  const router = Router();

  // Health check endpoint
  router.use(healthRouter());

  // Home Assistant proxy routes (only if HA is configured)
  if (services.ha) {
    router.use(haRouter(services.ha));
  }

  return router;
}
