import { Sun, Moon } from 'lucide-react';
import { useTheme } from '../../context/ThemeContext';

export default function ThemeToggle() {
  const { theme, toggleTheme } = useTheme();

  return (
    <button
      onClick={toggleTheme}
      className="relative w-[72px] h-9 rounded-full bg-[#E7E7E2] dark:bg-[#2A2C29] flex items-center px-1 transition-colors duration-200"
      aria-label={`Switch to ${theme === 'light' ? 'dark' : 'light'} mode`}
    >
      <div
        className={`absolute w-7 h-7 rounded-full bg-white dark:bg-[#444] shadow-md flex items-center justify-center transition-transform duration-200 ${
          theme === 'dark' ? 'translate-x-[36px]' : 'translate-x-0'
        }`}
      >
        {theme === 'light' ? (
          <Sun size={14} className="text-[#D99A25]" />
        ) : (
          <Moon size={14} className="text-[#6FA5D6]" />
        )}
      </div>
    </button>
  );
}
