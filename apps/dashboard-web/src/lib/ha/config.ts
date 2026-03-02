/**
 * Shared HA configuration utility.
 * Single source of truth for checking whether HA env vars are set.
 * Import this instead of re-declaring the constant in each file.
 */
export const HA_CONFIGURED = !!(
  import.meta.env.VITE_HA_URL && import.meta.env.VITE_HA_TOKEN
);
