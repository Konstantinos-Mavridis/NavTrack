import { useState, useRef, useEffect } from 'react';
import { NavLink, useLocation } from 'react-router-dom';

export default function Navbar() {
  const [instrumentsOpen, setInstrumentsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const location = useLocation();

  const isInstrumentsActive =
    location.pathname.startsWith('/instruments') ||
    location.pathname.startsWith('/templates');

  // Close dropdown on outside click
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setInstrumentsOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Close dropdown on navigation
  useEffect(() => {
    setInstrumentsOpen(false);
  }, [location.pathname]);

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
          <div className="flex gap-1 items-center">

            {/* Portfolios */}
            <NavLink
              to="/"
              end
              className={({ isActive }) =>
                `px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                  isActive
                    ? 'bg-blue-50 text-blue-700'
                    : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50'
                }`
              }
            >
              Portfolios
            </NavLink>

            {/* Instruments dropdown */}
            <div className="relative" ref={dropdownRef}>
              <button
                onClick={() => setInstrumentsOpen((o) => !o)}
                className={`flex items-center gap-1 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                  isInstrumentsActive
                    ? 'bg-blue-50 text-blue-700'
                    : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50'
                }`}
                aria-haspopup="true"
                aria-expanded={instrumentsOpen}
              >
                Instruments
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  viewBox="0 0 20 20"
                  fill="currentColor"
                  className={`w-4 h-4 transition-transform duration-150 ${
                    instrumentsOpen ? 'rotate-180' : ''
                  }`}
                  aria-hidden="true"
                >
                  <path
                    fillRule="evenodd"
                    d="M5.23 7.21a.75.75 0 011.06.02L10 11.168l3.71-3.938a.75.75 0 111.08 1.04l-4.25 4.5a.75.75 0 01-1.08 0l-4.25-4.5a.75.75 0 01.02-1.06z"
                    clipRule="evenodd"
                  />
                </svg>
              </button>

              {instrumentsOpen && (
                <div className="absolute left-0 mt-1 w-44 bg-white border border-gray-100 rounded-lg shadow-md py-1 z-50">
                  <NavLink
                    to="/instruments"
                    end
                    className={({ isActive }) =>
                      `block px-4 py-2 text-sm transition-colors ${
                        isActive
                          ? 'text-blue-700 bg-blue-50'
                          : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50'
                      }`
                    }
                  >
                    All Instruments
                  </NavLink>
                  <NavLink
                    to="/templates"
                    className={({ isActive }) =>
                      `block px-4 py-2 text-sm transition-colors ${
                        isActive
                          ? 'text-blue-700 bg-blue-50'
                          : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50'
                      }`
                    }
                  >
                    Templates
                  </NavLink>
                </div>
              )}
            </div>

          </div>
        </div>
      </div>
    </nav>
  );
}
