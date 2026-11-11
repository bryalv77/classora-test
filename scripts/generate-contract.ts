import { readFileSync, writeFileSync } from 'node:fs';
import { generateContract } from '../src/shared/api/generate-contract.ts';

writeFileSync('src/shared/api/contract.ts', generateContract(readFileSync('openapi-rest.yml', 'utf8')));
console.log('openapi-rest.yml -> src/shared/api/contract.ts');
