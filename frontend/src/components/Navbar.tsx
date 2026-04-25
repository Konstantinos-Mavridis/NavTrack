import { NavLink } from 'react-router-dom';
import { useTheme } from '../ThemeContext';

const links = [
  { to: '/',            label: 'Portfolios', end: false },
  { to: '/strategies',  label: 'Strategies', end: false },
];

function SunIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <circle cx="12" cy="12" r="5" />
      <path d="M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42" />
    </svg>
  );
}

function MoonIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
    </svg>
  );
}

function LogoIcon() {
  return (
    <svg
      width="22" height="22"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="text-blue-600 dark:text-blue-400"
      aria-hidden
    >
      <polyline points="22 7 13.5 15.5 8.5 10.5 2 17" />
      <polyline points="16 7 22 7 22 13" />
    </svg>
  );
}

function ThemeToggle() {
  const { theme, setTheme } = useTheme();
  return (
    <div className="flex items-center rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden">
      <button
        onClick={() => setTheme('light')}
        aria-label="Switch to light mode"
        aria-pressed={theme === 'light'}
        className={`px-3 py-1.5 text-sm font-medium transition-colors flex items-center ${
          theme === 'light'
            ? 'bg-gray-100 dark:bg-gray-700 text-gray-900 dark:text-gray-100'
            : 'text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300'
        }`}
      >
        <SunIcon />
      </button>
      <button
        onClick={() => setTheme('dark')}
        aria-label="Switch to dark mode"
        aria-pressed={theme === 'dark'}
        className={`px-3 py-1.5 text-sm font-medium transition-colors flex items-center ${
          theme === 'dark'
            ? 'bg-gray-100 dark:bg-gray-700 text-gray-900 dark:text-gray-100'
            : 'text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300'
        }`}
      >
        <MoonIcon />
      </button>
    </div>
  );
}

export default function Navbar() {
  return (
    <nav className="sticky top-0 z-40 bg-white dark:bg-gray-900 border-b border-gray-100 dark:border-gray-800 shadow-sm">
      {/*
        Full-width outer row.
        Left gutter  : flex-1, logo flush at its RIGHT edge  (justify-end)
        Centre block : max-w-5xl, nav links at LEFT edge
        Right gutter : flex-1, toggle flush at its LEFT edge (justify-start)
      */}
      <div className="flex items-center h-16">

        {/* Left gutter — flex-1, logo pushed to the right */}
        <div className="flex-1 flex items-center justify-end pr-4">
          <div className="flex items-center gap-2 shrink-0">
            <LogoIcon />
            <span className="font-bold text-gray-900 dark:text-gray-100 text-lg">NavTrack</span>
          </div>
        </div>

        {/* Centre — fixed max-w-5xl, nav links left-aligned, NO mx-auto */}
        <div className="w-full max-w-5xl shrink-0 flex items-center gap-1 px-4 sm:px-6 lg:px-8">
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

        {/* Right gutter — flex-1, toggle at its left edge */}
        <div className="flex-1 flex items-center justify-start pl-4">
          <ThemeToggle />
        </div>

      </div>
    </nav>
  );
}
