import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { api, ApiError } from './client';

function jsonResponse(status: number, body: unknown, statusText = 'OK'): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    statusText,
    json: vi.fn().mockResolvedValue(body),
    text: vi.fn().mockResolvedValue(
      typeof body === 'string' ? body : JSON.stringify(body),
    ),
  } as unknown as Response;
}

function textOnlyResponse(status: number, text: string, statusText = 'OK'): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    statusText,
    text: vi.fn().mockResolvedValue(text),
    json: vi.fn().mockRejectedValue(new Error('Not JSON')),
  } as unknown as Response;
}

describe('api client', () => {
  let fetchMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('returns parsed data for a successful request', async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse(200, [{ id: 'inst-1' }]));

    const data = await api.instruments.list();

    expect(data).toEqual([{ id: 'inst-1' }]);
    expect(fetchMock).toHaveBeenCalledWith(
      '/api/instruments',
      expect.objectContaining({
        headers: expect.objectContaining({ 'Content-Type': 'application/json' }),
      }),
    );
  });

  it('returns undefined for HTTP 204', async () => {
    fetchMock.mockResolvedValueOnce({
      ok: true,
      status: 204,
      statusText: 'No Content',
      json: vi.fn(),
      text: vi.fn(),
    } as unknown as Response);

    const result = await api.instruments.delete('inst-1');
    expect(result).toBeUndefined();
  });

  it('joins array error messages into one ApiError message', async () => {
    fetchMock.mockResolvedValueOnce(
      jsonResponse(400, { message: ['field A is invalid', 'field B is required'] }, 'Bad Request'),
    );

    await expect(api.portfolios.create({ name: '' })).rejects.toMatchObject({
      status: 400,
      message: 'field A is invalid, field B is required',
    });
  });

  it('falls back to statusText when error body is not JSON', async () => {
    fetchMock.mockResolvedValueOnce({
      ok: false,
      status: 422,
      statusText: 'Unprocessable Entity',
      json: vi.fn().mockRejectedValue(new Error('bad json')),
      text: vi.fn(),
    } as unknown as Response);

    await expect(api.instruments.get('inst-1')).rejects.toMatchObject({
      status: 422,
      message: 'Unprocessable Entity',
    });
  });

  it('wraps network failures in ApiError(status=0) and preserves originalError', async () => {
    const root = new Error('Network down');
    fetchMock.mockRejectedValueOnce(root);

    let err: ApiError | undefined;
    try {
      await api.portfolios.list();
    } catch (e: unknown) {
      err = e as ApiError;
    }

    expect(err).toBeInstanceOf(ApiError);
    expect(err?.status).toBe(0);
    expect(err?.message).toContain('Request failed');
    expect(err?.message).toContain('Network down');
    expect(err?.originalError).toBe(root);
  });

  it('returns raw text for text endpoints', async () => {
    fetchMock.mockResolvedValueOnce(textOnlyResponse(200, 'isin,name\nGR123,Fund A\n'));

    const csv = await api.instruments.exportCsv();

    expect(csv).toContain('isin,name');
  });

  it('throws ApiError with text body for requestText failures', async () => {
    fetchMock.mockResolvedValueOnce(textOnlyResponse(500, 'broken exporter', 'Internal Server Error'));

    await expect(api.portfolios.exportCsv()).rejects.toMatchObject({
      status: 500,
      message: 'broken exporter',
    });
  });

  it('throws ApiError with statusText when requestText body cannot be read', async () => {
    fetchMock.mockResolvedValueOnce({
      ok: false,
      status: 503,
      statusText: 'Service Unavailable',
      text: vi.fn().mockRejectedValue(new Error('stream broken')),
      json: vi.fn(),
    } as unknown as Response);

    await expect(api.portfolios.exportCsv()).rejects.toMatchObject({
      status: 503,
      message: 'Service Unavailable',
    });
  });

  it('rejects invalid date format before sending navOnDate request', async () => {
    expect(() => api.instruments.navOnDate('inst-1', '2026/04/22')).toThrowError(
      /YYYY-MM-DD/,
    );
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('rejects non-existent ISO calendar date before sending valuation request', async () => {
    expect(() => api.valuation.get('portfolio-1', '2026-02-30')).toThrowError(
      /not a valid date/,
    );
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('builds aggregateSeries query with days, to-date and encoded ids', async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse(200, []));

    await api.portfolios.aggregateSeries(30, '2026-04-22', ['id 1', 'id/2']);

    expect(fetchMock).toHaveBeenCalledWith(
      '/api/portfolios/aggregate/valuation-series?days=30&to=2026-04-22&ids=id%201,id%2F2',
      expect.any(Object),
    );
  });

  it('requires customFrom/customTo for CUSTOM nav-series', async () => {
    expect(() => api.templates.navSeries('tpl-1', 'CUSTOM')).toThrowError(
      /CUSTOM range requires both customFrom and customTo dates/,
    );
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('calls nav-series with encoded custom range dates', async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse(200, [{ date: '2026-04-01', indexValue: 100 }]));

    await api.templates.navSeries('tpl-1', 'CUSTOM', '2026-04-01', '2026-04-22');

    expect(fetchMock).toHaveBeenCalledWith(
      '/api/templates/tpl-1/nav-series?from=2026-04-01&to=2026-04-22',
      expect.any(Object),
    );
  });

  it('maps ALL range to days=0', async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse(200, []));

    await api.templates.navSeries('tpl-1', 'ALL');

    expect(fetchMock).toHaveBeenCalledWith(
      '/api/templates/tpl-1/nav-series?days=0',
      expect.any(Object),
    );
  });

  it('validates tradeDate before navPreview request', async () => {
    expect(() => api.templates.navPreview('tpl-1', '22-04-2026')).toThrowError(
      /tradeDate must be in YYYY-MM-DD format/,
    );
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
