/**
 * Smoke tests for PortfolioList page.
 *
 * Strategy: mock the api client so no HTTP calls are made.
 * Each test verifies the page renders the expected UI state.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { ThemeProvider } from '../ThemeContext';

// ── api mock ──────────────────────────────────────────────────────────────────
vi.mock('../api/client', () => ({
  api: {
    portfolios: {
      list: vi.fn(),
      aggregateSeries: vi.fn(),
    },
    valuation: {
      get: vi.fn(),
    },
  },
}));

import { api } from '../api/client';
import PortfolioList from './PortfolioList';

const mockPortfolio = {
  id: 'p1',
  name: 'My Portfolio',
  description: 'Test portfolio',
  createdAt: '2024-01-01T00:00:00Z',
  updatedAt: '2024-01-01T00:00:00Z',
};

const mockValuation = {
  portfolioId: 'p1',
  date: '2024-01-15',
  latestNavDate: '2024-01-15',
  totalValue: 1000,
  totalCost: 900,
  unrealisedPnl: 100,
  unrealisedPnlPct: 11.11,
  positions: [],
  allocationByAssetClass: {},
  allocationByInstrument: {},
};

function renderPage() {
  return render(
    <ThemeProvider>
      <MemoryRouter>
        <PortfolioList />
      </MemoryRouter>
    </ThemeProvider>,
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  // aggregateSeries and valuation.get are called after list resolves;
  // default them to never-resolve so they don't cause unhandled rejections.
  vi.mocked(api.portfolios.aggregateSeries).mockReturnValue(new Promise(() => {}));
  vi.mocked(api.valuation.get).mockReturnValue(new Promise(() => {}));
});

describe('PortfolioList', () => {
  it('shows a loading spinner while fetching', () => {
    vi.mocked(api.portfolios.list).mockReturnValue(new Promise(() => {}));

    renderPage();
    expect(screen.getByRole('status')).toBeInTheDocument();
  });

  it('renders portfolio cards after successful load', async () => {
    vi.mocked(api.portfolios.list).mockResolvedValue([mockPortfolio]);
    vi.mocked(api.portfolios.aggregateSeries).mockResolvedValue([]);
    vi.mocked(api.valuation.get).mockResolvedValue(mockValuation);

    renderPage();

    await waitFor(() => {
      expect(screen.getByText('My Portfolio')).toBeInTheDocument();
    });
  });

  it('renders an empty state when no portfolios exist', async () => {
    vi.mocked(api.portfolios.list).mockResolvedValue([]);

    renderPage();

    await waitFor(() => {
      expect(screen.queryByRole('status')).not.toBeInTheDocument();
    });
    expect(screen.queryByText('My Portfolio')).not.toBeInTheDocument();
  });

  it('shows an error banner when the API call fails', async () => {
    vi.mocked(api.portfolios.list).mockRejectedValue(new Error('Network error'));

    renderPage();

    await waitFor(() => {
      expect(screen.getByText(/network error/i)).toBeInTheDocument();
    });
  });
});
