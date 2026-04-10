import { Routes, Route, Navigate } from 'react-router-dom';
import { ThemeProvider } from './ThemeContext';
import Navbar from './components/Navbar';
import PortfolioList    from './pages/PortfolioList';
import PortfolioDetail  from './pages/PortfolioDetail';
import InstrumentList   from './pages/InstrumentList';
import InstrumentDetail from './pages/InstrumentDetail';

export default function App() {
  return (
    <ThemeProvider>
      <div className="min-h-screen flex flex-col">
        <Navbar />
        <main className="flex-1">
          <Routes>
            <Route path="/"                element={<PortfolioList />} />
            <Route path="/portfolios/:id" element={<PortfolioDetail />} />
            <Route path="/instruments"    element={<InstrumentList />} />
            <Route path="/instruments/:id" element={<InstrumentDetail />} />
            <Route path="/templates"      element={<Navigate to="/instruments" replace />} />
            <Route path="*"               element={<Navigate to="/" replace />} />
          </Routes>
        </main>

        <footer className="sticky bottom-0 z-10 border-t border-gray-100 dark:border-gray-800 py-4 bg-white dark:bg-gray-900">
          <div className="flex items-center justify-center gap-1.5 text-xs text-gray-400 dark:text-gray-500">
            <a
              href="https://github.com/Konstantinos-Mavridis/NavTrack"
              target="_blank"
              rel="noopener noreferrer"
              className="font-medium text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100 transition-colors"
            >
              NavTrack
            </a>
            <span>Portfolio Tracker &middot; Author:</span>
            <a
              href="https://www.linkedin.com/in/konstantinos-mavridis"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 hover:text-blue-600 transition-colors"
              aria-label="Konstantinos Mavridis on LinkedIn"
            >
              Konstantinos Mavridis
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-3 h-3 shrink-0" aria-hidden="true">
                <path d="M20.447 20.452H17.21v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.987V9h3.102v1.561h.046c.432-.816 1.487-1.676 3.059-1.676 3.271 0 3.873 2.152 3.873 4.951v6.616zM5.337 7.433a1.8 1.8 0 1 1 0-3.601 1.8 1.8 0 0 1 0 3.601zm1.554 13.019H3.782V9h3.109v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.226.792 24 1.771 24h20.451C23.2 24 24 23.226 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z"/>
              </svg>
            </a>
            <a
              href="https://github.com/Konstantinos-Mavridis"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center hover:text-gray-900 dark:hover:text-gray-100 transition-colors"
              aria-label="Konstantinos Mavridis on GitHub"
            >
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-3 h-3 shrink-0" aria-hidden="true">
                <path d="M12 0C5.374 0 0 5.373 0 12c0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23A11.509 11.509 0 0 1 12 5.803c1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576C20.566 21.797 24 17.3 24 12c0-6.627-5.373-12-12-12z"/>
              </svg>
            </a>
          </div>
        </footer>
      </div>
    </ThemeProvider>
  );
}
