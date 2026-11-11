import { z } from 'zod';
import { contractEnums } from '@/shared/api/contract';
import type { components, operations } from '@/shared/api/schema';

type Schemas = components['schemas'];
export type Ticket = Schemas['Ticket'];
export type TicketState = Schemas['TicketState'];
export type Severity = Schemas['Severity'];
export type TicketList = Schemas['TicketList'];
export type TicketSortField = Schemas['TicketSortField'];
export type SortDirection = Schemas['SortDirection'];
export type TicketUpdate = Schemas['TicketUpdate'];
export type CurrentUser = Schemas['CurrentUser'];
export type TicketListParams = Required<NonNullable<operations['listTickets']['parameters']['query']>>;

export const TICKET_STATES = contractEnums.TicketState;
export const SEVERITIES = contractEnums.Severity;
export const SORT_FIELDS = contractEnums.TicketSortField;
export const DIRECTIONS = contractEnums.SortDirection;

const dateTime = z.iso.datetime({ offset: true });

export const TicketSchema: z.ZodType<Ticket> = z.object({
  id: z.string(),
  key: z.string(),
  asset: z.string(),
  assignedTeam: z.string().nullable(),
  assignee: z.string(),
  severity: z.enum(SEVERITIES),
  state: z.enum(TICKET_STATES),
  targetDate: dateTime,
  dueDate: dateTime.nullable(),
  lastModified: dateTime,
});

export const TicketListSchema: z.ZodType<TicketList> = z.object({
  data: z.array(TicketSchema),
  pagination: z.object({
    offset: z.number().int(),
    limit: z.number().int(),
    totalElements: z.number().int(),
  }),
});

export const CurrentUserSchema: z.ZodType<CurrentUser> = z.object({ permissions: z.array(z.string()) });
