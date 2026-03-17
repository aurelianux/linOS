import { NavLink } from "react-router-dom";
import { cn } from "../../lib/utils";
import { useTranslation } from "@/lib/i18n/useTranslation";
import type { TranslationKey } from "@/lib/i18n/translations";

const navItems: Array<{ labelKey: TranslationKey; path: string }> = [
  { labelKey: "nav.overview", path: "/" },
  { labelKey: "nav.rooms", path: "/rooms" },
  { labelKey: "nav.panels", path: "/panels" },
];

/**
 * Desktop sidebar navigation
 */
export function SidebarNav() {
  const { t } = useTranslation();
  return (
    <nav className="w-full flex flex-col p-4 space-y-2">
      {navItems.map((item) => (
        <NavLink
          key={item.path}
          to={item.path}
          className={({ isActive }) =>
            cn(
              "px-4 py-3 rounded-md text-sm font-medium transition-colors min-h-[44px] flex items-center",
              "hover:bg-slate-800",
              isActive
                ? "bg-blue-600 text-white"
                : "text-slate-300 hover:text-white"
            )
          }
        >
          {t(item.labelKey)}
        </NavLink>
      ))}
    </nav>
  );
}
