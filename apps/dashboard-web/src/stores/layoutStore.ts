import { create } from "zustand";
import { persist } from "zustand/middleware";

export interface LayoutItem {
  i: string;
  x: number;
  y: number;
  w: number;
  h: number;
}

interface LayoutStore {
  layouts: Record<string, LayoutItem[]>;
  setLayout: (breakpoint: string, layout: LayoutItem[]) => void;
  resetLayout: () => void;
}

export const useLayoutStore = create<LayoutStore>()(
  persist(
    (set) => ({
      layouts: {},
      setLayout: (breakpoint, layout) =>
        set((state) => ({
          layouts: { ...state.layouts, [breakpoint]: layout },
        })),
      resetLayout: () => set({ layouts: {} }),
    }),
    { name: "linboard-layout" }
  )
);
