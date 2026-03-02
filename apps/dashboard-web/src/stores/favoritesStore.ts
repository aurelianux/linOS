import { create } from "zustand";
import { persist } from "zustand/middleware";

interface FavoritesStore {
  favorites: string[];
  addFavorite: (entityId: string) => void;
  removeFavorite: (entityId: string) => void;
  isFavorite: (entityId: string) => boolean;
}

export const useFavoritesStore = create<FavoritesStore>()(
  persist(
    (set, get) => ({
      favorites: [],
      addFavorite: (entityId) =>
        set((state) => ({
          favorites: state.favorites.includes(entityId)
            ? state.favorites
            : [...state.favorites, entityId],
        })),
      removeFavorite: (entityId) =>
        set((state) => ({
          favorites: state.favorites.filter((id) => id !== entityId),
        })),
      isFavorite: (entityId) => get().favorites.includes(entityId),
    }),
    { name: "linboard-favorites" }
  )
);
