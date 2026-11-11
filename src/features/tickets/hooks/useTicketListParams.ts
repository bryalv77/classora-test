import { useCallback, useMemo } from 'react';
import { useSearchParams } from 'react-router';
import { z } from 'zod';
import { listTicketsParams } from '@/shared/api/contract';
import type { TicketListParams } from '../types';

// Defaults and limits are the contract's: nothing is copied by hand.
const P = listTicketsParams;

export const DEFAULTS: TicketListParams = {
  offset: P.offset.default,
  limit: P.limit.default,
  q: P.q.default,
  state: P.state.default,
  severity: P.severity.default,
  sort: P.sort.default,
  direction: P.direction.default,
};

const ParamsSchema = z.object({
  offset: z.coerce.number().int().min(P.offset.minimum).max(P.offset.maximum).catch(DEFAULTS.offset),
  limit: z.coerce.number().int().min(P.limit.minimum).max(P.limit.maximum).catch(DEFAULTS.limit),
  q: z.string().trim().max(P.q.maxLength).catch(DEFAULTS.q),
  state: z.enum(P.state.enum).catch(DEFAULTS.state),
  severity: z.enum(P.severity.enum).catch(DEFAULTS.severity),
  sort: z.enum(P.sort.enum).catch(DEFAULTS.sort),
  direction: z.enum(P.direction.enum).catch(DEFAULTS.direction),
});

const parse = (sp: URLSearchParams): TicketListParams => ParamsSchema.parse(Object.fromEntries(sp));

const KEYS = Object.keys(DEFAULTS) as (keyof TicketListParams)[];

const write = (prev: URLSearchParams, p: TicketListParams): URLSearchParams => {
  const sp = new URLSearchParams(prev);
  for (const k of KEYS) {
    sp.delete(k);
    if (p[k] !== DEFAULTS[k]) sp.set(k, String(p[k]));
  }
  return sp;
};

const next = (prev: URLSearchParams, patch: Partial<TicketListParams>) => write(prev, ParamsSchema.parse({ ...parse(prev), ...patch }));

export type UseTicketListParams = {
  params: TicketListParams;
  setFilters: (patch: Partial<Omit<TicketListParams, 'offset' | 'limit'>>) => void;
  setPage: (offset: number, opts?: { replace?: boolean }) => void;
  reset: () => void;
};

export function useTicketListParams(): UseTicketListParams {
  const [searchParams, setSearchParams] = useSearchParams();
  const params = useMemo(() => parse(searchParams), [searchParams]);

  const setFilters = useCallback<UseTicketListParams['setFilters']>(
    (patch) =>
      setSearchParams(
        (prev) => next(prev, { ...patch, offset: 0 }),
        { replace: Object.keys(patch).every((k) => k === 'q') },
      ),
    [setSearchParams],
  );

  const setPage = useCallback<UseTicketListParams['setPage']>(
    (offset, opts) => setSearchParams((prev) => next(prev, { offset }), opts),
    [setSearchParams],
  );

  const reset = useCallback(() => setSearchParams((prev) => write(prev, DEFAULTS)), [setSearchParams]);

  return { params, setFilters, setPage, reset };
}
