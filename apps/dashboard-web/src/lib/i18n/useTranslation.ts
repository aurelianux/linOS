import { useLanguageStore } from "@/stores/languageStore";
import { translations, type TranslationKey } from "./translations";

export function useTranslation() {
  const language = useLanguageStore((s) => s.language);
  const dict = translations[language];

  function t(key: TranslationKey, vars?: Record<string, string>): string {
    let str: string = dict[key];
    if (vars) {
      for (const [k, v] of Object.entries(vars)) {
        str = str.replace(`{${k}}`, v);
      }
    }
    return str;
  }

  return { t, language };
}
