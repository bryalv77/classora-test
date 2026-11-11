import { readFileSync } from 'node:fs';
import { resolve as resolvePath } from 'node:path';
import { pathToFileURL } from 'node:url';
import { renderHook } from '@testing-library/react';
import openapiTS, { astToString } from 'openapi-typescript';
import { describe, expect, it } from 'vitest';
import { listTicketsParams as P } from '@/shared/api/contract';
import { generateContract } from '@/shared/api/generate-contract';
import { routerWrapper } from '@/test/utils';
import { useTicketListParams, DEFAULTS } from './hooks/useTicketListParams';

const read = (path: string) => readFileSync(resolvePath(path), 'utf8');

const setup = (qs: string) => renderHook(() => useTicketListParams(), { wrapper: routerWrapper(`/?${qs}`) }).result.current.params;

describe('contract <-> code', () => {
  it('generated types are up to date with openapi-rest.yml (run `pnpm generate`)', async () => {
    const generated = astToString(await openapiTS(pathToFileURL(resolvePath('openapi-rest.yml'))));
    expect(read('src/shared/api/schema.d.ts')).toContain(generated);
  });

  it('generated constants are up to date with openapi-rest.yml (run `pnpm generate`)', () => {
    expect(read('src/shared/api/contract.ts')).toBe(generateContract(read('openapi-rest.yml')));
  });

  it('the hook enforces the limits of the contract', () => {
    expect(setup(`offset=${P.offset.minimum}`).offset).toBe(P.offset.minimum);
    expect(setup(`offset=${P.offset.minimum - 1}`).offset).toBe(DEFAULTS.offset);
    expect(setup(`offset=${P.offset.maximum + 1}`).offset).toBe(DEFAULTS.offset);
    expect(setup(`limit=${P.limit.minimum}`).limit).toBe(P.limit.minimum);
    expect(setup(`limit=${P.limit.maximum}`).limit).toBe(P.limit.maximum);
    expect(setup(`limit=${P.limit.minimum - 1}`).limit).toBe(DEFAULTS.limit);
    expect(setup(`limit=${P.limit.maximum + 1}`).limit).toBe(DEFAULTS.limit);
    expect(setup(`q=${'a'.repeat(P.q.maxLength)}`).q).toHaveLength(P.q.maxLength);
    expect(setup(`q=${'a'.repeat(P.q.maxLength + 1)}`).q).toBe(DEFAULTS.q);
  });

  it.each(['state', 'severity', 'sort', 'direction'] as const)(
    'the hook accepts every value of the "%s" enum and rejects others',
    (key) => {
      for (const value of P[key].enum) expect(setup(`${key}=${value}`)[key]).toBe(value);
      expect(setup(`${key}=NOPE`)[key]).toBe(DEFAULTS[key]);
    },
  );
});
