import { NavLink } from 'react-router-dom';
import { useTheme } from '../ThemeContext';

const links = [
  { to: '/',            label: 'Portfolios', end: true },
  { to: '/instruments', label: 'Instruments', end: false },
];

function ThemeToggle() {
  const { theme, setTheme } = useTheme();
  return (
    <div className="flex items-center rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden">
      <button
        onClick={() => setTheme('light')}
        aria-label="Switch to light mode"
        className={`px-3 py-1.5 text-sm font-medium transition-colors ${
          theme === 'light'
            ? 'bg-gray-100 dark:bg-gray-700 text-gray-900 dark:text-gray-100'
            : 'text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300'
        }`}
      >
        ☀️
      </button>
      <button
        onClick={() => setTheme('dark')}
        aria-label="Switch to dark mode"
        className={`px-3 py-1.5 text-sm font-medium transition-colors ${
          theme === 'dark'
            ? 'bg-gray-100 dark:bg-gray-700 text-gray-900 dark:text-gray-100'
            : 'text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300'
        }`}
      >
        🌙
      </button>
    </div>
  );
}

export default function Navbar() {
  return (
    <nav className="sticky top-0 z-40 bg-white dark:bg-gray-900 border-b border-gray-100 dark:border-gray-800 shadow-sm">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center h-16 gap-8">

          {/* Logo */}
          <div className="flex items-center gap-2 shrink-0">
            <span className="text-xl font-bold text-blue-600">📈</span>
            <span className="font-bold text-gray-900 dark:text-gray-100 text-lg">NavTrack</span>
          </div>

          {/* Nav links */}
          <div className="flex gap-1">
            {links.map((l) => (
              <NavLink
                key={l.to}
                to={l.to}
                end={l.end}
                className={({ isActive }) =>
                  `px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                    isActive
                      ? 'bg-blue-50 dark:bg-blue-950 text-blue-700 dark:text-blue-400'
                      : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100 hover:bg-gray-50 dark:hover:bg-gray-800'
                  }`
                }
              >
                {l.label}
              </NavLink>
            ))}
          </div>

          {/* Spacer */}
          <div className="flex-1" />

          {/* Theme toggle */}
          <ThemeToggle />

        </div>
      </div>
    </nav>
  );
}
