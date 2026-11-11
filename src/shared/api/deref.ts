import type { OpenAPIV3 } from 'openapi-types';

export function derefIn<T extends object>(spec: OpenAPIV3.Document, node: T | OpenAPIV3.ReferenceObject): T {
  if (!('$ref' in node)) return node;
  const target = node.$ref
    .slice(2) // drop '#/'
    .split('/')
    .reduce<unknown>((current, key) => (current as Record<string, unknown>)[key], spec);
  return derefIn(spec, target as T | OpenAPIV3.ReferenceObject);
}
