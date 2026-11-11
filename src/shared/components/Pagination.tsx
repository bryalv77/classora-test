type Props = {
  total: number;
  offset: number;
  limit: number;
  onChange: (offset: number) => void;
};

export function Pagination({ total, offset, limit, onChange }: Props) {
  const page = Math.floor(offset / limit) + 1;
  const pages = Math.max(1, Math.ceil(total / limit));

  return (
    <nav aria-label="Paginación">
      <button type="button" disabled={page <= 1} onClick={() => onChange(offset - limit)}>
        Anterior
      </button>
      <span>
        {page} / {pages}
      </span>
      <button type="button" disabled={page >= pages} onClick={() => onChange(offset + limit)}>
        Siguiente
      </button>
    </nav>
  );
}
