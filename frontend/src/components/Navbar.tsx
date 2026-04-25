import { NavLink } from 'react-router-dom';
import { useTheme } from '../ThemeContext';

const links = [
  { to: '/portfolios',  label: 'Portfolios'  },
  { to: '/strategies',  label: 'Strategies'  },
  { to: '/templates',   label: 'Templates'   },
  { to: '/instruments', label: 'Instruments' },
];

export default function Navbar() {
  const { theme, toggleTheme } = useTheme();

  return (
    /*
      Layout:
        - Full-width outer bar (bg + border span edge-to-edge)
        - Inside: three zones pinned with justify-between:
            LEFT  : logo  (fixed, outside the centre block)
            CENTRE: max-w-5xl, nav links at LEFT edge
            RIGHT : theme toggle (fixed, outside the centre block)

      This keeps the nav links aligned with the max-w-5xl page containers
      while the coloured bar still bleeds to the viewport edges.
    */
    <header className="sticky top-0 z-40 w-full border-b border-gray-200 dark:border-gray-800 bg-white/90 dark:bg-gray-900/90 backdrop-blur">
      <div className="flex items-center justify-between px-4 sm:px-6 lg:px-8 h-14">

        {/* LEFT — logo, always visible */}
        <span className="text-lg font-bold text-blue-600 dark:text-blue-400 shrink-0 mr-4">
          NavTrack
        </span>

        {/* Centre — fixed max-w-5xl, nav links left-aligned, NO mx-auto */}
        <div className="w-full max-w-5xl shrink-0 flex items-center gap-1 px-4 sm:px-6 lg:px-8">
          {links.map(({ to, label }) => (
            <NavLink
              key={to}
              to={to}
              className={({ isActive }) =>
                `px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
                  isActive
                    ? 'bg-blue-50 dark:bg-blue-900/40 text-blue-600 dark:text-blue-400'
                    : 'text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800'
                }`
              }
            >
              {label}
            </NavLink>
          ))}
        </div>

        {/* RIGHT — theme toggle, always visible */}
        <button
          onClick={toggleTheme}
          className="shrink-0 ml-4 p-2 rounded-md text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
          aria-label="Toggle theme"
        >
          {theme === 'dark' ? '☀️' : '🌙'}
        </button>

      </div>
    </header>
  );
}
