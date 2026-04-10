import { NavLink } from 'react-router-dom';

const links = [
  { to: '/',            label: 'Portfolios', end: true },
  { to: '/instruments', label: 'Instruments', end: false },
];

export default function Navbar() {
  return (
    <nav className="bg-white border-b border-gray-100 shadow-sm">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center h-16 gap-8">

          {/* Logo */}
          <div className="flex items-center gap-2 shrink-0">
            <span className="text-xl font-bold text-blue-600">📈</span>
            <span className="font-bold text-gray-900 text-lg">NavTrack</span>
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
                      ? 'bg-blue-50 text-blue-700'
                      : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50'
                  }`
                }
              >
                {l.label}
              </NavLink>
            ))}
          </div>

        </div>
      </div>
    </nav>
  );
}
