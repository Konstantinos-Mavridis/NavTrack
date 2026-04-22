import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import SyncAllButton from './SyncAllButton';
import type { Instrument } from '../types';

function jsonResponse(status: number, body: unknown, statusText = 'OK'): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    statusText,
    json: vi.fn().mockResolvedValue(body),
    text: vi.fn().mockResolvedValue(JSON.stringify(body)),
  } as unknown as Response;
}

function instrument(id: string, name: string, isin: string): Instrument {
  return {
    id,
    name,
    isin,
    assetClass: 'EQUITY',
    currency: 'EUR',
    createdAt: '2026-04-22T00:00:00.000Z',
    updatedAt: '2026-04-22T00:00:00.000Z',
  };
}

describe('SyncAllButton', () => {
  let fetchMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('shows a fetch error when instrument list cannot be loaded', async () => {
    fetchMock.mockRejectedValueOnce(new Error('Offline'));

    render(<SyncAllButton />);
    await userEvent.click(screen.getByRole('button', { name: /sync all nav/i }));

    expect(
      await screen.findByText(/Could not load instruments: Request failed: Offline/i),
    ).toBeInTheDocument();
  });

  it('shows a no-instruments message when list is empty', async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse(200, []));

    render(<SyncAllButton />);
    await userEvent.click(screen.getByRole('button', { name: /sync all nav/i }));

    expect(await screen.findByText(/No instruments found\./i)).toBeInTheDocument();
  });

  it('runs incremental sync and updates per-instrument rows', async () => {
    const alpha = instrument('inst-1', 'Alpha Fund', 'ISIN-1');
    const beta = instrument('inst-2', 'Beta Fund', 'ISIN-2');
    const onComplete = vi.fn();

    fetchMock.mockImplementation((url: string) => {
      if (url === '/api/instruments') return Promise.resolve(jsonResponse(200, [alpha, beta]));
      if (url === '/api/instruments/inst-1/sync') {
        return Promise.resolve(
          jsonResponse(200, { status: 'SUCCESS', recordsUpserted: 2, yahooTicker: 'ALPHA.AT' }),
        );
      }
      if (url === '/api/instruments/inst-2/sync') {
        return Promise.resolve(jsonResponse(500, { message: 'failed' }, 'Internal Server Error'));
      }
      throw new Error(`Unexpected URL: ${url}`);
    });

    render(<SyncAllButton onComplete={onComplete} />);
    await userEvent.click(screen.getByRole('button', { name: /sync all nav/i }));

    expect(await screen.findByText('Alpha Fund')).toBeInTheDocument();
    expect(await screen.findByText(/\+2 prices/i)).toBeInTheDocument();
    expect(await screen.findByText('HTTP 500')).toBeInTheDocument();
    expect(onComplete).toHaveBeenCalledTimes(1);
    expect(fetchMock).toHaveBeenCalledWith('/api/instruments/inst-1/sync', { method: 'POST' });
    expect(fetchMock).toHaveBeenCalledWith('/api/instruments/inst-2/sync', { method: 'POST' });
  });

  it('runs force refresh after confirmation and appends refresh query params', async () => {
    const alpha = instrument('inst-10', 'Gamma Fund', 'ISIN-10');

    fetchMock.mockImplementation((url: string) => {
      if (url === '/api/instruments') return Promise.resolve(jsonResponse(200, [alpha]));
      if (url === '/api/instruments/inst-10/sync?refresh=true&overwrite=true') {
        return Promise.resolve(
          jsonResponse(200, { status: 'SUCCESS', recordsUpserted: 1, yahooTicker: 'GAMMA.AT' }),
        );
      }
      throw new Error(`Unexpected URL: ${url}`);
    });

    render(<SyncAllButton />);
    await userEvent.click(screen.getByRole('button', { name: /force refresh nav/i }));
    expect(await screen.findByText(/Force Refresh All Instruments/i)).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: /^Force Refresh$/i }));

    expect(await screen.findByText(/\+1 price/i)).toBeInTheDocument();
    expect(fetchMock).toHaveBeenCalledWith(
      '/api/instruments/inst-10/sync?refresh=true&overwrite=true',
      { method: 'POST' },
    );
  });
});
