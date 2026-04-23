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

const mockTemplate = {
  id: 't1',
  name: 'Balanced 60/40',
  description: 'Classic balanced allocation',
  allocations: [
    { instrumentId: 'i1', instrumentName: 'Equity Fund', weightPct: 60 },
    { instrumentId: 'i2', instrumentName: 'Bond Fund',   weightPct: 40 },
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
      expect(screen.getByText('Balanced 60/40')).toBeInTheDocument();
    });
  });

  it('renders empty state when no templates exist', async () => {
    vi.mocked(api.templates.list).mockResolvedValue([]);

    renderPage();

    await waitFor(() => {
      expect(screen.queryByRole('status')).not.toBeInTheDocument();
    });
    expect(screen.queryByText('Balanced 60/40')).not.toBeInTheDocument();
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
    expect(screen.getByRole('button', { name: /new template|add template|create/i })).toBeInTheDocument();
  });
});
