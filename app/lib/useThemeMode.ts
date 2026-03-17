'use client';

import { useEffect, useState } from 'react';

type ThemeMode = 'light' | 'dark';

const STORAGE_KEY = 'nook-theme';

function applyTheme(mode: ThemeMode) {
  document.documentElement.dataset.theme = mode;
}

export function useThemeMode() {
  const [theme, setTheme] = useState<ThemeMode>('light');

  useEffect(() => {
    if (typeof window === 'undefined') return;

    const media = window.matchMedia('(prefers-color-scheme: dark)');
    const stored = localStorage.getItem(STORAGE_KEY);

    const syncTheme = (mode: ThemeMode) => {
      setTheme(mode);
      applyTheme(mode);
    };

    const handleChange = (event: MediaQueryListEvent) => {
      if (localStorage.getItem(STORAGE_KEY)) return;
      syncTheme(event.matches ? 'dark' : 'light');
    };

    if (stored === 'light' || stored === 'dark') {
      syncTheme(stored);
    } else {
      syncTheme(media.matches ? 'dark' : 'light');
      media.addEventListener('change', handleChange);
    }

    return () => media.removeEventListener('change', handleChange);
  }, []);

  const toggleTheme = () => {
    const next = theme === 'dark' ? 'light' : 'dark';
    if (typeof window !== 'undefined') {
      localStorage.setItem(STORAGE_KEY, next);
    }
    setTheme(next);
    applyTheme(next);
  };

  return { theme, toggleTheme };
}
