import type { ApiResponse } from "./types";
import { ApiErrorException } from "./types";

const API_TIMEOUT = 8000; // 8 seconds

/**
 * Get API base URL from Vite environment
 */
function getApiBase(): string {
  return import.meta.env.VITE_API_BASE ?? "/api";
}

/**
 * Fetch JSON with timeout, envelope handling, and typed responses
 * @param path - API path (without base, e.g., "/health")
 * @param options - Fetch options
 * @returns Parsed data on success
 * @throws ApiErrorException on error response or network failure
 */
export async function fetchJson<T>(
  path: string,
  options?: RequestInit
): Promise<T> {
  const apiBase = getApiBase();
  const url = `${apiBase}${path}`;

  // Setup abort controller for timeout
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), API_TIMEOUT);

  try {
    const response = await fetch(url, {
      ...options,
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    const json = (await response.json()) as ApiResponse<T>;

    if (!json.ok) {
      const error = json.error;
      throw new ApiErrorException(error.message, error.code);
    }

    return json.data;
  } catch (error) {
    clearTimeout(timeoutId);

    // Re-throw API errors as-is
    if (error instanceof Error && error.name === "ApiErrorException") {
      throw error;
    }

    // Handle abort (timeout)
    if (error instanceof Error && error.name === "AbortError") {
      throw new ApiErrorException(
        `Request timeout after ${API_TIMEOUT}ms`,
        "TIMEOUT"
      );
    }

    // Handle other errors
    if (error instanceof Error) {
      throw new ApiErrorException(
        error.message || "Unknown error",
        "NETWORK_ERROR"
      );
    }

    throw new ApiErrorException("Unknown error", "UNKNOWN");
  }
}

// Re-export error class for consumer use
export { ApiErrorException } from "./types";
