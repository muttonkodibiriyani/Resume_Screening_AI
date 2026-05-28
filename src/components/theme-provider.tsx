'use client';
import { createContext, useContext, useEffect, useState } from 'react';

export type Theme = 'light' | 'dark' | 'system';

interface ThemeContext {
  theme: Theme;
  resolvedTheme: 'light' | 'dark';
  setTheme: (t: Theme) => void;
}

const ThemeCtx = createContext<ThemeContext>({
  theme: 'system',
  resolvedTheme: 'light',
  setTheme: () => {},
});

const STORAGE_KEY = 'alshaya-theme';

function systemPref(): 'light' | 'dark' {
  if (typeof window === 'undefined') return 'light';
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

function apply(resolved: 'light' | 'dark'): void {
  if (typeof document === 'undefined') return;
  document.documentElement.classList.toggle('dark', resolved === 'dark');
  document.documentElement.style.colorScheme = resolved;
}

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setThemeState] = useState<Theme>('system');
  const [resolved, setResolved] = useState<'light' | 'dark'>('light');

  useEffect(() => {
    const saved = (typeof window !== 'undefined' ? localStorage.getItem(STORAGE_KEY) : null) as Theme | null;
    const initial: Theme = saved === 'light' || saved === 'dark' || saved === 'system' ? saved : 'system';
    setThemeState(initial);
    const r = initial === 'system' ? systemPref() : initial;
    setResolved(r);
    apply(r);

    const mql = window.matchMedia('(prefers-color-scheme: dark)');
    const onChange = () => {
      if ((localStorage.getItem(STORAGE_KEY) as Theme | null) === 'system') {
        const r2 = systemPref();
        setResolved(r2);
        apply(r2);
      }
    };
    mql.addEventListener('change', onChange);
    return () => mql.removeEventListener('change', onChange);
  }, []);

  const setTheme = (t: Theme): void => {
    setThemeState(t);
    if (typeof window !== 'undefined') localStorage.setItem(STORAGE_KEY, t);
    const r = t === 'system' ? systemPref() : t;
    setResolved(r);
    apply(r);
  };

  return <ThemeCtx.Provider value={{ theme, resolvedTheme: resolved, setTheme }}>{children}</ThemeCtx.Provider>;
}

export const useTheme = (): ThemeContext => useContext(ThemeCtx);
