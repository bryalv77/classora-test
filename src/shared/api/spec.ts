import type { OpenAPIV3 } from 'openapi-types';
import { parse } from 'yaml';
import contract from '../../../openapi-rest.yml?raw';
import { derefIn } from './deref';

export const spec = parse(contract) as OpenAPIV3.Document;

export const deref = <T extends object>(node: T | OpenAPIV3.ReferenceObject): T => derefIn(spec, node);

export function required<T>(value: T | undefined, what: string): T {
  if (value === undefined) throw new Error(`openapi-rest.yml: missing ${what}`);
  return value;
}
