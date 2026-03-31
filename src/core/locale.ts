/**
 * OS Locale Detection — zero-dependency, O(1).
 * Resolves once per process lifetime; cached thereafter.
 */

export type SupportedLang = "en" | "ko";

let cached: SupportedLang | null = null;

/** Detect system language. Returns 'ko' or 'en' (default). */
export function getSystemLanguage(): SupportedLang {
  if (cached) return cached;

  // 1. Intl API (most reliable, works on all modern runtimes)
  try {
    const intlLocale = Intl.DateTimeFormat().resolvedOptions().locale;
    if (intlLocale.startsWith("ko")) {
      cached = "ko";
      return cached;
    }
  } catch {
    // Fallback below
  }

  // 2. Environment variables (LANG, LC_ALL, LANGUAGE)
  const envLang = process.env.LC_ALL || process.env.LANG || process.env.LANGUAGE || "";
  if (envLang.startsWith("ko")) {
    cached = "ko";
    return cached;
  }

  cached = "en";
  return cached;
}

/** Override locale for testing. Resets on next getSystemLanguage() call if null. */
export function setLanguageOverride(lang: SupportedLang | null): void {
  cached = lang;
}
