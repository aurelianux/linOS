export type LightMode = "hell" | "chill" | "aus";

export interface LightEntityState {
  state: "on" | "off";
  brightness?: number;  // 0–255
  color_temp?: number;  // mireds (153 cool → 500 very warm)
}

export type RoomModeConfig = Record<LightMode, Record<string, LightEntityState>>;

/** Maps room ID → mode → entity ID → target state. */
export type ModesConfig = Record<string, RoomModeConfig>;

/**
 * Static room lighting mode definitions.
 *
 * hell  — full brightness, warm white (370 mired ≈ 2700 K)
 * chill — dimmed, very warm (500 mired ≈ 2000 K) for atmosphere
 * aus   — all lights off
 *
 * HA entities that can be manually cleaned up after this ships:
 *   input_select.lighting_mode
 *   input_select.lighting_mode_wohnzimmer
 *   input_select.lighting_mode_kueche
 *   input_select.lighting_mode_schlafzimmer
 *   input_select.lighting_mode_flur
 * (plus any HA automations / scenes that reference them)
 */
export const MODES_CONFIG: ModesConfig = {
  wohnzimmer: {
    hell: {
      "light.bidschirm":    { state: "on", brightness: 255, color_temp: 370 },
      "light.links":        { state: "on", brightness: 255, color_temp: 370 },
      "light.rechts":       { state: "on", brightness: 255, color_temp: 370 },
      "light.notenschlussel": { state: "on", brightness: 255, color_temp: 370 },
    },
    chill: {
      "light.bidschirm":    { state: "on", brightness: 70, color_temp: 500 },
      "light.links":        { state: "on", brightness: 70, color_temp: 500 },
      "light.rechts":       { state: "off" },
      "light.notenschlussel": { state: "off" },
    },
    aus: {
      "light.bidschirm":    { state: "off" },
      "light.links":        { state: "off" },
      "light.rechts":       { state: "off" },
      "light.notenschlussel": { state: "off" },
    },
  },

  kueche: {
    hell: {
      "light.kuche": { state: "on", brightness: 255, color_temp: 250 },
    },
    chill: {
      "light.kuche": { state: "on", brightness: 80, color_temp: 370 },
    },
    aus: {
      "light.kuche": { state: "off" },
    },
  },

  schlafzimmer: {
    hell: {
      "light.nachttisch": { state: "on", brightness: 255, color_temp: 370 },
    },
    chill: {
      "light.nachttisch": { state: "on", brightness: 40, color_temp: 500 },
    },
    aus: {
      "light.nachttisch": { state: "off" },
    },
  },

  flur: {
    hell: {
      "light.flur": { state: "on", brightness: 255, color_temp: 250 },
    },
    chill: {
      "light.flur": { state: "on", brightness: 60, color_temp: 370 },
    },
    aus: {
      "light.flur": { state: "off" },
    },
  },
};
