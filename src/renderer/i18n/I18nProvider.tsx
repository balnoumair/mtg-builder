import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import {
  DEFAULT_APP_LOCALE,
  isAppLocale,
  translate,
  type AppLocale,
  type MessageKey,
} from '../../shared/i18n';

const LOCALE_STORAGE_KEY = 'mtg-builder.locale';

function readStoredLocale(): AppLocale {
  try {
    const raw = localStorage.getItem(LOCALE_STORAGE_KEY);
    if (raw && isAppLocale(raw)) return raw;
  } catch {
    // ignore
  }
  return DEFAULT_APP_LOCALE;
}

interface I18nContextValue {
  locale: AppLocale;
  setLocale: (locale: AppLocale) => void;
  t: (key: MessageKey, vars?: Record<string, string | number>) => string;
}

const I18nContext = createContext<I18nContextValue | null>(null);

export function I18nProvider({ children }: { children: ReactNode }) {
  const [locale, setLocaleState] = useState<AppLocale>(readStoredLocale);

  useEffect(() => {
    let cancelled = false;
    window.electronAPI.getAppSettings?.()
      .then((settings) => {
        if (cancelled || !settings?.locale || !isAppLocale(settings.locale)) return;
        setLocaleState(settings.locale);
        try {
          localStorage.setItem(LOCALE_STORAGE_KEY, settings.locale);
        } catch {
          // ignore
        }
      })
      .catch(() => {
        // Settings IPC may be unavailable during early boot; localStorage is enough.
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const setLocale = useCallback((next: AppLocale) => {
    setLocaleState(next);
    try {
      localStorage.setItem(LOCALE_STORAGE_KEY, next);
    } catch {
      // ignore
    }
    void window.electronAPI.updateAppSettings?.({ locale: next }).catch(() => {});
  }, []);

  const t = useCallback(
    (key: MessageKey, vars?: Record<string, string | number>) => translate(locale, key, vars),
    [locale],
  );

  const value = useMemo(() => ({ locale, setLocale, t }), [locale, setLocale, t]);

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

const FALLBACK: I18nContextValue = {
  locale: DEFAULT_APP_LOCALE,
  setLocale: () => {},
  t: (key, vars) => translate(DEFAULT_APP_LOCALE, key, vars),
};

/** Outside a provider (isolated component tests) this renders English. */
export function useI18n(): I18nContextValue {
  return useContext(I18nContext) ?? FALLBACK;
}
