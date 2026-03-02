import type { Env } from "../config/env.js";

/**
 * Represents the state of a single Home Assistant entity
 */
export interface HaState {
  entity_id: string;
  state: string;
  attributes: Record<string, unknown>;
  last_changed: string;
  last_updated: string;
}

/**
 * Home Assistant REST API service
 * Proxies requests to a local HA instance using a Long-Lived Access Token
 */
export class HomeAssistantService {
  private readonly baseUrl: string;
  private readonly token: string;

  constructor(haUrl: string, haToken: string) {
    this.baseUrl = haUrl.replace(/\/$/, "");
    this.token = haToken;
  }

  /**
   * Build a fully-configured HomeAssistantService from env, or return null if HA is not configured
   */
  static fromEnv(env: Env): HomeAssistantService | null {
    if (!env.HA_URL || !env.HA_TOKEN) return null;
    return new HomeAssistantService(env.HA_URL, env.HA_TOKEN);
  }

  private async request<T>(path: string, options?: RequestInit): Promise<T> {
    const url = `${this.baseUrl}/api${path}`;
    const res = await fetch(url, {
      ...options,
      headers: {
        Authorization: `Bearer ${this.token}`,
        "Content-Type": "application/json",
        ...(options?.headers ?? {}),
      },
    });

    if (!res.ok) {
      const body = await res.text().catch(() => "");
      const err = Object.assign(
        new Error(`Home Assistant API error: ${res.status} ${body}`),
        { statusCode: res.status >= 400 && res.status < 500 ? res.status : 502, code: "HA_API_ERROR" }
      );
      throw err;
    }

    return res.json() as Promise<T>;
  }

  /**
   * GET /api/states – all entity states
   */
  async getStates(): Promise<HaState[]> {
    return this.request<HaState[]>("/states");
  }

  /**
   * GET /api/states/{entity_id} – single entity state
   */
  async getState(entityId: string): Promise<HaState> {
    return this.request<HaState>(`/states/${entityId}`);
  }

  /**
   * POST /api/services/{domain}/{service} – call a HA service (e.g., light.turn_on)
   */
  async callService(
    domain: string,
    service: string,
    data: Record<string, unknown> = {}
  ): Promise<void> {
    await this.request<unknown>(`/services/${domain}/${service}`, {
      method: "POST",
      body: JSON.stringify(data),
    });
  }
}
