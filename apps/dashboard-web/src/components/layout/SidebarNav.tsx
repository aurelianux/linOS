import { NavLink } from "react-router-dom";
import { cn } from "../../lib/utils";

const navItems = [
  { label: "Overview", path: "/" },
  { label: "Rooms", path: "/rooms" },
  { label: "Panels", path: "/panels" },
];

/**
 * Desktop sidebar navigation
 */
export function SidebarNav() {
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
          {item.label}
        </NavLink>
      ))}
    </nav>
  );
}
