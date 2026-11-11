import { fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { makeTicket } from '../fixtures';
import { TicketRow } from './TicketRow';

const renderRow = (over = {}, onSetDueDate?: (id: string, dueDate: string) => void) =>
  render(<table><tbody><TicketRow ticket={makeTicket(over)} onSetDueDate={onSetDueDate} /></tbody></table>);

describe('TicketRow', () => {
  it('shows the key, asset and translated severity/state', () => {
    renderRow();
    expect(screen.getByText('SEC-1024')).toBeInTheDocument();
    expect(screen.getByText('payments-api')).toBeInTheDocument();
    expect(screen.getByText('Alta')).toBeInTheDocument();
    expect(screen.getByText('En curso')).toBeInTheDocument();
  });

  it('shows a dash when there is no commitment date', () => {
    renderRow({ dueDate: null });
    expect(screen.getByText('—')).toBeInTheDocument();
  });

  it('shows the formatted commitment date when present', () => {
    renderRow({ dueDate: '2026-11-15T10:00:00Z' });
    expect(screen.queryByText('—')).not.toBeInTheDocument();
    expect(screen.getAllByRole('cell')[5]).toHaveTextContent(/2026|15/);
  });

  describe('set commitment date action', () => {
    const open = () => userEvent.click(screen.getByRole('button', { name: /Fijar fecha de compromiso de SEC-1024/ }));

    it('is not rendered without permission (no handler)', () => {
      renderRow();
      expect(screen.queryByRole('button')).not.toBeInTheDocument();
    });

    it('is rendered when the handler is given', () => {
      renderRow({}, vi.fn());
      expect(screen.getByRole('button', { name: /Fijar fecha de compromiso de SEC-1024/ })).toBeEnabled();
    });

    it('is disabled for DONE tickets, the server would answer 409', () => {
      renderRow({ state: 'DONE' }, vi.fn());
      expect(screen.getByRole('button', { name: /Fijar fecha de compromiso/ })).toBeDisabled();
    });

    it('sends the chosen day at noon UTC and closes the form', async () => {
      const onSetDueDate = vi.fn();
      renderRow({}, onSetDueDate);
      await open();
      fireEvent.change(screen.getByLabelText('Fecha de compromiso de SEC-1024'), { target: { value: '2026-12-01' } });
      await userEvent.click(screen.getByRole('button', { name: 'Guardar' }));

      expect(onSetDueDate).toHaveBeenCalledWith('id-1', '2026-12-01T12:00:00Z');
      expect(screen.queryByLabelText('Fecha de compromiso de SEC-1024')).not.toBeInTheDocument();
    });

    it('starts from the current due date when there is one', async () => {
      renderRow({ dueDate: '2026-11-15T10:00:00Z' }, vi.fn());
      await open();
      expect(screen.getByLabelText('Fecha de compromiso de SEC-1024')).toHaveValue('2026-11-15');
    });

    it('does not send anything without a date, nor when cancelling', async () => {
      const onSetDueDate = vi.fn();
      renderRow({}, onSetDueDate);
      await open();
      await userEvent.click(screen.getByRole('button', { name: 'Guardar' }));
      expect(onSetDueDate).not.toHaveBeenCalled();
      await userEvent.click(screen.getByRole('button', { name: 'Cancelar' }));
      expect(onSetDueDate).not.toHaveBeenCalled();
      expect(screen.queryByLabelText('Fecha de compromiso de SEC-1024')).not.toBeInTheDocument();
    });
  });
});
