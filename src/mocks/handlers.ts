import { http, HttpResponse } from 'msw';
import type { OpenAPIV3 } from 'openapi-types';
import { SEVERITIES, TICKET_STATES, type Ticket } from '@/features/tickets/types';
import { listTicketsParams } from '@/shared/api/contract';
import { deref, required, spec } from '@/shared/api/spec';

const assets = ['payments-api', 'auth-service', 'web-frontend', 'None'];

const seed = (): Ticket[] => Array.from({ length: 134 }, (_, i) => ({
  id: `id-${i + 1}`,
  key: `SEC-${1000 + i}`,
  asset: assets[i % assets.length],
  assignedTeam: i % 5 === 0 ? null : 'team-1',
  assignee: `user${i % 7}@example.com`,
  severity: SEVERITIES[i % SEVERITIES.length],
  state: TICKET_STATES[i % TICKET_STATES.length],
  targetDate: new Date(Date.UTC(2026, 10, 1 + (i % 60), 23, 59, 59)).toISOString(),
  dueDate: i % 3 === 0 ? new Date(Date.UTC(2026, 10, 15, 10, 0, 0)).toISOString() : null,
  lastModified: new Date(Date.UTC(2026, 9, 1 + (i % 30))).toISOString(),
}));

const STORAGE_KEY = 'classora:tickets:v1';
const load = (): Ticket[] => {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '') as Ticket[];
  } catch {
    return seed();
  }
};
const save = () => {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(tickets));
  } catch {
    console.log('No localstorage available');
  }
};

let tickets = load();
export const resetTickets = () => {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {
    console.log('No localstorage available');
  }
  tickets = seed();
};

const problem = (status: number, slug: string, title: string, detail: string, instance: string, errors?: object[]) =>
  HttpResponse.json(
    { type: `https://api.security.example.com/problems/${slug}`, title, status, detail, instance, ...(errors && { errors }) },
    { status, headers: { 'Content-Type': 'application/problem+json' } },
  );

function readQuery(searchParams: URLSearchParams) {
  const values: Record<string, string | number> = {};
  const errors: { parameter: string; message: string }[] = [];

  for (const [name, rule] of Object.entries(listTicketsParams)) {
    const raw = searchParams.get(name);
    if (raw === null) {
      values[name] = rule.default;
    } else if ('minimum' in rule) {
      const n = Number(raw);
      if (Number.isInteger(n) && n >= rule.minimum && n <= rule.maximum) values[name] = n;
      else errors.push({ parameter: name, message: `must be an integer between ${rule.minimum} and ${rule.maximum}` });
    } else if ('enum' in rule) {
      if ((rule.enum as readonly string[]).includes(raw)) values[name] = raw;
      else errors.push({ parameter: name, message: `must be one of ${rule.enum.join(', ')}` });
    } else if (raw.length <= rule.maxLength) {
      values[name] = raw;
    } else {
      errors.push({ parameter: name, message: `must be at most ${rule.maxLength} characters` });
    }
  }
  return { values, errors };
}

const listTickets = http.get('/api/v1/tickets', ({ request }) => {
  const url = new URL(request.url);
  const { values, errors } = readQuery(url.searchParams);

  if (errors.length > 0) {
    return problem(422, 'validation-error', 'Validation error', 'One or more parameters are invalid', url.pathname, errors);
  }

  const { offset, limit, state, severity, sort, direction } = values as Record<string, string> & { offset: number; limit: number };
  const q = String(values.q).toLowerCase();
  const dir = direction === 'ASC' ? 1 : -1;

  const filtered = tickets.filter(
    (t) =>
      (state === 'ALL' || t.state === state) &&
      (severity === 'ALL' || t.severity === severity) &&
      (!q || t.key.toLowerCase().includes(q) || t.asset.toLowerCase().includes(q)),
  );

  const sortValue = (t: Ticket): string | number | null =>
    ({
      KEY: t.key,
      ASSET: t.asset,
      SEVERITY: SEVERITIES.indexOf(t.severity),
      STATE: TICKET_STATES.indexOf(t.state),
      TARGET_DATE: t.targetDate,
      DUE_DATE: t.dueDate,
      LAST_MODIFIED: t.lastModified,
    })[sort as 'KEY'];
  filtered.sort((a, b) => {
    const [x, y] = [sortValue(a), sortValue(b)];
    if (x === y) return 0;
    if (x === null) return 1;
    if (y === null) return -1;
    return (x < y ? -1 : 1) * dir;
  });

  return HttpResponse.json({
    data: filtered.slice(offset, offset + limit),
    pagination: { offset, limit, totalElements: filtered.length },
  });
});

const exampleOf = (raw: OpenAPIV3.SchemaObject | OpenAPIV3.ReferenceObject): unknown => {
  const schema = deref(raw);
  if (schema.example !== undefined) return schema.example;
  if (schema.allOf) return exampleOf(schema.allOf[0]);
  if (schema.type === 'array') return [exampleOf(schema.items)];
  if (schema.type === 'object') {
    return Object.fromEntries(Object.entries(schema.properties ?? {}).map(([key, value]) => [key, exampleOf(value)]));
  }
  return schema.enum?.[0];
};

const METHODS = { get: http.get, patch: http.patch } as const;

const generated = Object.entries(spec.paths).flatMap(([path, item]) =>
  (Object.keys(METHODS) as (keyof typeof METHODS)[]).flatMap((method) => {
    const operation = item?.[method];
    if (!operation || (method === 'get' && path === '/api/v1/tickets')) return [];

    return METHODS[method](path.replace(/{(\w+)}/g, ':$1'), ({ request }) => {
      const status =
        new URL(request.url).searchParams.get('response') ?? required(Object.keys(operation.responses).find((code) => code.startsWith('2')), 'a 2xx response');
      const [contentType, media] = Object.entries(deref(operation.responses[status]).content ?? {})[0];
      return HttpResponse.json((media.example ?? exampleOf(required(media.schema, 'a schema in the response'))) as object, {
        status: Number(status),
        headers: { 'Content-Type': contentType },
      });
    });
  }),
);

const updateTicket = http.patch('/api/v1/tickets/:id', async ({ request, params }) => {
  const url = new URL(request.url);
  if (url.searchParams.has('response')) return;

  const ticket = tickets.find((t) => t.id === params.id);
  if (!ticket) return problem(404, 'not-found', 'Ticket not found', `No ticket with id ${params.id}`, url.pathname);

  const body = (await request.json().catch(() => null)) as { dueDate?: unknown } | null;
  if (typeof body?.dueDate !== 'string' || Number.isNaN(Date.parse(body.dueDate))) {
    return problem(422, 'validation-error', 'Validation error', 'The body is invalid', url.pathname, [
      { parameter: 'dueDate', message: 'must be a date-time' },
    ]);
  }
  if (ticket.state === 'DONE') {
    return problem(409, 'ticket-closed', 'Ticket already closed', "Tickets in state DONE can't be modified", url.pathname);
  }

  ticket.dueDate = body.dueDate;
  if (ticket.state === 'REPORTED') ticket.state = 'IN_PROGRESS';
  ticket.lastModified = new Date().toISOString();
  save();
  return HttpResponse.json(ticket);
});

export const handlers = [listTickets, updateTicket, ...generated];
