import { useCallback, useEffect, useState } from 'react';
import {
  DEFAULT_CARD_LANGUAGE,
  isCardLanguageCode,
  type CardLanguageCode,
} from '../../shared/cardLanguages';

const BROWSE_LANG_KEY = 'mtg-builder.card-language';

function readStoredBrowseLanguage(): CardLanguageCode {
  try {
    const raw = localStorage.getItem(BROWSE_LANG_KEY);
    if (raw && isCardLanguageCode(raw)) return raw;
  } catch {
    // ignore
  }
  return DEFAULT_CARD_LANGUAGE;
}

/**
 * Preferred card print language for browsers / search. Persists locally and in
 * app settings; available languages come from what was imported.
 */
export function useCardLanguage() {
  const [language, setLanguageState] = useState<CardLanguageCode>(readStoredBrowseLanguage);
  const [available, setAvailable] = useState<CardLanguageCode[]>([DEFAULT_CARD_LANGUAGE]);

  const refreshAvailable = useCallback(async () => {
    try {
      const langs = await window.electronAPI.getAvailableCardLanguages();
      const codes = langs.filter(isCardLanguageCode);
      const next = codes.length > 0 ? codes : [DEFAULT_CARD_LANGUAGE];
      setAvailable(next);
      setLanguageState((current) => (next.includes(current) ? current : next[0]));
    } catch {
      setAvailable([DEFAULT_CARD_LANGUAGE]);
    }
  }, []);

  useEffect(() => {
    void refreshAvailable();
    void window.electronAPI.getAppSettings().then((s) => {
      if (s.browseLanguage && isCardLanguageCode(s.browseLanguage)) {
        setLanguageState(s.browseLanguage);
        try {
          localStorage.setItem(BROWSE_LANG_KEY, s.browseLanguage);
        } catch {
          // ignore
        }
      }
    }).catch(() => {});
  }, [refreshAvailable]);

  const setLanguage = useCallback((next: CardLanguageCode) => {
    setLanguageState(next);
    try {
      localStorage.setItem(BROWSE_LANG_KEY, next);
    } catch {
      // ignore
    }
    void window.electronAPI.updateAppSettings({ browseLanguage: next }).catch(() => {});
  }, []);

  return { language, setLanguage, available, refreshAvailable };
}
