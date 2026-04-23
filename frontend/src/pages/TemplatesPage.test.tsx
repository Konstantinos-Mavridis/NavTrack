/**
 * Smoke tests for TemplatesPage.
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
  },
}));

import { api } from '../api/client';
import TemplatesPage from './TemplatesPage';

// Shape matches AllocationTemplate: uses `code` (not `name`) and `items` (not `allocations`).
const mockTemplate = {
  id: 't1',
  name: 'Balanced 60/40',
  code: 'BALANCED_60_40',
  description: 'Classic balanced allocation',
  items: [
    {
      id: 'ti1',
      templateId: 't1',
      instrumentId: 'i1',
      weight: 60,
      instrument: {
        id: 'i1',
        name: 'Equity Fund',
        isin: 'IE00B3RBWM25',
        assetClass: 'EQUITY',
        riskLevel: 4,
        currency: 'EUR',
        description: '',
        createdAt: '2024-01-01T00:00:00Z',
        updatedAt: '2024-01-01T00:00:00Z',
      },
    },
    {
      id: 'ti2',
      templateId: 't1',
      instrumentId: 'i2',
      weight: 40,
      instrument: {
        id: 'i2',
        name: 'Bond Fund',
        isin: 'IE00B04GQ505',
        assetClass: 'BOND',
        riskLevel: 2,
        currency: 'EUR',
        description: '',
        createdAt: '2024-01-01T00:00:00Z',
        updatedAt: '2024-01-01T00:00:00Z',
      },
    },
  ],
  createdAt: '2024-01-01T00:00:00Z',
  updatedAt: '2024-01-01T00:00:00Z',
};

function renderPage() {
  return render(
    <ThemeProvider>
      <MemoryRouter>
        <TemplatesPage />
      </MemoryRouter>
    </ThemeProvider>,
  );
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe('TemplatesPage', () => {
  it('shows a loading spinner while fetching', () => {
    vi.mocked(api.templates.list).mockReturnValue(new Promise(() => {}));

    renderPage();
    expect(screen.getByRole('status')).toBeInTheDocument();
  });

  it('renders template cards after successful load', async () => {
    vi.mocked(api.templates.list).mockResolvedValue([mockTemplate]);

    renderPage();

    await waitFor(() => {
      expect(screen.getByText('BALANCED_60_40')).toBeInTheDocument();
    });
  });

  it('renders empty state when no templates exist', async () => {
    vi.mocked(api.templates.list).mockResolvedValue([]);

    renderPage();

    await waitFor(() => {
      expect(screen.queryByRole('status')).not.toBeInTheDocument();
    });
    expect(screen.queryByText('BALANCED_60_40')).not.toBeInTheDocument();
  });

  it('shows an error banner when the API call fails', async () => {
    vi.mocked(api.templates.list).mockRejectedValue(new Error('Unauthorized'));

    renderPage();

    await waitFor(() => {
      expect(screen.getByText(/unauthorized/i)).toBeInTheDocument();
    });
  });

  it('renders a button to create a new template', async () => {
    vi.mocked(api.templates.list).mockResolvedValue([]);

    renderPage();

    await waitFor(() => {
      expect(screen.queryByRole('status')).not.toBeInTheDocument();
    });
    // Match the exact header button label to avoid the empty-state "Create Template" duplicate.
    expect(screen.getByRole('button', { name: '+ New Template' })).toBeInTheDocument();
  });
});
