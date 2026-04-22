import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import SyncButton from './SyncButton';

function jsonResponse(status: number, body: unknown, statusText = 'OK'): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    statusText,
    json: vi.fn().mockResolvedValue(body),
    text: vi.fn().mockResolvedValue(JSON.stringify(body)),
  } as unknown as Response;
}

describe('SyncButton', () => {
  let fetchMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('renders the default sync button label', () => {
    render(<SyncButton instrumentId="inst-1" />);
    expect(
      screen.getByRole('button', { name: /sync from yahoo finance/i }),
    ).toBeInTheDocument();
  });

  it('shows success result and calls onSuccess for SUCCESS status', async () => {
    fetchMock.mockResolvedValueOnce(
      jsonResponse(200, {
        jobId: 'job-1',
        status: 'SUCCESS',
        recordsFetched: 2,
        recordsUpserted: 2,
        yahooTicker: 'AAA.AT',
      }),
    );
    const onSuccess = vi.fn();
    render(<SyncButton instrumentId="inst-1" onSuccess={onSuccess} />);

    await userEvent.click(screen.getByRole('button', { name: /sync from yahoo finance/i }));

    expect(await screen.findByText(/2 prices saved/i)).toBeInTheDocument();
    expect(screen.getByText(/via AAA.AT/i)).toBeInTheDocument();
    expect(onSuccess).toHaveBeenCalledTimes(1);
    expect(fetchMock).toHaveBeenCalledWith(
      '/api/instruments/inst-1/sync',
      expect.objectContaining({ method: 'POST' }),
    );
  });

  it('calls onSuccess for PARTIAL status and handles singular price text', async () => {
    fetchMock.mockResolvedValueOnce(
      jsonResponse(200, {
        jobId: 'job-2',
        status: 'PARTIAL',
        recordsFetched: 1,
        recordsUpserted: 1,
        yahooTicker: null,
      }),
    );
    const onSuccess = vi.fn();
    render(<SyncButton instrumentId="inst-2" onSuccess={onSuccess} />);

    await userEvent.click(screen.getByRole('button', { name: /sync from yahoo finance/i }));

    expect(await screen.findByText(/1 price saved/i)).toBeInTheDocument();
    expect(onSuccess).toHaveBeenCalledTimes(1);
  });

  it('shows API failure message and does not call onSuccess', async () => {
    fetchMock.mockResolvedValueOnce(
      jsonResponse(200, {
        jobId: 'job-3',
        status: 'FAILED',
        recordsFetched: 0,
        recordsUpserted: 0,
        yahooTicker: null,
        error: 'Provider temporarily unavailable',
      }),
    );
    const onSuccess = vi.fn();
    render(<SyncButton instrumentId="inst-3" onSuccess={onSuccess} />);

    await userEvent.click(screen.getByRole('button', { name: /sync from yahoo finance/i }));

    expect(await screen.findByText(/Provider temporarily unavailable/i)).toBeInTheDocument();
    expect(onSuccess).not.toHaveBeenCalled();
  });

  it('shows caught network error message', async () => {
    fetchMock.mockRejectedValueOnce(new Error('Network down'));
    render(<SyncButton instrumentId="inst-4" />);

    await userEvent.click(screen.getByRole('button', { name: /sync from yahoo finance/i }));

    expect(await screen.findByText(/Network down/i)).toBeInTheDocument();
  });

  it('sets aria-busy while sync is in flight', async () => {
    let resolveFetch: ((value: Response) => void) | undefined;
    fetchMock.mockImplementationOnce(
      () =>
        new Promise<Response>((resolve) => {
          resolveFetch = resolve;
        }),
    );
    render(<SyncButton instrumentId="inst-5" />);

    const btn = screen.getByRole('button', { name: /sync from yahoo finance/i });
    await userEvent.click(btn);
    expect(btn).toHaveAttribute('aria-busy', 'true');

    resolveFetch?.(
      jsonResponse(200, {
        jobId: 'job-4',
        status: 'SUCCESS',
        recordsFetched: 0,
        recordsUpserted: 0,
        yahooTicker: null,
      }),
    );

    await waitFor(() => {
      expect(btn).toHaveAttribute('aria-busy', 'false');
    });
  });
});
