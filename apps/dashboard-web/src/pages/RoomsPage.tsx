import { HA_CONFIGURED } from "@/lib/ha/config";

/**
 * Rooms page – will display HA areas/rooms once @hakit/core is fully wired.
 * Shows a helpful message when HA is not configured.
 */
export function RoomsPage() {
  return (
    <div className="p-6 space-y-6">
      <div>
        <h2 className="text-3xl font-bold text-slate-100 mb-2">Rooms</h2>
        <p className="text-slate-400">
          {HA_CONFIGURED
            ? "Loading rooms from Home Assistant…"
            : "Configure VITE_HA_URL and VITE_HA_TOKEN to view your rooms."}
        </p>
      </div>
    </div>
  );
}
