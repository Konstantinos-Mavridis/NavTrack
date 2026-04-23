/**
 * Smoke tests for InstrumentDetail page.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { ThemeProvider } from '../ThemeContext';

vi.mock('../api/client', () => ({
  api: {
    instruments: {
      get: vi.fn(),
      navHistory: vi.fn(),
    },
  },
}));

import { api } from '../api/client';
import InstrumentDetail from './InstrumentDetail';

const mockInstrument = {
  id: 'i1',
  name: 'Vanguard Global Equity',
  isin: 'IE00B3RBWM25',
  assetClass: 'EQUITY',
  riskLevel: 4,
  currency: 'EUR',
  description: 'A global equity fund',
  createdAt: '2024-01-01T00:00:00Z',
  updatedAt: '2024-01-01T00:00:00Z',
};

function renderPage(id = 'i1') {
  return render(
    <ThemeProvider>
      <MemoryRouter initialEntries={[`/instruments/${id}`]}>
        <Routes>
          <Route path="/instruments/:id" element={<InstrumentDetail />} />
        </Routes>
      </MemoryRouter>
    </ThemeProvider>,
  );
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe('InstrumentDetail', () => {
  it('shows a loading spinner while fetching', () => {
    vi.mocked(api.instruments.get).mockReturnValue(new Promise(() => {}));
    vi.mocked(api.instruments.navHistory).mockReturnValue(new Promise(() => {}));

    renderPage();
    expect(screen.getByRole('status')).toBeInTheDocument();
  });

  it('renders instrument name and ISIN after load', async () => {
    vi.mocked(api.instruments.get).mockResolvedValue(mockInstrument);
    vi.mocked(api.instruments.navHistory).mockResolvedValue([]);

    renderPage();

    await waitFor(() => {
      expect(screen.getByText('Vanguard Global Equity')).toBeInTheDocument();
    });
    expect(screen.getByText('IE00B3RBWM25')).toBeInTheDocument();
  });

  it('shows an error banner when the API call fails', async () => {
    vi.mocked(api.instruments.get).mockRejectedValue(new Error('Not found'));
    vi.mocked(api.instruments.navHistory).mockRejectedValue(new Error('Not found'));

    renderPage();

    await waitFor(() => {
      expect(screen.getByText(/not found/i)).toBeInTheDocument();
    });
  });

  it('shows breadcrumb link back to strategies/instruments list', async () => {
    vi.mocked(api.instruments.get).mockResolvedValue(mockInstrument);
    vi.mocked(api.instruments.navHistory).mockResolvedValue([]);

    renderPage();

    await waitFor(() => {
      expect(screen.getByText('Vanguard Global Equity')).toBeInTheDocument();
    });
    // Breadcrumb should contain a back link
    const backLink = screen.getByRole('link', { name: /instruments|funds|strategies/i });
    expect(backLink).toBeInTheDocument();
  });
});
