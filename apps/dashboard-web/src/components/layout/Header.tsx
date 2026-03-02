import { HaStatusIndicator } from "@/components/ha/HaStatusIndicator";

const HA_CONFIGURED = !!(
  import.meta.env.VITE_HA_URL && import.meta.env.VITE_HA_TOKEN
);

/**
 * Header component - app title and top-level branding
 */
export function Header() {
  return (
    <header className="flex items-center justify-between h-16 px-6 border-b border-slate-700 bg-slate-950 shrink-0">
      <h1 className="text-2xl font-bold text-slate-100">linBoard</h1>
      <div className="flex items-center gap-4">
        {HA_CONFIGURED && <HaStatusIndicator />}
        <div className="text-sm text-slate-400">v0.1</div>
      </div>
    </header>
  );
}
