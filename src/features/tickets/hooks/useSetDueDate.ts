import { useMutation, useQueryClient, type QueryClient } from '@tanstack/react-query';
import { ApiError, updateTicketDueDate } from '../api/api';
import type { Ticket, TicketList } from '../types';
import { meKey } from './useMe';
import { ticketKeys } from './useTickets';

const patchTicket = (qc: QueryClient, id: string, fn: (t: Ticket) => Ticket) =>
  qc.setQueriesData<TicketList>({ queryKey: ticketKeys.lists }, (old) =>
    old && { ...old, data: old.data.map((t) => (t.id === id ? fn(t) : t)) },
  );

const findTicket = (qc: QueryClient, id: string) => {
  for (const [, list] of qc.getQueriesData<TicketList>({ queryKey: ticketKeys.lists })) {
    const found = list?.data.find((t) => t.id === id);
    if (found) return found;
  }
};

export function useSetDueDate() {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: ({ id, dueDate }: { id: string; dueDate: string }) => updateTicketDueDate(id, dueDate),

    onMutate: async ({ id, dueDate }) => {
      await qc.cancelQueries({ queryKey: ticketKeys.lists });
      const original = findTicket(qc, id);
      patchTicket(qc, id, (t) => ({ ...t, dueDate, state: t.state === 'REPORTED' ? 'IN_PROGRESS' : t.state }));
      return { original };
    },

    onError: (error, { id }, ctx) => {
      const original = ctx?.original;
      if (original) patchTicket(qc, id, () => original);
      if (error instanceof ApiError && error.status === 403) qc.invalidateQueries({ queryKey: meKey });
    },

    onSettled: () => qc.invalidateQueries({ queryKey: ticketKeys.lists }),
  });
}
