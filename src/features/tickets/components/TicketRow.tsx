import { useState } from 'react';
import { SEVERITY_LABELS, STATE_LABELS } from '../labels';
import type { Ticket } from '../types';

type Props = {
  ticket: Ticket;
  onSetDueDate?: (id: string, dueDate: string) => void;
};

export function TicketRow({ ticket, onSetDueDate }: Props) {
  const [editing, setEditing] = useState(false);
  const [day, setDay] = useState('');

  return (
    <tr>
      <td>{ticket.key}</td>
      <td>{ticket.asset}</td>
      <td>{SEVERITY_LABELS[ticket.severity]}</td>
      <td>{STATE_LABELS[ticket.state]}</td>
      <td>{new Date(ticket.targetDate).toLocaleDateString()}</td>
      <td>
        <div className="due">
        <span>{ticket.dueDate ? new Date(ticket.dueDate).toLocaleDateString() : '—'}</span>
        {onSetDueDate &&
          (editing ? (
            <form
              onSubmit={(e) => {
                e.preventDefault();
                // medio dia en UTC, asi no afecta el timezone para este ejemplo
                onSetDueDate(ticket.id, `${day}T12:00:00Z`);
                setEditing(false);
              }}
            >
              <input
                type="date"
                required
                aria-label={`Fecha de compromiso de ${ticket.key}`}
                value={day}
                onChange={(e) => setDay(e.target.value)}
              />
              <button type="submit">Guardar</button>
              <button type="button" onClick={() => setEditing(false)}>Cancelar</button>
            </form>
          ) : (
            <button
              type="button"
              aria-label={`Fijar fecha de compromiso de ${ticket.key}`}
              // 409 cuando DONE, asi que disabled
              disabled={ticket.state === 'DONE'}
              onClick={() => {
                setDay(ticket.dueDate?.slice(0, 10) ?? '');
                setEditing(true);
              }}
            >
              Fijar fecha
            </button>
          ))}
        </div>
      </td>
      <td>{new Date(ticket.lastModified).toLocaleDateString()}</td>
    </tr>
  );
}
