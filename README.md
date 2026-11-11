# Classora Test

## Pregunta 1:

> En la PR se llama a `/api/v1/teams/${teamId}/tickets`, pero el contrato acordado solo tiene `GET /api/v1/tickets`, sin parámetro de equipo.

> Lo traté como un error a señalar y en mi reescritura ya no uso `teamId`, asumiendo que el backend filtra los tickets según el token del usuario.

> Decisión por defecto: asumo que el backend filtra por token. Si no fuera así, añadiría un parámetro `team` al contrato y la UI lo enviaría.
> ¿es esa la lectura correcta, o la UI debería filtrar por equipo?

1. La PR original con los comentarios de la revisión está en `docs/TicketsPage.reviewed.tsx`.
2. El código de mi propuesta está en `src/features/tickets`

## Pregunta 2
### Parte A
El contrato se encuentra en `openapi-rest.yml`

**¿Cómo evitar que los tipos de TypeScript y el contrato se desincronicen?**

Haría que el contrato OpenAPI sea la única fuente de verdad y no escribiría a mano los tipos de la API.

Los tipos de TypeScript se generan desde `openapi-rest.yml` con `pnpm generate`. 

Si el contrato cambia, cambian los tipos, y `tsc` falla en todos los sitios donde el código ya no encaja.

Los valores por defecto, los límites (`limit` 1..100, `offset` ≥ 0, `maxLength` de `q`) y las listas de valores de cada enum se extraen del contrato en `contract.ts`, y el código (el hook, el mock) los importa. Un test falla si los archivos generados no están al día con el YAML.

Las respuestas se parsean con Zod. Si algo no cumple, falla con un error claro en vez de mostrar datos incorrectos.

### Parte B
El hook está en `src/features/tickets/hooks/useTicketListParams.ts` y sus tests en `useTicketListParams.test.tsx`.

Los defaults y los límites del hook salen del contrato (`contract.ts`, generado con `pnpm generate`), no están escritos a mano.

**URLs manipuladas** (`?offset=-5&limit=9999&state=FOO`): la URL se valida con Zod y cada parámetro inválido cae a su valor por defecto (`.catch()`), así que al backend nunca llega un valor fuera de contrato.

El debounce está en `TicketFilters.tsx` (el componente del input), no en el hook `useTicketListParams`.

- El input guarda su propio texto para que escribir sea instantáneo.
- Cuando el usuario deja de escribir 300 ms, recién ahí se escribe `q` en la URL, y ese cambio de URL es lo que dispara la petición.
- Lo pongo ahí por que el hook solo traduce URL ↔ parámetros y la URL es el single source of truth
- Resultado: una petición por pausa y no por tecla, y el historial no se llena de entradas (el cambio de `q` usa `replace`).

## Pregunta 3

1. `useSetDueDate` modifica el ticket en todas las listas guardadas (`setQueriesData` sobre el prefijo `['tickets','list']`). 
Antes cancela los refetch en curso para que no pisen el valor optimista. Si falla, revierte solo ese ticket, no una copia de toda la lista, así no deshace otras ediciones hechas mientras tanto.

2. **Si la fila ya no cumple el filtro** (por ejemplo `state=REPORTED`): se queda visible hasta que el servidor confirma y ahi el refetch la quitaría. 

Quitarla de una solo la haría saltar y complicaría el rollback.

> al fijar `dueDate`, si el ticket estaba en `REPORTED` la fila pasa a `IN_PROGRESS` al instante (igual que hará el servidor). Si la petición falla, vuelve a `REPORTED` junto con el `dueDate` anterior.

**409 (ticket `DONE`):** se revierte la fila y se avisa al usuario de que el ticket está cerrado y no admite cambios. 

Además, el botón se deshabilita en tickets `DONE` para evitar el caso de antemano.

3. La acción solo se muestra si `/me` incluye `tickets.update`. Mientras `/me` carga, o si falla, no se muestra (falla cerrado). 
Ocultar el botón no basta. la seguridad real es el 403 del backend. 
Si el permiso se revoca con la pantalla abierta, el 403 revierte la fila, avisa al usuario y recarga `/me` para que la acción desaparezca.

4. **Probar 200, 403 y 409 sin backend.** Con MSW el `PATCH` en cada test con `server.use`. Cada caso comprueba el valor optimista, el rollback y el aviso. Están en `useSetDueDate.test.tsx` (hook) y `TicketsPage.test.tsx` (página completa).



## Cómo ejecutarlo

Requiere pnpm y Node 22.18 o superior (el generador del contrato es un script TypeScript que Node ejecuta directamente).

```bash
pnpm install
pnpm dev          # app en modo desarrollo, con la API simulada por MSW (generada desde openapi-rest.yml)
pnpm test         # todos los tests, una sola pasada
pnpm e2e          # tests end-to-end con Playwright (levantan la app solos)
pnpm generate     # regenera desde openapi-rest.yml: tipos (schema.d.ts) y constantes (contract.ts: defaults, límites, enums)
```

La primera vez, para los e2e: `pnpm exec playwright install chromium`.

Si se cambia `openapi-rest.yml`, ejecutar `pnpm generate`: un test falla si los archivos generados no están al día.

El código está en `src/features/tickets`.

---

## URL

https://classora.bryanalvarado.com
