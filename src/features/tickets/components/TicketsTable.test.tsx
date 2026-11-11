import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { makeTicket } from '../fixtures';
import { TicketsTable } from './TicketsTable';

const setup = (over: Partial<React.ComponentProps<typeof TicketsTable>> = {}) => {
  const onSort = vi.fn();
  render(
    <TicketsTable
      busy={false}
      tickets={[makeTicket(), makeTicket({ id: 'id-2', key: 'SEC-1025' })]}
      sort="LAST_MODIFIED"
      direction="DESC"
      onSort={onSort}
      {...over}
    />,
  );
  return { onSort };
};

describe('TicketsTable', () => {
  it('renders an accessible table with column headers and one row per ticket', () => {
    setup();
    const table = screen.getByRole('table', { name: 'Tickets de seguridad' });
    expect(within(table).getAllByRole('columnheader')).toHaveLength(7);
    expect(within(table).getAllByRole('row')).toHaveLength(3);
  });

  it('shows an empty state instead of an empty table', () => {
    setup({ tickets: [] });
    expect(screen.getByText('Sin resultados')).toBeInTheDocument();
    expect(screen.queryByRole('table')).not.toBeInTheDocument();
  });

  it('marks the table busy and dimmed while refetching', () => {
    setup({ busy: true });
    const table = screen.getByRole('table');
    expect(table).toHaveAttribute('aria-busy', 'true');
    expect(table).toHaveStyle({ opacity: '0.5' });
  });

  it('does not show "Sin resultados" while busy with no rows yet', () => {
    setup({ busy: true, tickets: [] });
    expect(screen.queryByText('Sin resultados')).not.toBeInTheDocument();
  });

  describe('sorting from the headers', () => {
    it('every column is sortable', () => {
      setup();
      expect(screen.getAllByRole('button')).toHaveLength(7);
      for (const name of ['Clave', 'Asset', 'Severidad', 'Estado', 'Fecha objetivo', 'Compromiso', 'Última modificación']) {
        expect(screen.getByRole('button', { name })).toBeInTheDocument();
      }
    });

    it('announces the active sort with aria-sort and an arrow', () => {
      setup({ sort: 'ASSET', direction: 'ASC' });
      expect(screen.getByRole('columnheader', { name: /Asset/ })).toHaveAttribute('aria-sort', 'ascending');
      expect(screen.getByRole('columnheader', { name: /Asset/ })).toHaveTextContent('▲');
      expect(screen.getByRole('columnheader', { name: /Clave/ })).toHaveAttribute('aria-sort', 'none');
    });

    it('clicking another column sorts by it ascending', async () => {
      const { onSort } = setup({ sort: 'LAST_MODIFIED', direction: 'DESC' });
      await userEvent.click(screen.getByRole('button', { name: 'Severidad' }));
      expect(onSort).toHaveBeenCalledWith({ sort: 'SEVERITY', direction: 'ASC' });
    });

    it('clicking the active column toggles the direction both ways', async () => {
      const { onSort } = setup({ sort: 'KEY', direction: 'ASC' });
      await userEvent.click(screen.getByRole('button', { name: /Clave/ }));
      expect(onSort).toHaveBeenLastCalledWith({ sort: 'KEY', direction: 'DESC' });
    });

    it('toggles back to ASC when the active column is descending', async () => {
      const { onSort } = setup({ sort: 'KEY', direction: 'DESC' });
      await userEvent.click(screen.getByRole('button', { name: /Clave/ }));
      expect(onSort).toHaveBeenCalledWith({ sort: 'KEY', direction: 'ASC' });
    });
  });
});
