import {
  DEFAULT_APP_LOCALE,
  isAppLocale,
  translate,
  type AppLocale,
  type MessageKey,
} from '../shared/i18n';

let currentLocale: AppLocale = DEFAULT_APP_LOCALE;

/** Kept in sync with the `app.locale` setting by the IPC layer. */
export function setMainLocale(locale: string): void {
  if (isAppLocale(locale)) currentLocale = locale;
}

/** Translate a main-process message that is shown in the UI. */
export function tMain(key: MessageKey, vars?: Record<string, string | number>): string {
  return translate(currentLocale, key, vars);
}
