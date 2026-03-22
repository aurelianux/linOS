import { create } from "zustand";
import { persist } from "zustand/middleware";

interface PanelStore {
  collapsed: Record<string, boolean>;
  toggle: (key: string) => void;
  isCollapsed: (key: string) => boolean;
}

export const usePanelStore = create<PanelStore>()(
  persist(
    (set, get) => ({
      collapsed: {},
      toggle: (key) =>
        set((state) => ({
          collapsed: { ...state.collapsed, [key]: !state.collapsed[key] },
        })),
      isCollapsed: (key) => !!get().collapsed[key],
    }),
    { name: "linboard-panels" }
  )
);
