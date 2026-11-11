import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { describe, expect, it } from 'vitest';
import { server } from '@/test/setup';
import { renderWithProviders } from '@/test/utils';
import { TicketsPage } from './TicketsPage';

const location = () => screen.getByTestId('location').textContent;

const recordRequests = () => {
  const seen: URL[] = [];
  server.use(
    http.get('/api/v1/tickets', ({ request }) => {
      const url = new URL(request.url);
      seen.push(url);
      return HttpResponse.json({ data: [], pagination: { offset: 0, limit: 20, totalElements: 0 } });
    }),
  );
  return seen;
};

describe('TicketsPage', () => {
  it('loads and renders the first page with its pagination', async () => {
    renderWithProviders(<TicketsPage />);
    expect(await screen.findByRole('table')).toBeInTheDocument();
    expect(screen.getAllByRole('row')).toHaveLength(21);
    expect(screen.getByText('1 / 7')).toBeInTheDocument();
  });

  it('counts overdue tickets of the page, ignoring DONE ones', async () => {
    server.use(
      http.get('/api/v1/tickets', () =>
        HttpResponse.json({
          data: [
            { id: '1', key: 'SEC-1', asset: 'a', assignedTeam: null, assignee: 'a@b.c', severity: 'LOW', state: 'REPORTED', targetDate: '2000-01-01T00:00:00Z', dueDate: null, lastModified: '2000-01-01T00:00:00Z' },
            { id: '2', key: 'SEC-2', asset: 'a', assignedTeam: null, assignee: 'a@b.c', severity: 'LOW', state: 'DONE', targetDate: '2000-01-01T00:00:00Z', dueDate: null, lastModified: '2000-01-01T00:00:00Z' },
            { id: '3', key: 'SEC-3', asset: 'a', assignedTeam: null, assignee: 'a@b.c', severity: 'LOW', state: 'REPORTED', targetDate: '2999-01-01T00:00:00Z', dueDate: null, lastModified: '2000-01-01T00:00:00Z' },
          ],
          pagination: { offset: 0, limit: 20, totalElements: 3 },
        }),
      ),
    );
    renderWithProviders(<TicketsPage />);
    expect(await screen.findByText('1 tickets caducados en esta página')).toBeInTheDocument();
  });

  it('shows the empty state when nothing matches', async () => {
    recordRequests();
    renderWithProviders(<TicketsPage />);
    expect(await screen.findByText('Sin resultados')).toBeInTheDocument();
  });

  it('shows an alert on failure and recovers on retry', async () => {
    let fail = true;
    server.use(
      http.get('/api/v1/tickets', () =>
        fail
          ? HttpResponse.json({ title: 'Internal error' }, { status: 500 })
          : HttpResponse.json({ data: [], pagination: { offset: 0, limit: 20, totalElements: 0 } }),
      ),
    );
    renderWithProviders(<TicketsPage />);
    const alert = await screen.findByRole('alert');
    expect(alert).toHaveTextContent('Internal error');

    fail = false;
    await userEvent.click(within(alert).getByRole('button', { name: 'Reintentar' }));
    expect(await screen.findByText('Sin resultados')).toBeInTheDocument();
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it('never sends an invalid manipulated URL to the backend', async () => {
    const seen = recordRequests();
    renderWithProviders(<TicketsPage />, '/tickets?offset=-5&limit=9999&state=FOO');
    await screen.findByText('Sin resultados');
    const sp = seen[0].searchParams;
    expect(sp.get('offset')).toBe('0');
    expect(sp.get('limit')).toBe('20');
    expect(sp.has('state')).toBe(false);
  });

  it('filtering sends the filter and resets the page, keeping a clean URL', async () => {
    const seen = recordRequests();
    renderWithProviders(<TicketsPage />, '/?offset=20');
    await waitFor(() => expect(seen.length).toBeGreaterThan(0));

    await userEvent.selectOptions(screen.getByLabelText('Estado'), 'DONE');
    await waitFor(() => expect(seen.at(-1)!.searchParams.get('state')).toBe('DONE'));
    expect(seen.at(-1)!.searchParams.get('offset')).toBe('0');
    expect(location()).toBe('/?state=DONE');
  });

  it('paginating keeps the filters in the URL and request', async () => {
    renderWithProviders(<TicketsPage />, '/?severity=HIGH');
    await screen.findByRole('table');
    await userEvent.click(screen.getByRole('button', { name: 'Siguiente' }));
    await waitFor(() => expect(location()).toBe('/?offset=20&severity=HIGH'));
    expect(await screen.findByRole('table')).toBeInTheDocument();
  });

  it('applies the severity filter end to end', async () => {
    renderWithProviders(<TicketsPage />, '/?severity=CRITICAL');
    await screen.findByRole('table');
    const rows = screen.getAllByRole('row').slice(1);
    expect(rows.length).toBeGreaterThan(0);
    rows.forEach((r) => expect(r).toHaveTextContent('Crítica'));
  });

  it('sorts from the column headers: URL follows and the direction toggles', async () => {
    renderWithProviders(<TicketsPage />);
    await screen.findByRole('table');

    await userEvent.click(screen.getByRole('button', { name: 'Fecha objetivo' }));
    await waitFor(() => expect(location()).toBe('/?sort=TARGET_DATE&direction=ASC'));
    expect(await screen.findByRole('columnheader', { name: /Fecha objetivo/ })).toHaveAttribute('aria-sort', 'ascending');

    await userEvent.click(screen.getByRole('button', { name: /Fecha objetivo/ }));
    await waitFor(() => expect(location()).toBe('/?sort=TARGET_DATE')); // DESC is the default, so it is not serialized
    expect(await screen.findByRole('columnheader', { name: /Fecha objetivo/ })).toHaveAttribute('aria-sort', 'descending');
  });

  it('sorts the rows by any column', async () => {
    renderWithProviders(<TicketsPage />);
    await screen.findByRole('table');
    await userEvent.click(screen.getByRole('button', { name: 'Clave' }));
    await waitFor(() => expect(screen.getAllByRole('row')[1]).toHaveTextContent('SEC-1000'));

    await userEvent.click(screen.getByRole('button', { name: /Clave/ }));
    await waitFor(() => expect(screen.getAllByRole('row')[1]).toHaveTextContent('SEC-1133'));
  });

  it('sorting resets the page', async () => {
    renderWithProviders(<TicketsPage />, '/?offset=20');
    await screen.findByRole('table');
    await userEvent.click(screen.getByRole('button', { name: 'Asset' }));
    await waitFor(() => expect(location()).toBe('/?sort=ASSET&direction=ASC'));
  });

  it('jumps to the last page when the URL offset is past the end', async () => {
    renderWithProviders(<TicketsPage />, '/?offset=9999');
    await waitFor(() => expect(location()).toBe('/?offset=120')); // 134 tickets, pages of 20
    expect(await screen.findByText('7 / 7')).toBeInTheDocument();
  });

  describe('set commitment date', () => {
    const problem = (status: number) => HttpResponse.json({ title: 'x', status }, { status });
    const firstRow = () => screen.getAllByRole('row')[1];
    const reportedRow = () => screen.getAllByRole('row').slice(1).find((r) => within(r).queryByText('Reportado'))!;
    const setDate = async (row: HTMLElement, day: string) => {
      await userEvent.click(within(row).getByRole('button', { name: /Fijar fecha/ }));
      fireEvent.change(within(row).getByLabelText(/Fecha de compromiso de/), { target: { value: day } });
      await userEvent.click(within(row).getByRole('button', { name: 'Guardar' }));
    };
    const asDate = (day: string) => new Date(`${day}T12:00:00Z`).toLocaleDateString();

    it('shows the action only to users with tickets.update', async () => {
      renderWithProviders(<TicketsPage />);
      expect((await screen.findAllByRole('button', { name: /Fijar fecha/ })).length).toBeGreaterThan(0);
    });

    it('hides it without the permission', async () => {
      server.use(http.get('/api/v1/me', () => HttpResponse.json({ permissions: ['tickets.read'] })));
      renderWithProviders(<TicketsPage />);
      await screen.findByRole('table');
      await waitFor(() => expect(screen.queryByRole('button', { name: /Fijar fecha/ })).not.toBeInTheDocument());
    });

    it('hides it if /me fails (fails closed)', async () => {
      server.use(http.get('/api/v1/me', () => problem(401)));
      renderWithProviders(<TicketsPage />);
      await screen.findByRole('table');
      expect(screen.queryByRole('button', { name: /Fijar fecha/ })).not.toBeInTheDocument();
    });

    it('200: the row updates, and leaves a REPORTED filter once the server confirms', async () => {
      renderWithProviders(<TicketsPage />, '/?state=REPORTED');
      await screen.findByRole('table');
      const row = reportedRow();
      const key = within(row).getAllByRole('cell')[0].textContent!;

      await setDate(row, '2026-12-01');
      await waitFor(() => expect(screen.queryByText(key)).not.toBeInTheDocument());
      expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    });

    it('optimistic: new date and state are visible while the request is pending', async () => {
      let release!: (r: Response) => void;
      server.use(http.patch('/api/v1/tickets/:id', () => new Promise<Response>((resolve) => (release = resolve))));
      renderWithProviders(<TicketsPage />, '/?state=REPORTED');
      await screen.findByRole('table');
      const row = reportedRow();
      const key = within(row).getAllByRole('cell')[0].textContent!;

      await setDate(row, '2026-12-01');
      const updated = await screen.findByText(key).then((c) => c.closest('tr')!);
      expect(within(updated).getByText('En curso')).toBeInTheDocument();
      expect(within(updated).getByText(asDate('2026-12-01'))).toBeInTheDocument();
      release(HttpResponse.json({}, { status: 500 }));
    });

    it('403: reverts the row and tells the user', async () => {
      server.use(http.patch('/api/v1/tickets/:id', () => problem(403)));
      renderWithProviders(<TicketsPage />);
      await screen.findByRole('table');
      const row = reportedRow();
      const key = within(row).getAllByRole('cell')[0].textContent!;

      await setDate(row, '2026-12-01');
      expect(await screen.findByRole('alert')).toHaveTextContent('No tienes permiso');
      const after = screen.getByText(key).closest('tr')!;
      expect(within(after).getByText('Reportado')).toBeInTheDocument();
      expect(within(after).queryByText(asDate('2026-12-01'))).not.toBeInTheDocument();
    });

    it('409: reverts the row and explains that the ticket is closed', async () => {
      server.use(http.patch('/api/v1/tickets/:id', () => problem(409)));
      renderWithProviders(<TicketsPage />);
      await screen.findByRole('table');
      const row = reportedRow();
      const key = within(row).getAllByRole('cell')[0].textContent!;

      await setDate(row, '2026-12-01');
      expect(await screen.findByRole('alert')).toHaveTextContent('no se puede modificar');
      expect(within(screen.getByText(key).closest('tr')!).getByText('Reportado')).toBeInTheDocument();
    });

    it('a failed save does not leave a stale error: the next attempt clears it', async () => {
      server.use(http.patch('/api/v1/tickets/:id', () => problem(409), { once: true }));
      renderWithProviders(<TicketsPage />);
      await screen.findByRole('table');
      await setDate(reportedRow(), '2026-12-01');
      await screen.findByRole('alert');

      await setDate(reportedRow(), '2026-12-02');
      await waitFor(() => expect(screen.queryByRole('alert')).not.toBeInTheDocument());
      expect(firstRow()).toBeInTheDocument();
    });
  });
});
