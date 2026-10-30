// Per-phone display preferences: language (members' screens), text size and theme.
// Stored in app settings so they survive restarts; applied to <html> so plain CSS
// (rem-based text, html.dark overrides in index.css) does the rest.

import { createContext, ReactNode, useCallback, useContext, useEffect, useState } from 'react';
import { api } from './api';
import { useRole } from './role';
import { StringKey, translate } from './strings';

export { translate };

export type { Lang } from './strings';
import type { Lang } from './strings';
export type TextSize = 'normal' | 'large' | 'xl';
export type Theme = 'system' | 'light' | 'dark';

interface Prefs {
  lang: Lang; textSize: TextSize; theme: Theme;
  set: (k: 'ui_lang' | 'text_size' | 'theme', v: string) => Promise<void>;
}

const Ctx = createContext<Prefs>({ lang: 'en', textSize: 'normal', theme: 'system', set: async () => {} });

const FONT_PX: Record<TextSize, string> = { normal: '16px', large: '18px', xl: '20px' };

function applyTheme(theme: Theme) {
  const dark = theme === 'dark' || (theme === 'system' && window.matchMedia?.('(prefers-color-scheme: dark)').matches);
  document.documentElement.classList.toggle('dark', !!dark);
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', dark ? '#06120f' : '#0b2421');
}

export function PrefsProvider({ children }: { children: ReactNode }) {
  const [lang, setLang] = useState<Lang>('en');
  const [textSize, setTextSize] = useState<TextSize>('normal');
  const [theme, setTheme] = useState<Theme>('system');

  useEffect(() => {
    api().settings.getAll().then((s: any) => {
      if (s.ui_lang === 'ta') setLang('ta');
      if (s.text_size in FONT_PX) setTextSize(s.text_size);
      if (['light', 'dark', 'system'].includes(s.theme)) setTheme(s.theme);
    }).catch(() => {});
  }, []);

  useEffect(() => { document.documentElement.style.fontSize = FONT_PX[textSize]; }, [textSize]);
  useEffect(() => { document.documentElement.lang = lang; }, [lang]);
  useEffect(() => {
    applyTheme(theme);
    const mq = window.matchMedia?.('(prefers-color-scheme: dark)');
    const on = () => applyTheme(theme);
    mq?.addEventListener?.('change', on);
    return () => mq?.removeEventListener?.('change', on);
  }, [theme]);

  const set = useCallback(async (k: 'ui_lang' | 'text_size' | 'theme', v: string) => {
    await api().settings.set(k, v);
    if (k === 'ui_lang') setLang(v === 'ta' ? 'ta' : 'en');
    if (k === 'text_size') setTextSize(v as TextSize);
    if (k === 'theme') setTheme(v as Theme);
  }, []);

  return <Ctx.Provider value={{ lang, textSize, theme, set }}>{children}</Ctx.Provider>;
}

export const usePrefs = () => useContext(Ctx);

export type T = (key: StringKey, vars?: Record<string, string | number>) => string;

/** The language member screens use; the admin's screens are always English. */
export function useLang(): Lang {
  const { lang } = usePrefs();
  const { role } = useRole();
  return role === 'admin' ? 'en' : lang;
}

export function useT(): T {
  const lang = useLang();
  return useCallback((key, vars) => translate(lang, key, vars), [lang]);
}

/** Language used outside React (notifications) — read straight from settings. */
export async function currentLang(): Promise<Lang> {
  const s = (await api().settings.getAll()) as Record<string, string>;
  return s.ui_lang === 'ta' ? 'ta' : 'en';
}
