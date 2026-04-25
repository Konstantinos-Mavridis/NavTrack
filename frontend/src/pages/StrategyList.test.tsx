/**
 * Smoke tests for StrategyList page.
 * Strategies are backed by AllocationTemplates; the mock uses api.templates.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { ThemeProvider } from '../ThemeContext';

vi.mock('../api/client', () => ({
  api: {
    templates: {
      list: vi.fn(),
    },
    instruments: {
      list: vi.fn(),
    },
  },
}));

// Stub the modal so Vite doesn't need to resolve its own deps in tests.
vi.mock('../components/StrategyFormModal', () => ({
  default: () => null,
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
    vi.mocked(api.templates.list).mockReturnValue(new Promise(() => {}));
    vi.mocked(api.instruments.list).mockReturnValue(new Promise(() => {}));

    renderPage();
    expect(screen.getByRole('status')).toBeInTheDocument();
  });

  it('renders empty state when no strategies exist', async () => {
    vi.mocked(api.templates.list).mockResolvedValue([]);
    vi.mocked(api.instruments.list).mockResolvedValue([mockInstrument]);

    renderPage();

    await waitFor(() => {
      expect(screen.queryByRole('status')).not.toBeInTheDocument();
    });
    expect(screen.getByText(/no strategies yet/i)).toBeInTheDocument();
  });

  it('shows an error banner when the API call fails', async () => {
    vi.mocked(api.templates.list).mockRejectedValue(new Error('Fetch failed'));
    vi.mocked(api.instruments.list).mockRejectedValue(new Error('Fetch failed'));

    renderPage();

    await waitFor(() => {
      expect(screen.getByText(/fetch failed/i)).toBeInTheDocument();
    });
  });

  it('renders a button to create a new strategy', async () => {
    vi.mocked(api.templates.list).mockResolvedValue([]);
    vi.mocked(api.instruments.list).mockResolvedValue([]);

    renderPage();

    await waitFor(() => {
      expect(screen.queryByRole('status')).not.toBeInTheDocument();
    });
    expect(screen.getByRole('button', { name: '+ New Strategy' })).toBeInTheDocument();
  });
});
