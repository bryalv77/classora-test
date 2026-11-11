import { useEffect, useMemo } from 'react';
import { Pagination } from '@/shared/components/Pagination';
import { Spinner } from '@/shared/components/Spinner';
import { TicketFilters } from '../components/TicketFilters';
import { TicketsTable } from '../components/TicketsTable';
import { ApiError } from '../api/api';
import { useCan } from '../hooks/useMe';
import { useSetDueDate } from '../hooks/useSetDueDate';
import { useTicketListParams } from '../hooks/useTicketListParams';
import { useTickets } from '../hooks/useTickets';

const dueDateError = (error: Error) =>
  error instanceof ApiError && error.status === 403
    ? 'No tienes permiso para cambiar la fecha de compromiso.'
    : error instanceof ApiError && error.status === 409
      ? 'El ticket ya está hecho y no se puede modificar.'
      : 'No se pudo guardar la fecha. Inténtalo de nuevo.';

export function TicketsPage() {
  const { params, setFilters, setPage } = useTicketListParams();
  const canUpdate = useCan('tickets.update');
  const setDueDate = useSetDueDate();
  const { data, dataUpdatedAt, isPlaceholderData, isFetching, isError, error, refetch } = useTickets(params);

  const overdue = useMemo(
    () => data?.data.filter((t) => t.state !== 'DONE' && Date.parse(t.targetDate) < dataUpdatedAt).length ?? 0,
    [data, dataUpdatedAt],
  );

  const total = data?.pagination.totalElements;
  useEffect(() => {
    if (total === undefined || isPlaceholderData || params.offset === 0 || params.offset < total) return;
    setPage(Math.max(0, (Math.ceil(total / params.limit) - 1) * params.limit), { replace: true });
  }, [total, isPlaceholderData, params.offset, params.limit, setPage]);

  return (
    <div>
      <TicketFilters params={params} onChange={setFilters} />
      {isFetching && <Spinner />}
      {isError && (
        <div role="alert">
          <p>No se pudieron cargar los tickets: {error.message}</p>
          <button type="button" onClick={() => refetch()}>Reintentar</button>
        </div>
      )}
      {setDueDate.isError && (
        <div role="alert">
          <p>{dueDateError(setDueDate.error)}</p>
        </div>
      )}
      {data && (
        <>
          <p>{overdue} tickets caducados en esta página</p>
          <TicketsTable
            tickets={data.data}
            busy={isFetching}
            sort={params.sort}
            direction={params.direction}
            onSort={setFilters}
            onSetDueDate={canUpdate ? (id, dueDate) => setDueDate.mutate({ id, dueDate }) : undefined}
          />
          <Pagination
            total={data.pagination.totalElements}
            offset={params.offset}
            limit={params.limit}
            onChange={setPage}
          />
        </>
      )}
    </div>
  );
}
