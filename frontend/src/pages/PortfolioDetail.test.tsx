/**
 * Smoke tests for PortfolioDetail page.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { ThemeProvider } from '../ThemeContext';

vi.mock('../api/client', () => ({
  api: {
    portfolios: { get: vi.fn() },
    valuation:  { get: vi.fn() },
    transactions: { list: vi.fn() },
    positions: { recalculate: vi.fn() },
  },
}));

import { api } from '../api/client';
import PortfolioDetail from './PortfolioDetail';

const mockPortfolio = {
  id: 'p1',
  name: 'Growth Portfolio',
  description: '',
  createdAt: '2024-01-01T00:00:00Z',
  updatedAt: '2024-01-01T00:00:00Z',
};

const mockValuation = {
  portfolioId: 'p1',
  date: '2024-01-15',
  totalValue: 15000,
  totalCost: 12000,
  unrealisedPnl: 3000,
  unrealisedPnlPct: 25,
  positions: [],
  allocationByAssetClass: {},
  latestNavDate: '2024-01-15',
};

function renderPage(id = 'p1') {
  return render(
    <ThemeProvider>
      <MemoryRouter initialEntries={[`/portfolios/${id}`]}>
        <Routes>
          <Route path="/portfolios/:id" element={<PortfolioDetail />} />
        </Routes>
      </MemoryRouter>
    </ThemeProvider>,
  );
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe('PortfolioDetail', () => {
  it('shows a loading spinner while fetching', () => {
    vi.mocked(api.portfolios.get).mockReturnValue(new Promise(() => {}));
    vi.mocked(api.valuation.get).mockReturnValue(new Promise(() => {}));
    vi.mocked(api.transactions.list).mockReturnValue(new Promise(() => {}));

    renderPage();
    expect(screen.getByRole('status')).toBeInTheDocument();
  });

  it('renders portfolio name and summary cards after load', async () => {
    vi.mocked(api.portfolios.get).mockResolvedValue(mockPortfolio);
    vi.mocked(api.valuation.get).mockResolvedValue(mockValuation);
    vi.mocked(api.transactions.list).mockResolvedValue([]);

    renderPage();

    await waitFor(() => {
      expect(screen.getByText('Growth Portfolio')).toBeInTheDocument();
    });
    expect(screen.getByText('Total Value')).toBeInTheDocument();
    expect(screen.getByText('Unrealised P&L')).toBeInTheDocument();
  });

  it('shows the positions and transactions tabs', async () => {
    vi.mocked(api.portfolios.get).mockResolvedValue(mockPortfolio);
    vi.mocked(api.valuation.get).mockResolvedValue(mockValuation);
    vi.mocked(api.transactions.list).mockResolvedValue([]);

    renderPage();

    await waitFor(() => {
      expect(screen.getByText('Growth Portfolio')).toBeInTheDocument();
    });
    // The empty-state card is shown when there are no positions/transactions
    expect(screen.getByText(/no positions yet/i)).toBeInTheDocument();
  });

  it('shows an error banner when the API call fails', async () => {
    vi.mocked(api.portfolios.get).mockRejectedValue(new Error('Server error'));
    vi.mocked(api.valuation.get).mockRejectedValue(new Error('Server error'));
    vi.mocked(api.transactions.list).mockRejectedValue(new Error('Server error'));

    renderPage();

    await waitFor(() => {
      expect(screen.getByText(/server error/i)).toBeInTheDocument();
    });
  });

  it('shows breadcrumb link back to portfolios list', async () => {
    vi.mocked(api.portfolios.get).mockResolvedValue(mockPortfolio);
    vi.mocked(api.valuation.get).mockResolvedValue(mockValuation);
    vi.mocked(api.transactions.list).mockResolvedValue([]);

    renderPage();

    await waitFor(() => {
      expect(screen.getByText('Portfolios')).toBeInTheDocument();
    });
  });
});
