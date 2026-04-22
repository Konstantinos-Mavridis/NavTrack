import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import SyncJobHistory from './SyncJobHistory';

function jsonResponse(status: number, body: unknown, statusText = 'OK'): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    statusText,
    json: vi.fn().mockResolvedValue(body),
    text: vi.fn().mockResolvedValue(JSON.stringify(body)),
  } as unknown as Response;
}

describe('SyncJobHistory', () => {
  let fetchMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('renders history table when jobs are returned', async () => {
    fetchMock.mockResolvedValueOnce(
      jsonResponse(200, [
        {
          id: 'job-1',
          status: 'SUCCESS',
          source: 'YAHOO',
          recordsFetched: 6,
          recordsUpserted: 3,
          errorMessage: null,
          startedAt: '2026-04-22T12:00:00.000Z',
          completedAt: '2026-04-22T12:00:05.000Z',
          triggeredBy: 'manual',
        },
      ]),
    );

    render(<SyncJobHistory instrumentId="inst-1" />);

    expect(await screen.findByText('Sync History')).toBeInTheDocument();
    expect(screen.getByText('SUCCESS')).toBeInTheDocument();
    expect(screen.getByText('manual')).toBeInTheDocument();
    expect(screen.getByText('6')).toBeInTheDocument();
    expect(fetchMock).toHaveBeenCalledWith(
      '/api/instruments/inst-1/sync/jobs?limit=10',
      expect.objectContaining({
        headers: { 'Content-Type': 'application/json' },
      }),
    );
  });

  it('renders nothing when no jobs are returned', async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse(200, []));

    const { container } = render(<SyncJobHistory instrumentId="inst-2" />);

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledTimes(1);
    });
    expect(container).toBeEmptyDOMElement();
  });

  it('renders nothing when fetch fails', async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse(500, { message: 'boom' }, 'Internal Server Error'));

    const { container } = render(<SyncJobHistory instrumentId="inst-3" />);

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledTimes(1);
    });
    expect(container).toBeEmptyDOMElement();
  });

  it('re-fetches when refreshKey changes', async () => {
    fetchMock
      .mockResolvedValueOnce(
        jsonResponse(200, [
          {
            id: 'job-a',
            status: 'SUCCESS',
            source: 'YAHOO',
            recordsFetched: 1,
            recordsUpserted: 1,
            errorMessage: null,
            startedAt: '2026-04-22T12:00:00.000Z',
            completedAt: '2026-04-22T12:00:01.000Z',
            triggeredBy: 'manual',
          },
        ]),
      )
      .mockResolvedValueOnce(
        jsonResponse(200, [
          {
            id: 'job-b',
            status: 'PARTIAL',
            source: 'YAHOO',
            recordsFetched: 5,
            recordsUpserted: 3,
            errorMessage: 'missing one day',
            startedAt: '2026-04-22T13:00:00.000Z',
            completedAt: '2026-04-22T13:00:01.000Z',
            triggeredBy: 'cron',
          },
        ]),
      );

    const { rerender } = render(<SyncJobHistory instrumentId="inst-4" refreshKey={0} />);
    expect(await screen.findByText('manual')).toBeInTheDocument();

    rerender(<SyncJobHistory instrumentId="inst-4" refreshKey={1} />);

    expect(await screen.findByText('cron')).toBeInTheDocument();
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });
});
