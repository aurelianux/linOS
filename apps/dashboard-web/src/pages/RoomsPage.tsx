import { mdiHomeVariant, mdiSofa, mdiBed, mdiOfficeBuilding } from "@mdi/js";
import { HA_CONFIGURED } from "@/lib/ha/config";
import { RoomCard, type RoomConfig } from "@/components/ha/RoomCard";
import { HaStatusCard } from "@/components/ha/HaStatusCard";

/**
 * Room-to-entity mapping.
 *
 * Edit this list to configure which entities appear in each room.
 * Icon paths come from @mdi/js – use mdi* named imports only.
 *
 * TODO: replace with useAreas() when @hakit/core exposes area hooks.
 */
const ROOM_CONFIG: RoomConfig[] = [
  {
    name: "Wohnzimmer",
    icon: mdiSofa,
    entityIds: [
      // "light.wohnzimmer",
      // "switch.steckdose_wohnzimmer",
      // "sensor.temperatur_wohnzimmer",
    ],
  },
  {
    name: "Schlafzimmer",
    icon: mdiBed,
    entityIds: [
      // "light.schlafzimmer",
      // "sensor.temperatur_schlafzimmer",
    ],
  },
  {
    name: "Büro",
    icon: mdiOfficeBuilding,
    entityIds: [
      // "light.buero",
      // "switch.steckdose_buero",
    ],
  },
  {
    name: "Flur",
    icon: mdiHomeVariant,
    entityIds: [
      // "light.flur",
    ],
  },
];

/**
 * Rooms page – spatial view of the smart home.
 *
 * Shows all configured rooms with their assigned entities.
 * Each room is a collapsible section containing a grid of entity cards.
 *
 * When HA is not configured, the same HA-not-configured hint as OverviewPage
 * is shown via HaStatusCard.
 */
export function RoomsPage() {
  const hasRooms = ROOM_CONFIG.some((r) => r.entityIds.length > 0);

  return (
    <div className="p-6 space-y-6">
      <div>
        <h2 className="text-3xl font-bold text-slate-100 mb-2">Rooms</h2>
        <p className="text-slate-400">
          Spatial overview of your smart home entities.
        </p>
      </div>

      {/* HA not configured – show hint card */}
      {!HA_CONFIGURED && <HaStatusCard haConfigured={false} />}

      {/* Configured rooms */}
      {HA_CONFIGURED && (
        <>
          {!hasRooms ? (
            <div className="rounded-lg border border-slate-800 bg-slate-900 px-6 py-8 text-center space-y-2">
              <p className="text-slate-300 font-medium">No rooms configured</p>
              <p className="text-sm text-slate-500">
                Add entity IDs to{" "}
                <code className="bg-slate-800 px-1 rounded text-xs text-slate-300">
                  ROOM_CONFIG
                </code>{" "}
                in{" "}
                <code className="bg-slate-800 px-1 rounded text-xs text-slate-300">
                  src/pages/RoomsPage.tsx
                </code>{" "}
                to populate this view.
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {ROOM_CONFIG.map((room) => (
                <RoomCard key={room.name} room={room} />
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}
