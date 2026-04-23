/**
 * Smoke tests for StrategyList page.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { ThemeProvider } from '../ThemeContext';

vi.mock('../api/client', () => ({
  api: {
    instruments: {
      list: vi.fn(),
    },
  },
}));

import { api } from '../api/client';
import StrategyList from './StrategyList';

const mockInstrument = {
  id: 'i1',
  name: 'Vanguard Global Equity',
  isin: 'IE00B3RBWM25',
  assetClass: 'EQUITY',
  riskLevel: 4,
  currency: 'EUR',
  description: '',
  createdAt: '2024-01-01T00:00:00Z',
  updatedAt: '2024-01-01T00:00:00Z',
};

function renderPage() {
  return render(
    <ThemeProvider>
      <MemoryRouter>
        <StrategyList />
      </MemoryRouter>
    </ThemeProvider>,
  );
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe('StrategyList', () => {
  it('shows a loading spinner while fetching', () => {
    vi.mocked(api.instruments.list).mockReturnValue(new Promise(() => {}));

    renderPage();
    expect(screen.getByRole('status')).toBeInTheDocument();
  });

  it('renders instrument rows after successful load', async () => {
    vi.mocked(api.instruments.list).mockResolvedValue([mockInstrument]);

    renderPage();

    await waitFor(() => {
      expect(screen.getByText('Vanguard Global Equity')).toBeInTheDocument();
    });
    expect(screen.getByText('IE00B3RBWM25')).toBeInTheDocument();
  });

  it('renders empty state when no instruments exist', async () => {
    vi.mocked(api.instruments.list).mockResolvedValue([]);

    renderPage();

    await waitFor(() => {
      expect(screen.queryByRole('status')).not.toBeInTheDocument();
    });
    expect(screen.queryByText('Vanguard Global Equity')).not.toBeInTheDocument();
  });

  it('shows an error banner when the API call fails', async () => {
    vi.mocked(api.instruments.list).mockRejectedValue(new Error('Fetch failed'));

    renderPage();

    await waitFor(() => {
      expect(screen.getByText(/fetch failed/i)).toBeInTheDocument();
    });
  });
});
