import { act, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { TicketFilters } from './TicketFilters';
import { DEFAULTS } from '../hooks/useTicketListParams';

beforeEach(() => vi.useFakeTimers({ shouldAdvanceTime: true }));
afterEach(() => vi.useRealTimers());

const setup = (params = DEFAULTS) => {
  const onChange = vi.fn();
  const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
  const view = render(<TicketFilters params={params} onChange={onChange} />);
  return { onChange, user, ...view };
};

describe('TicketFilters', () => {
  it('exposes every control by its label', () => {
    setup();
    for (const name of ['Buscar', 'Estado', 'Severidad']) {
      expect(screen.getByLabelText(name)).toBeInTheDocument();
    }
  });

  it('offers PENDING_SECURITY and every severity, and shows the current values', () => {
    setup({ ...DEFAULTS, state: 'DONE', severity: 'LOW' });
    expect(screen.getByRole('option', { name: 'Pendiente de seguridad' })).toBeInTheDocument();
    expect(screen.getByLabelText('Estado')).toHaveValue('DONE');
    expect(screen.getByLabelText('Severidad')).toHaveValue('LOW');
    expect(screen.getAllByRole('option', { name: /Crítica|Alta|Media|Baja/ })).toHaveLength(4);
  });

  it.each([
    ['Estado', 'IN_PROGRESS', { state: 'IN_PROGRESS' }],
    ['Severidad', 'CRITICAL', { severity: 'CRITICAL' }],
  ])('changing %s calls onChange with the patch', async (label, value, patch) => {
    const { onChange, user } = setup();
    await user.selectOptions(screen.getByLabelText(label), value);
    expect(onChange).toHaveBeenCalledWith(patch);
  });

  it('debounces the search: one call with the final text, not one per keystroke', async () => {
    const { onChange, user } = setup();
    await user.type(screen.getByLabelText('Buscar'), 'log4j');
    expect(onChange).not.toHaveBeenCalled();
    act(() => vi.advanceTimersByTime(300));
    expect(onChange).toHaveBeenCalledTimes(1);
    expect(onChange).toHaveBeenCalledWith({ q: 'log4j' });
  });

  it('does not call onChange when the text already matches the URL value', () => {
    setup({ ...DEFAULTS, q: 'log' });
    act(() => vi.advanceTimersByTime(1000));
    expect(screen.getByLabelText('Buscar')).toHaveValue('log');
  });

  it('resyncs the input when the URL changes from outside (back/forward, reset)', () => {
    const { rerender, onChange } = setup({ ...DEFAULTS, q: 'log' });
    rerender(<TicketFilters params={{ ...DEFAULTS, q: '' }} onChange={onChange} />);
    expect(screen.getByLabelText('Buscar')).toHaveValue('');
    act(() => vi.advanceTimersByTime(1000));
    expect(onChange).not.toHaveBeenCalled();
  });
});
