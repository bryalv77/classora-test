import { http, HttpResponse } from 'msw';
import { describe, expect, it } from 'vitest';
import { server } from '@/test/setup';
import { ApiError, fetchTickets } from './api';
import { DEFAULTS } from '../hooks/useTicketListParams';

const capture = () => {
  const seen: URL[] = [];
  server.use(
    http.get('/api/v1/tickets', ({ request }) => {
      seen.push(new URL(request.url));
      return HttpResponse.json({ data: [], pagination: { offset: 0, limit: 20, totalElements: 0 } });
    }),
  );
  return seen;
};

describe('fetchTickets', () => {
  it('omits UI-only defaults (ALL, empty q) from the request', async () => {
    const seen = capture();
    await fetchTickets(DEFAULTS);
    const sp = seen[0].searchParams;
    expect(sp.has('state')).toBe(false);
    expect(sp.has('severity')).toBe(false);
    expect(sp.has('q')).toBe(false);
    expect(Object.fromEntries(sp)).toEqual({ offset: '0', limit: '20', sort: 'LAST_MODIFIED', direction: 'DESC' });
  });

  it('sends active filters and encodes q so it cannot inject parameters', async () => {
    const seen = capture();
    await fetchTickets({ ...DEFAULTS, q: 'a&state=DONE#', state: 'IN_PROGRESS', severity: 'HIGH' });
    const sp = seen[0].searchParams;
    expect(sp.get('q')).toBe('a&state=DONE#');
    expect(sp.get('state')).toBe('IN_PROGRESS');
    expect(sp.get('severity')).toBe('HIGH');
  });

  it('throws an ApiError with the Problem Details title on error statuses', async () => {
    server.use(http.get('/api/v1/tickets', () => HttpResponse.json({ title: 'Invalid limit' }, { status: 422 })));
    await expect(fetchTickets(DEFAULTS)).rejects.toMatchObject({ status: 422, message: 'Invalid limit' });
    await expect(fetchTickets(DEFAULTS)).rejects.toBeInstanceOf(ApiError);
  });

  it('falls back to the status when the error body is not JSON', async () => {
    server.use(http.get('/api/v1/tickets', () => new HttpResponse('boom', { status: 500 })));
    await expect(fetchTickets(DEFAULTS)).rejects.toMatchObject({ status: 500, message: 'Error 500' });
  });

  it('rejects a response that does not match the contract', async () => {
    server.use(http.get('/api/v1/tickets', () => HttpResponse.json({ data: [{ id: 1 }], pagination: {} })));
    await expect(fetchTickets(DEFAULTS)).rejects.toThrow();
  });
});
