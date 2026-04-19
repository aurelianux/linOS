import type pino from "pino";

export const HA_CALL_TIMEOUT_MS = 5_000;
export const WATER_BOX_OFF = 200;

export async function callHaService(
  logger: pino.Logger,
  haUrl: string,
  haToken: string,
  entityId: string,
  domain: string,
  service: string,
  data?: Record<string, unknown>
): Promise<void> {
  const url = `${haUrl}/api/services/${domain}/${service}`;
  const body = { entity_id: entityId, ...data };

  try {
    const response = await fetch(url, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${haToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(HA_CALL_TIMEOUT_MS),
    });

    if (!response.ok) {
      logger.warn(
        { entityId, domain, service, status: response.status },
        "HA vacuum service call failed"
      );
    } else {
      logger.debug({ domain, service, data }, "HA vacuum service call succeeded");
    }
  } catch (err: unknown) {
    if (err instanceof Error && err.name === "AbortError") {
      logger.warn({ domain, service }, "HA vacuum service call timed out");
      return;
    }
    const msg = err instanceof Error ? err.message : String(err);
    logger.warn({ domain, service, err: msg }, "HA vacuum service call error");
  }
}

export async function fetchHaEntityState(
  logger: pino.Logger,
  haUrl: string,
  haToken: string,
  entityId: string
): Promise<string | null> {
  const url = `${haUrl}/api/states/${entityId}`;

  try {
    const response = await fetch(url, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${haToken}`,
        "Content-Type": "application/json",
      },
      signal: AbortSignal.timeout(HA_CALL_TIMEOUT_MS),
    });

    if (!response.ok) {
      logger.warn(
        { entityId, status: response.status },
        "Failed to fetch vacuum state from HA"
      );
      return null;
    }

    const data = (await response.json()) as { state?: string };
    return data.state ?? null;
  } catch (err: unknown) {
    if (err instanceof Error && err.name === "AbortError") {
      logger.warn({ entityId }, "HA state request timed out");
      return null;
    }
    const msg = err instanceof Error ? err.message : String(err);
    logger.warn({ entityId, err: msg }, "HA state request error");
    return null;
  }
}
