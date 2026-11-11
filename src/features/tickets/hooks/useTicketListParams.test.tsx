import { act, renderHook } from '@testing-library/react';
import { useLocation, useNavigate, useNavigationType } from 'react-router';
import { describe, expect, it } from 'vitest';
import { routerWrapper } from '@/test/utils';
import { useTicketListParams } from './useTicketListParams';

const setup = (route = '/') =>
  renderHook(
    () => ({ ...useTicketListParams(), loc: useLocation(), nav: useNavigationType(), navigate: useNavigate() }),
    { wrapper: routerWrapper(route) },
  );

describe('useTicketListParams', () => {
  it('returns the defaults for an empty URL', () => {
    const { result } = setup();
    expect(result.current.params).toEqual({
      offset: 0, limit: 20, q: '', state: 'ALL', severity: 'ALL', sort: 'LAST_MODIFIED', direction: 'DESC',
    });
  });

  it('normalizes a manipulated URL instead of failing', () => {
    const { result } = setup('/?offset=-5&limit=9999&state=FOO&severity=x&sort=NOPE&direction=up');
    expect(result.current.params).toMatchObject({
      offset: 0, limit: 20, state: 'ALL', severity: 'ALL', sort: 'LAST_MODIFIED', direction: 'DESC',
    });
  });

  it.each([['offset=abc'], ['offset=1.5'], ['limit=0'], ['limit=101']])('falls back to defaults for %s', (qs) => {
    const { result } = setup(`/?${qs}`);
    expect(result.current.params.offset).toBe(0);
    expect(result.current.params.limit).toBe(20);
  });

  it('reads valid values from the URL', () => {
    const { result } = setup('/?offset=40&limit=50&q=log4j&state=DONE&severity=HIGH&sort=TARGET_DATE&direction=ASC');
    expect(result.current.params).toEqual({
      offset: 40, limit: 50, q: 'log4j', state: 'DONE', severity: 'HIGH', sort: 'TARGET_DATE', direction: 'ASC',
    });
  });

  it('setFilters resets the page and keeps the other filters', () => {
    const { result } = setup('/?offset=40&state=DONE');
    act(() => result.current.setFilters({ severity: 'HIGH' }));
    expect(result.current.params).toMatchObject({ offset: 0, state: 'DONE', severity: 'HIGH' });
    expect(result.current.loc.search).not.toContain('offset');
  });

  it('changing the sort also resets the page', () => {
    const { result } = setup('/?offset=40');
    act(() => result.current.setFilters({ direction: 'ASC' }));
    expect(result.current.params.offset).toBe(0);
  });

  it('setPage keeps the filters', () => {
    const { result } = setup('/?q=log&state=DONE');
    act(() => result.current.setPage(20));
    expect(result.current.params).toMatchObject({ offset: 20, q: 'log', state: 'DONE' });
  });

  it('keeps the URL clean: default values are not serialized', () => {
    const { result } = setup('/?state=DONE&offset=20');
    act(() => result.current.setFilters({ state: 'ALL' }));
    expect(result.current.loc.search).toBe('');
  });

  it('reset clears everything', () => {
    const { result } = setup('/?q=a&state=DONE&offset=20');
    act(() => result.current.reset());
    expect(result.current.loc.search).toBe('');
    expect(result.current.params.state).toBe('ALL');
  });

  it('typing in q replaces the history entry, other filters push one (back/forward)', () => {
    const { result } = setup();
    act(() => result.current.setFilters({ q: 'log' }));
    expect(result.current.nav).toBe('REPLACE');
    act(() => result.current.setFilters({ state: 'DONE' }));
    expect(result.current.nav).toBe('PUSH');
  });

  it('setPage replace option avoids pushing an entry', () => {
    const { result } = setup();
    act(() => result.current.setPage(20, { replace: true }));
    expect(result.current.nav).toBe('REPLACE');
  });

  it('trims q', () => {
    const { result } = setup('/?q=%20%20log4j%20');
    expect(result.current.params.q).toBe('log4j');
  });

  it('back/forward restore the filters of each history entry', () => {
    const { result } = setup();
    act(() => result.current.setFilters({ state: 'DONE' }));
    act(() => result.current.setPage(20));
    expect(result.current.params).toMatchObject({ state: 'DONE', offset: 20 });

    act(() => void result.current.navigate(-1));
    expect(result.current.params).toMatchObject({ state: 'DONE', offset: 0 });
    act(() => void result.current.navigate(-1));
    expect(result.current.params).toMatchObject({ state: 'ALL', offset: 0 });
    act(() => void result.current.navigate(2));
    expect(result.current.params).toMatchObject({ state: 'DONE', offset: 20 });
  });

  it('keeps unrelated query params when filtering, paging and resetting', () => {
    const { result } = setup('/?utm_source=mail&state=DONE');
    act(() => result.current.setFilters({ severity: 'HIGH' }));
    expect(new URLSearchParams(result.current.loc.search).get('utm_source')).toBe('mail');
    act(() => result.current.setPage(20));
    expect(new URLSearchParams(result.current.loc.search).get('utm_source')).toBe('mail');
    act(() => result.current.reset());
    expect(result.current.loc.search).toBe('?utm_source=mail');
  });

  it('writes a normalized URL even when the caller passes untidy values', () => {
    const { result } = setup();
    act(() => result.current.setFilters({ q: '  log4j ' }));
    expect(result.current.loc.search).toBe('?q=log4j');
    act(() => result.current.setPage(-5));
    expect(result.current.params.offset).toBe(0);
    expect(result.current.loc.search).toBe('?q=log4j');
  });
});
