import { ReactNode } from "react";
import { SidebarNav } from "./SidebarNav";
import { Header } from "./Header";
import { BottomNav } from "./BottomNav";

export interface AppShellProps {
  children: ReactNode;
}

/**
 * Main application layout shell
 * Desktop: Sidebar on left, content on right
 * Mobile: Header top, content middle, bottom nav at bottom
 */
export function AppShell({ children }: AppShellProps) {
  return (
    <div className="h-screen w-screen flex flex-col overflow-hidden dark">
      {/* Header - visible on all sizes */}
      <Header />

      <div className="flex flex-1 overflow-hidden">
        {/* Sidebar - desktop only (md+) */}
        <aside className="hidden md:flex md:w-60 md:border-r md:border-slate-700 md:bg-slate-950">
          <SidebarNav />
        </aside>

        {/* Main content area */}
        <main className="flex-1 overflow-auto bg-slate-950">
          {children}
        </main>
      </div>

      {/* Bottom nav - mobile only (below md) */}
      <nav className="md:hidden border-t border-slate-700 bg-slate-950">
        <BottomNav />
      </nav>
    </div>
  );
}
