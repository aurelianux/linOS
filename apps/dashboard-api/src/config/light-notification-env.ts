import { z } from "zod";

/**
 * Optional environment variables for the light notification service.
 * HA credentials are required only if light notification feedback is desired.
 */
const lightNotificationEnvSchema = z.object({
  /** Home Assistant base URL (e.g. http://homeassistant.local:8123) */
  LINOS_HA_URL: z.string().url().optional(),

  /** Home Assistant long-lived access token */
  LINOS_HA_TOKEN: z.string().min(1).optional(),

  /** Comma-separated HA light entity IDs for notification feedback */
  LINOS_NOTIFICATION_LIGHT_ENTITIES: z.string().optional(),
});

export type LightNotificationEnv = z.infer<typeof lightNotificationEnvSchema>;

export function loadLightNotificationEnv(): LightNotificationEnv {
  const result = lightNotificationEnvSchema.safeParse(process.env);

  if (!result.success) {
    // Light notification env is optional — log issues but don't crash
    return {
      LINOS_HA_URL: undefined,
      LINOS_HA_TOKEN: undefined,
      LINOS_NOTIFICATION_LIGHT_ENTITIES: undefined,
    };
  }

  return result.data;
}

/**
 * Parse the comma-separated light entity list into an array.
 * Returns empty array if not configured.
 */
export function parseLightEntities(raw: string | undefined): string[] {
  if (!raw) return [];
  return raw
    .split(",")
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
}

/** Check if all required vars are present for light notifications */
export function isLightNotificationConfigured(env: LightNotificationEnv): boolean {
  return !!(env.LINOS_HA_URL && env.LINOS_HA_TOKEN && env.LINOS_NOTIFICATION_LIGHT_ENTITIES);
}
