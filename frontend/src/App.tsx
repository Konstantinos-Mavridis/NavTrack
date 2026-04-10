import { Routes, Route, Navigate } from 'react-router-dom';
import Navbar from './components/Navbar';
import PortfolioList   from './pages/PortfolioList';
import PortfolioDetail from './pages/PortfolioDetail';
import InstrumentList  from './pages/InstrumentList';
import InstrumentDetail from './pages/InstrumentDetail';
import TemplatesPage from './pages/TemplatesPage';

export default function App() {
  return (
    <div className="min-h-screen flex flex-col">
      <Navbar />
      <main className="flex-1">
        <Routes>
          <Route path="/"                        element={<PortfolioList />} />
          <Route path="/portfolios/:id"          element={<PortfolioDetail />} />
          <Route path="/instruments"             element={<InstrumentList />} />
          <Route path="/instruments/:id"         element={<InstrumentDetail />} />
          <Route path="/templates"               element={<TemplatesPage />} />
          <Route path="*"                        element={<Navigate to="/" replace />} />
        </Routes>
      </main>
      <footer className="border-t border-gray-100 py-4 text-center text-xs text-gray-400">
        NavTrack Portfolio Tracker &middot; Author:{' '}
        <a
          href="https://www.linkedin.com/in/konstantinos-mavridis"
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1 text-gray-400 hover:text-blue-600 transition-colors"
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 24 24"
            fill="currentColor"
            className="w-3 h-3"
            aria-hidden="true"
          >
            <path d="M20.447 20.452H17.21v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.987V9h3.102v1.561h.046c.432-.816 1.487-1.676 3.059-1.676 3.271 0 3.873 2.152 3.873 4.951v6.616zM5.337 7.433a1.8 1.8 0 1 1 0-3.601 1.8 1.8 0 0 1 0 3.601zm1.554 13.019H3.782V9h3.109v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.226.792 24 1.771 24h20.451C23.2 24 24 23.226 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z"/>
          </svg>
          Konstantinos Mavridis
        </a>
      </footer>
    </div>
  );
}
