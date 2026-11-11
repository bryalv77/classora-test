import { describe, expect, it } from 'vitest';
import { TicketListSchema, TicketSchema } from '@/features/tickets/types';

const get = (path: string) => fetch(path);

describe('MSW mock generated from openapi-rest.yml', () => {
  it('list: applies the contract defaults and answers with a valid TicketList', async () => {
    const res = await get('/api/v1/tickets');
    const body = TicketListSchema.parse(await res.json());
    expect(body.pagination).toEqual({ offset: 0, limit: 20, totalElements: 134 });
    expect(body.data).toHaveLength(20);
    const dates = body.data.map((t) => t.lastModified);
    expect(dates).toEqual([...dates].sort().reverse());
  });

  it.each([
    ['limit=101', 'limit'],
    ['limit=0', 'limit'],
    ['offset=-1', 'offset'],
    ['offset=abc', 'offset'],
    ['state=FOO', 'state'],
    ['severity=urgent', 'severity'],
    ['sort=NOPE', 'sort'],
    ['direction=up', 'direction'],
    [`q=${'a'.repeat(101)}`, 'q'],
  ])('list: %s is a 422 Problem Details naming "%s"', async (qs, parameter) => {
    const res = await get(`/api/v1/tickets?${qs}`);
    expect(res.status).toBe(422);
    expect(res.headers.get('content-type')).toContain('application/problem+json');
    const problem = await res.json();
    expect(problem).toMatchObject({ status: 422, title: 'Validation error' });
    expect(problem.errors).toEqual([expect.objectContaining({ parameter })]);
  });

  it('list: reports every invalid parameter, not only the first', async () => {
    const problem = await (await get('/api/v1/tickets?limit=999&state=FOO')).json();
    expect(problem.errors.map((e: { parameter: string }) => e.parameter).sort()).toEqual(['limit', 'state']);
  });

  it('list: tickets without dueDate go last in both directions', async () => {
    for (const direction of ['ASC', 'DESC']) {
      const { data } = TicketListSchema.parse(await (await get(`/api/v1/tickets?sort=DUE_DATE&direction=${direction}&limit=100`)).json());
      const firstNull = data.findIndex((t) => t.dueDate === null);
      expect(data.slice(firstNull).every((t) => t.dueDate === null)).toBe(true);
    }
  });

  it('list: SEVERITY sorts by importance, not alphabetically', async () => {
    const { data } = TicketListSchema.parse(await (await get('/api/v1/tickets?sort=SEVERITY&direction=ASC')).json());
    expect(data[0].severity).toBe('CRITICAL');
  });

  it('GET /me is generated from the contract examples (deterministic)', async () => {
    const res = await get('/api/v1/me');
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ permissions: ['tickets.read', 'tickets.update'] });
  });

  const patch = (id: string, body: unknown) =>
    fetch(`/api/v1/tickets/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });

  it('PATCH sets the due date and moves a REPORTED ticket to IN_PROGRESS', async () => {
    const res = await patch('id-1', { dueDate: '2026-12-01T12:00:00Z' });
    expect(res.status).toBe(200);
    expect(TicketSchema.parse(await res.json())).toMatchObject({ id: 'id-1', dueDate: '2026-12-01T12:00:00Z', state: 'IN_PROGRESS' });

    // it really changed: the list sees it
    const { data } = TicketListSchema.parse(await (await get('/api/v1/tickets?q=SEC-1000')).json());
    expect(data[0]).toMatchObject({ dueDate: '2026-12-01T12:00:00Z', state: 'IN_PROGRESS' });
  });

  it('PATCH keeps the state of a ticket that is not REPORTED', async () => {
    const res = await patch('id-2', { dueDate: '2026-12-01T12:00:00Z' });
    expect(TicketSchema.parse(await res.json()).state).toBe('IN_PROGRESS');
  });

  it('PATCH answers 409 for a DONE ticket and leaves it untouched', async () => {
    const res = await patch('id-4', { dueDate: '2026-12-01T12:00:00Z' });
    expect(res.status).toBe(409);
    expect(await res.json()).toMatchObject({ status: 409, title: 'Ticket already closed' });
  });

  it('PATCH answers 404 for an unknown ticket', async () => {
    expect((await patch('nope', { dueDate: '2026-12-01T12:00:00Z' })).status).toBe(404);
  });

  it.each([[{}], [{ dueDate: 'tomorrow' }], [{ dueDate: 5 }]])('PATCH answers 422 for the body %j', async (body) => {
    const res = await patch('id-1', body);
    expect(res.status).toBe(422);
    expect((await res.json()).errors).toEqual([expect.objectContaining({ parameter: 'dueDate' })]);
  });

  it.each([['403'], ['409']])('PATCH can answer any documented error: ?response=%s', async (status) => {
    const res = await fetch(`/api/v1/tickets/tkt_8f3a1c2d?response=${status}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ dueDate: '2026-11-15T10:00:00Z' }),
    });
    expect(res.status).toBe(Number(status));
    expect(res.headers.get('content-type')).toContain('application/problem+json');
    expect(await res.json()).toMatchObject({ status: Number(status) });
  });
});
