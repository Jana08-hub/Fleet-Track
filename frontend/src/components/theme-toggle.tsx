'use client';
import { useTheme } from './theme-provider';
import { Moon, Sun } from 'lucide-react';

export function ThemeToggle() {
  const { theme, toggle } = useTheme();
  return (
    <button className="btn-ghost !p-2.5" onClick={toggle} aria-label="Toggle theme">
      {theme === 'dark' ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
    </button>
  );
}
