import { useEffect, useState } from 'react';
import { SEVERITY_LABELS, STATE_LABELS } from '../labels';
import { SEVERITIES, TICKET_STATES, type TicketListParams } from '../types';

type Props = {
  params: TicketListParams;
  onChange: (patch: Partial<Omit<TicketListParams, 'offset' | 'limit'>>) => void;
};

const SEARCH_DEBOUNCE_MS = 300;

export function TicketFilters({ params, onChange }: Props) {
  const [text, setText] = useState(params.q);
  const [prevQ, setPrevQ] = useState(params.q);
  if (params.q !== prevQ) {
    setPrevQ(params.q);
    setText(params.q);
  }

  useEffect(() => {
    if (text.trim() === params.q) return;
    const id = setTimeout(() => onChange({ q: text }), SEARCH_DEBOUNCE_MS);
    // Ponemos debounce aqui en vez de en el hook por que el single source of truth es el URL, mientras que aqui el input necesita su propio estado local
    return () => clearTimeout(id);
  }, [text, params.q, onChange]);

  return (
    <form role="search" onSubmit={(e) => e.preventDefault()}>
      <label>
        Buscar <input type="search" value={text} maxLength={100} onChange={(e) => setText(e.target.value)} />
      </label>
      <label>
        Estado
        <select value={params.state} onChange={(e) => onChange({ state: e.target.value as TicketListParams['state'] })}>
          {(['ALL', ...TICKET_STATES] as const).map((s) => (
            <option key={s} value={s}>{STATE_LABELS[s]}</option>
          ))}
        </select>
      </label>
      <label>
        Severidad
        <select value={params.severity} onChange={(e) => onChange({ severity: e.target.value as TicketListParams['severity'] })}>
          {(['ALL', ...SEVERITIES] as const).map((s) => (
            <option key={s} value={s}>{SEVERITY_LABELS[s]}</option>
          ))}
        </select>
      </label>
    </form>
  );
}
