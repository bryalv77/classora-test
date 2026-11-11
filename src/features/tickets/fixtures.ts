import type { Ticket } from './types';

export const makeTicket = (over: Partial<Ticket> = {}): Ticket => ({
  id: 'id-1',
  key: 'SEC-1024',
  asset: 'payments-api',
  assignedTeam: 'team-1',
  assignee: 'user@example.com',
  severity: 'HIGH',
  state: 'IN_PROGRESS',
  targetDate: '2026-11-30T23:59:59Z',
  dueDate: null,
  lastModified: '2026-10-01T10:00:00Z',
  ...over,
});
