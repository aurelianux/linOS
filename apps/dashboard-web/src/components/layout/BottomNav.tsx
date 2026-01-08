import { NavLink } from "react-router-dom";
import { cn } from "../../lib/utils";

const navItems = [
  { label: "Overview", path: "/" },
  { label: "Rooms", path: "/rooms" },
  { label: "Panels", path: "/panels" },
];

/**
 * Mobile bottom navigation
 */
export function BottomNav() {
  return (
    <div className="flex justify-around items-center h-16 px-2">
      {navItems.map((item) => (
        <NavLink
          key={item.path}
          to={item.path}
          className={({ isActive }) =>
            cn(
              "flex-1 flex flex-col items-center justify-center py-2 px-3 min-h-[48px]",
              "text-xs font-medium rounded-md transition-colors",
              isActive
                ? "bg-blue-600 text-white"
                : "text-slate-400 hover:text-slate-100 hover:bg-slate-800"
            )
          }
        >
          <span>{item.label}</span>
        </NavLink>
      ))}
    </div>
  );
}
