import { z } from "zod";

/**
 * Optional environment variables for the timer feature.
 * HA credentials are required only if timer light feedback is desired.
 */
const timerEnvSchema = z.object({
  /** Home Assistant base URL (e.g. http://homeassistant.local:8123) */
  LINOS_HA_URL: z.string().url().optional(),

  /** Home Assistant long-lived access token */
  LINOS_HA_TOKEN: z.string().min(1).optional(),

  /** Comma-separated HA light entity IDs for timer progress feedback */
  LINOS_TIMER_LIGHT_ENTITIES: z.string().optional(),
});

export type TimerEnv = z.infer<typeof timerEnvSchema>;

export function loadTimerEnv(): TimerEnv {
  const result = timerEnvSchema.safeParse(process.env);

  if (!result.success) {
    // Timer env is optional — log issues but don't crash
    return {
      LINOS_HA_URL: undefined,
      LINOS_HA_TOKEN: undefined,
      LINOS_TIMER_LIGHT_ENTITIES: undefined,
    };
  }

  return result.data;
}

/**
 * Parse the comma-separated light entity list into an array.
 * Returns empty array if not configured.
 */
export function parseTimerLightEntities(raw: string | undefined): string[] {
  if (!raw) return [];
  return raw
    .split(",")
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
}
