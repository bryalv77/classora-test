import {
  CurrentUserSchema,
  TicketListSchema,
  TicketSchema,
  type CurrentUser,
  type Ticket,
  type TicketList,
  type TicketListParams,
  type TicketUpdate,
} from '../types';

export class ApiError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

// Seguimos (RFC 9457)
async function throwApiError(res: Response): Promise<never> {
  const problem = (await res.json().catch(() => null)) as { title?: string } | null;
  throw new ApiError(res.status, problem?.title ?? `Error ${res.status}`);
}

export async function fetchTickets(params: TicketListParams, signal?: AbortSignal): Promise<TicketList> {
  const search = new URLSearchParams({
    offset: String(params.offset),
    limit: String(params.limit),
    sort: params.sort,
    direction: params.direction,
  });
  if (params.q) search.set('q', params.q);
  if (params.state !== 'ALL') search.set('state', params.state);
  if (params.severity !== 'ALL') search.set('severity', params.severity);

  const res = await fetch(`/api/v1/tickets?${search}`, { signal });
  if (!res.ok) await throwApiError(res);
  return TicketListSchema.parse(await res.json());
}

export async function updateTicketDueDate(id: string, dueDate: string): Promise<Ticket> {
  const body: TicketUpdate = { dueDate };
  const res = await fetch(`/api/v1/tickets/${encodeURIComponent(id)}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!res.ok) await throwApiError(res);
  return TicketSchema.parse(await res.json());
}

export async function fetchMe(signal?: AbortSignal): Promise<CurrentUser> {
  const res = await fetch('/api/v1/me', { signal });
  if (!res.ok) await throwApiError(res);
  return CurrentUserSchema.parse(await res.json());
}
