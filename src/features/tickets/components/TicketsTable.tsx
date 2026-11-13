import { SORT_LABELS } from '../labels';
import { TicketRow } from './TicketRow';
import { SORT_FIELDS, type Ticket, type TicketListParams } from '../types';

type SortState = Pick<TicketListParams, 'sort' | 'direction'>;

type Props = SortState & {
  tickets: Ticket[];
  busy: boolean;
  onSort: (next: SortState) => void;
  onSetDueDate?: (id: string, dueDate: string) => void;
};

function SortHeader({ field, sort, direction, onSort }: SortState & { field: SortState['sort']; onSort: Props['onSort'] }) {
  const active = sort === field;
  return (
    <th scope="col" aria-sort={active ? (direction === 'ASC' ? 'ascending' : 'descending') : 'none'}>
      <button
        type="button"
        onClick={() => onSort({ sort: field, direction: active && direction === 'ASC' ? 'DESC' : 'ASC' })}
      >
        {SORT_LABELS[field]}
        {active && <span aria-hidden="true">{direction === 'ASC' ? '▲' : '▼'}</span>}
      </button>
    </th>
  );
}

export function TicketsTable({ tickets, busy, sort, direction, onSort, onSetDueDate }: Props) {
  if (tickets.length === 0 && !busy) return <p>Sin resultados</p>;

  return (
    <div className="table-scroll">
      <table aria-busy={busy} style={{ opacity: busy ? 0.5 : 1 }}>
        <caption>Tickets de seguridad</caption>
        <thead>
          <tr>
            {SORT_FIELDS.map((field) => (
              <SortHeader key={field} field={field} sort={sort} direction={direction} onSort={onSort} />
            ))}
          </tr>
        </thead>
        <tbody>
          {tickets.map((t) => (
            <TicketRow key={t.id} ticket={t} onSetDueDate={onSetDueDate} />
          ))}
        </tbody>
      </table>
    </div>
  );
}
