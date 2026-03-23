'use client';

import { useTheme } from './ThemeProvider';
import { Sun, Moon } from 'lucide-react';

export default function ThemeToggle() {
  const { theme, toggleTheme } = useTheme();

  return (
    <button
      onClick={toggleTheme}
      className="relative w-9 h-9 rounded-lg flex items-center justify-center transition-colors
        bg-[var(--bg-surface-hover)] hover:bg-[var(--border-default)] text-[var(--text-secondary)]"
      title={theme === 'light' ? 'Chế độ tối' : 'Chế độ sáng'}
    >
      {theme === 'light' ? <Moon size={18} /> : <Sun size={18} />}
    </button>
  );
}
