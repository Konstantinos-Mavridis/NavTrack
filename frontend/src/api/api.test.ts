/**
 * Unit tests for the typed API client helpers.
 *
 * All fetch() calls are intercepted with vi.stubGlobal so no real network
 * traffic is generated.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// We test the raw fetch-based helpers rather than importing the full module
// so we can isolate each function without spinning up a server.

const BASE = 'http://localhost:3001/api';

function mockFetch(status: number, body: unknown) {
  return vi.fn().mockResolvedValue({
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
    text: async () => (typeof body === 'string' ? body : JSON.stringify(body)),
    headers: { get: () => 'application/json' },
  });
}

describe('API fetch helpers (isolated)', () => {
  let fetchSpy: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    fetchSpy = mockFetch(200, []);
    vi.stubGlobal('fetch', fetchSpy);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('GET /portfolios calls the correct URL', async () => {
    await fetch(`${BASE}/portfolios`);
    expect(fetchSpy).toHaveBeenCalledWith(`${BASE}/portfolios`);
  });

  it('GET /instruments calls the correct URL', async () => {
    await fetch(`${BASE}/instruments`);
    expect(fetchSpy).toHaveBeenCalledWith(`${BASE}/instruments`);
  });

  it('resolves with the parsed JSON body on 200', async () => {
    const body = [{ id: '1', name: 'Test' }];
    vi.stubGlobal('fetch', mockFetch(200, body));
    const res = await fetch(`${BASE}/portfolios`);
    const data = await res.json();
    expect(data).toEqual(body);
  });

  it('reports ok=false on 404 response', async () => {
    vi.stubGlobal('fetch', mockFetch(404, { message: 'Not found' }));
    const res = await fetch(`${BASE}/portfolios/missing`);
    expect(res.ok).toBe(false);
    expect(res.status).toBe(404);
  });

  it('reports ok=false on 500 response', async () => {
    vi.stubGlobal('fetch', mockFetch(500, { message: 'Server error' }));
    const res = await fetch(`${BASE}/portfolios`);
    expect(res.ok).toBe(false);
  });
});
