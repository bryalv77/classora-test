import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { fetchTickets } from '../api/api';
import type { TicketListParams } from '../types';

export const ticketKeys = {
  all: ['tickets'] as const,
  lists: ['tickets', 'list'] as const,
  list: (params: TicketListParams) => ['tickets', 'list', params] as const,
};

export function useTickets(params: TicketListParams) {
  return useQuery({
    queryKey: ticketKeys.list(params),
    queryFn: ({ signal }) => fetchTickets(params, signal),
    placeholderData: keepPreviousData,
  });
}
