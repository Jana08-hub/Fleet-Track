'use client';
import { createContext, useContext, useEffect, useState } from 'react';

const Ctx = createContext<{ theme: string; toggle: () => void }>({ theme: 'light', toggle: () => {} });

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setTheme] = useState('light');
  useEffect(() => {
    const t = localStorage.getItem('ft-theme') || 'light';
    setTheme(t);
    document.documentElement.classList.toggle('dark', t === 'dark');
  }, []);
  const toggle = () => {
    const n = theme === 'dark' ? 'light' : 'dark';
    setTheme(n);
    localStorage.setItem('ft-theme', n);
    document.documentElement.classList.toggle('dark', n === 'dark');
  };
  return <Ctx.Provider value={{ theme, toggle }}>{children}</Ctx.Provider>;
}
export const useTheme = () => useContext(Ctx);
