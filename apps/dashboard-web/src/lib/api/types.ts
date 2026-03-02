/**
 * API response envelope types
 */
export interface ApiSuccess<T> {
  ok: true;
  data: T;
}

export interface ApiError {
  ok: false;
  error: {
    message: string;
    code?: string;
  };
}

export type ApiResponse<T> = ApiSuccess<T> | ApiError;

/**
 * Health check response
 */
export interface HealthResponse {
  status: string;
}

/**
 * API error class for typed error handling
 */
export class ApiErrorException extends Error {
  constructor(
    public message: string,
    public code?: string
  ) {
    super(message);
    this.name = "ApiErrorException";
  }
}

/**
 * Home Assistant entity state
 */
export interface HaEntityAttributes {
  friendly_name?: string;
  unit_of_measurement?: string;
  device_class?: string;
  icon?: string;
  // Lights
  brightness?: number;           // 0-255
  color_temp?: number;
  rgb_color?: [number, number, number];
  // Climate
  current_temperature?: number;
  temperature?: number;
  hvac_mode?: string;
  hvac_modes?: string[];
  // Allow extra attributes
  [key: string]: unknown;
}

export interface HaState {
  entity_id: string;
  state: string;
  attributes: HaEntityAttributes;
  last_changed: string;
  last_updated: string;
}

/** Entity domains that support a binary on/off toggle */
export const TOGGLEABLE_DOMAINS = new Set([
  "light",
  "switch",
  "input_boolean",
  "fan",
  "automation",
]);

/** Returns the domain part of an entity_id, e.g. "light" from "light.living_room" */
export function entityDomain(entityId: string): string {
  return entityId.split(".")[0] ?? "";
}
