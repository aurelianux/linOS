import { create } from "zustand";
import { persist } from "zustand/middleware";

interface VacuumRoutineStore {
  /** Routine IDs marked as favorites for quick access */
  favoriteRoutineIds: string[];
  addFavorite: (routineId: string) => void;
  removeFavorite: (routineId: string) => void;
  isFavorite: (routineId: string) => boolean;
  toggleFavorite: (routineId: string) => void;

  /** Panel expanded state */
  isExpanded: boolean;
  setExpanded: (expanded: boolean) => void;
}

export const useVacuumRoutineStore = create<VacuumRoutineStore>()(
  persist(
    (set, get) => ({
      favoriteRoutineIds: [],

      addFavorite: (routineId: string) =>
        set((state) => {
          if (state.favoriteRoutineIds.includes(routineId)) {
            return state;
          }
          return {
            favoriteRoutineIds: [...state.favoriteRoutineIds, routineId],
          };
        }),

      removeFavorite: (routineId: string) =>
        set((state) => ({
          favoriteRoutineIds: state.favoriteRoutineIds.filter(
            (id) => id !== routineId
          ),
        })),

      isFavorite: (routineId: string) =>
        get().favoriteRoutineIds.includes(routineId),

      toggleFavorite: (routineId: string) => {
        const { isFavorite, addFavorite, removeFavorite } = get();
        if (isFavorite(routineId)) {
          removeFavorite(routineId);
        } else {
          addFavorite(routineId);
        }
      },

      isExpanded: false,
      setExpanded: (expanded: boolean) => set({ isExpanded: expanded }),
    }),
    { name: "linboard-vacuum-routines" }
  )
);
