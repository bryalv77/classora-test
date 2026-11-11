import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, renderHook, waitFor } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import type { ReactNode } from 'react';
import { describe, expect, it } from 'vitest';
import { server } from '@/test/setup';
import { ApiError } from '../api/api';
import { makeTicket } from '../fixtures';
import type { TicketList } from '../types';
import { meKey } from './useMe';
import { useSetDueDate } from './useSetDueDate';
import { DEFAULTS } from './useTicketListParams';
import { ticketKeys } from './useTickets';

const DUE = '2026-12-01T12:00:00Z';
const problem = (status: number) => HttpResponse.json({ title: 'x', status }, { status });

const listOf = (...data: ReturnType<typeof makeTicket>[]): TicketList => ({
  data,
  pagination: { offset: 0, limit: 20, totalElements: data.length },
});

const setup = () => {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  const tickets = () => [makeTicket({ id: 'a', state: 'REPORTED' }), makeTicket({ id: 'b', state: 'REPORTED' }), makeTicket({ id: 'c', state: 'IN_PROGRESS' })];
  const unfiltered = ticketKeys.list(DEFAULTS);
  const reported = ticketKeys.list({ ...DEFAULTS, state: 'REPORTED' });
  qc.setQueryData(unfiltered, listOf(...tickets()));
  qc.setQueryData(reported, listOf(...tickets()));
  qc.setQueryData(meKey, { permissions: ['tickets.update'] });

  const wrapper = ({ children }: { children: ReactNode }) => <QueryClientProvider client={qc}>{children}</QueryClientProvider>;
  const { result } = renderHook(() => useSetDueDate(), { wrapper });
  const ticket = (key: readonly unknown[], id: string) => qc.getQueryData<TicketList>(key)!.data.find((t) => t.id === id)!;
  return { qc, result, unfiltered, reported, ticket };
};

const pendingPatch = () => {
  let release!: (r: Response) => void;
  server.use(http.patch('/api/v1/tickets/:id', () => new Promise<Response>((resolve) => (release = resolve))));
  return (r: Response) => release(r);
};

describe('useSetDueDate', () => {
  it('shows the new date and the REPORTED -> IN_PROGRESS change right away, before the server answers', async () => {
    const { result, unfiltered, ticket } = setup();
    pendingPatch();
    act(() => result.current.mutate({ id: 'a', dueDate: DUE }));

    await waitFor(() => expect(ticket(unfiltered, 'a')).toMatchObject({ dueDate: DUE, state: 'IN_PROGRESS' }));
    expect(result.current.isPending).toBe(true);
  });

  it('updates the ticket in every cached list, and only that ticket', async () => {
    const { result, unfiltered, reported, ticket } = setup();
    pendingPatch();
    act(() => result.current.mutate({ id: 'a', dueDate: DUE }));

    await waitFor(() => expect(ticket(reported, 'a').dueDate).toBe(DUE));
    expect(ticket(unfiltered, 'a')).toMatchObject({ dueDate: DUE, state: 'IN_PROGRESS' });
    expect(ticket(reported, 'b')).toMatchObject({ dueDate: null, state: 'REPORTED' });
  });

  it('does not change the state of a ticket that is not REPORTED', async () => {
    const { result, unfiltered, ticket } = setup();
    pendingPatch();
    act(() => result.current.mutate({ id: 'c', dueDate: DUE }));
    await waitFor(() => expect(ticket(unfiltered, 'c').dueDate).toBe(DUE));
    expect(ticket(unfiltered, 'c').state).toBe('IN_PROGRESS');
  });

  it('200: keeps the change and marks the lists stale so they are refetched', async () => {
    const { qc, result, unfiltered, ticket } = setup();
    server.use(http.patch('/api/v1/tickets/:id', () => HttpResponse.json(makeTicket({ id: 'a', state: 'IN_PROGRESS', dueDate: DUE }))));
    act(() => result.current.mutate({ id: 'a', dueDate: DUE }));

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(ticket(unfiltered, 'a')).toMatchObject({ dueDate: DUE, state: 'IN_PROGRESS' });
    await waitFor(() => expect(qc.getQueryState(unfiltered)?.isInvalidated).toBe(true));
  });

  it('403: rolls the ticket back in every list, exposes the error and reloads the permissions', async () => {
    const { qc, result, unfiltered, reported, ticket } = setup();
    server.use(http.patch('/api/v1/tickets/:id', () => problem(403)));
    act(() => result.current.mutate({ id: 'a', dueDate: DUE }));

    await waitFor(() => expect(result.current.isError).toBe(true));
    for (const key of [unfiltered, reported]) expect(ticket(key, 'a')).toMatchObject({ dueDate: null, state: 'REPORTED' });
    expect(result.current.error).toBeInstanceOf(ApiError);
    expect((result.current.error as ApiError).status).toBe(403);
    expect(qc.getQueryState(meKey)?.isInvalidated).toBe(true);
  });

  it('409: rolls back and does not touch the permissions', async () => {
    const { qc, result, unfiltered, ticket } = setup();
    server.use(http.patch('/api/v1/tickets/:id', () => problem(409)));
    act(() => result.current.mutate({ id: 'a', dueDate: DUE }));

    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(ticket(unfiltered, 'a')).toMatchObject({ dueDate: null, state: 'REPORTED' });
    expect((result.current.error as ApiError).status).toBe(409);
    expect(qc.getQueryState(meKey)?.isInvalidated).toBe(false);
  });

  it('a failure rolls back only its own ticket, not edits made meanwhile on another one', async () => {
    const { result, unfiltered, ticket } = setup();
    server.use(
      http.patch('/api/v1/tickets/:id', ({ params }) =>
        params.id === 'a' ? problem(403) : HttpResponse.json(makeTicket({ id: 'b', state: 'IN_PROGRESS', dueDate: DUE })),
      ),
    );
    act(() => {
      result.current.mutate({ id: 'a', dueDate: DUE });
      result.current.mutate({ id: 'b', dueDate: DUE });
    });
    await waitFor(() => expect(ticket(unfiltered, 'a').dueDate).toBeNull());
    expect(ticket(unfiltered, 'b').dueDate).toBe(DUE);
  });
});
