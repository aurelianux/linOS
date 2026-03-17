import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { Language } from "@/lib/i18n/translations";

interface LanguageStore {
  language: Language;
  setLanguage: (lang: Language) => void;
}

export const useLanguageStore = create<LanguageStore>()(
  persist(
    (set) => ({
      language: "de",
      setLanguage: (language) => set({ language }),
    }),
    { name: "linboard-language" }
  )
);
