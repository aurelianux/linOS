import type pino from "pino";

export const DEFAULT_BRIGHTNESS = 255;
export const DEFAULT_ON_MS = 500;
export const DEFAULT_OFF_MS = 500;
export const HA_CALL_TIMEOUT_MS = 3_000;

/** Internal session state */
export interface Session {
  options: {
    entityIds: string[];
    pattern: "solid" | "blink";
    color: [number, number, number];
    brightness: number;
    onMs: number;
    offMs: number;
  };
  isOn: boolean;
  blinkTimeout: ReturnType<typeof setTimeout> | null;
  expiryTimeout: ReturnType<typeof setTimeout> | null;
  abortController: AbortController;
}

export async function callLightService(
  haUrl: string,
  haToken: string,
  entityIds: string[],
  service: "turn_on" | "turn_off",
  data: Record<string, unknown> | undefined,
  signal: AbortSignal | undefined,
  logger: pino.Logger
): Promise<void> {
  const url = `${haUrl}/api/services/light/${service}`;
  const body = { entity_id: entityIds, ...data };

  const timeoutController = new AbortController();
  const timeoutId = setTimeout(() => timeoutController.abort(), HA_CALL_TIMEOUT_MS);

  if (signal?.aborted) return;

  const onSessionAbort = () => timeoutController.abort();
  signal?.addEventListener("abort", onSessionAbort, { once: true });

  try {
    const response = await fetch(url, {
      method: "POST",
      headers: { Authorization: `Bearer ${haToken}`, "Content-Type": "application/json" },
      body: JSON.stringify(body),
      signal: timeoutController.signal,
    });
    if (!response.ok) {
      logger.warn({ entityIds, service, status: response.status }, "HA light service call failed");
    }
  } catch (err: unknown) {
    if (err instanceof Error && err.name === "AbortError") return;
    const msg = err instanceof Error ? err.message : String(err);
    logger.warn({ entityIds, service, err: msg }, "HA light service call error");
  } finally {
    clearTimeout(timeoutId);
    signal?.removeEventListener("abort", onSessionAbort);
  }
}

export function applySessionColor(
  session: Session,
  haUrl: string,
  haToken: string,
  logger: pino.Logger
): void {
  callLightService(
    haUrl,
    haToken,
    session.options.entityIds,
    "turn_on",
    { rgb_color: session.options.color, brightness: session.options.brightness },
    session.abortController.signal,
    logger
  ).catch(() => {});
}

export async function executeLightBlink(
  sessionId: string,
  sessions: Map<string, Session>,
  haUrl: string,
  haToken: string,
  logger: pino.Logger
): Promise<void> {
  const session = sessions.get(sessionId);
  if (!session) return;

  session.isOn = !session.isOn;

  if (session.isOn) {
    await callLightService(
      haUrl, haToken,
      session.options.entityIds, "turn_on",
      { rgb_color: session.options.color, brightness: session.options.brightness },
      session.abortController.signal, logger
    );
  } else {
    await callLightService(
      haUrl, haToken,
      session.options.entityIds, "turn_off",
      undefined, session.abortController.signal, logger
    );
  }

  if (!sessions.has(sessionId)) return;

  const delay = session.isOn ? session.options.onMs : session.options.offMs;
  session.blinkTimeout = setTimeout(() => {
    executeLightBlink(sessionId, sessions, haUrl, haToken, logger).catch(() => {});
  }, delay);
}
