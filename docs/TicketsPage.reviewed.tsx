/*
 * PR REVIEW:
 *
 *  - El endpoint no existe en el contrato acordado, se acordo Get Tickets y Update Ticket. Pero la url nunca hablaba del Team o el TeamId
 *    Ademas, el equipo no deberia mandarse desde el cliente: que tickets puede ver un usuario lo decide el backend a partir de su token
 *    (Bearer y permisos de /me). Si el cliente manda el teamId, cualquiera que edite la URL podria pedir tickets de otro equipo (IDOR),
 *    salvo que el backend lo vuelva a validar. `assignedTeam` es solo un dato del ticket, no un mecanismo de acceso.
 *  - Agregar manejo de errores. Por ahora se queda el spinner o se rompe.
 *  - Los URL params no han sido validados (offset=NaN, state=FOO, ...) y van directo al backend
 *  - El valor de `q` no se encodea en URL asi que podemos tener query-param injection o request que fallen
 *
 *  - Race condition: Si hacemos dos peticiones seguidas, y la vieja tarda mas, pues pisamos el resultado de la nueva y mostramos resultados erroneos.
 *  - Tenemos `q` en el estado local `useState` del input y tambien en el URL. deberíamos tener un solo valor como single source of truth
 *  - Si estamos en una página como la 5 por ejemplo. y filtramos a alguno con pocos resultados el offset se mantiene y pedimos una página que no existe. entonces deberiamos poner siempre offset = 0 cuando hay cambios en el filtro
 *  - "ALL" no hace falta enviarlo: es el default del contrato (sin filtro).
 *  - Tampoco veo el PENDING_SECURITY entre las opciones
 *  - Tampoco veo que se haya implementado filtro por severity. En el contrato tenemos que el endpoint soporta filtro por severity.
 *  - Tampoco veo que se haya implementado el sort en el front. En el contrato tenemos que el endpoint soporta sort.
 *  - En el useEffect nos faltan dependencias, como limit, o en este caso teamId, si se actualiza uno de estos valores, tendremos data desactualizada
 *  - Estamos usando any[] cuando tenemos tipos bien definidos
 *  - No deberíamos usar key={i} usar el índice como key hace que React asocie cada fila a su posición y no al ticket, si hay cambio de data por algun filtro o paginación, podemos tener conflictos
 *  - `onChange={() => setTickets([...tickets])}` no entiendo que hace esto realmente.. si se quería hacer una actualización de un ticket en concreto se debería hacer de otra forma.
 *  - <p>{expired.length} tickets caducados</p> solo muestra los de la página actual, no el total, además incluye los DONE y recalcula su valor en cada fila, hace new Date en cada fila.
 *  - La interfaz se puede mejorar agregando mensajes de estado tipo "Sin resultados" cuando no existan.
 *  - La interfaz ademas, cuando se esta cargando datos, se ve el spinner, pero si se ha cambiado el filtro y el request tarda mucho, se siguen viendo valores antiguos. se puede atenuar la tabla.
 *  - Problema con searchParams.set(...) modifica directamente el objeto que devuelve el hook (mutación en sitio) en vez de trabajar sobre una copia con setSearchParams(prev => ...), y cada cambio de filtro añade una entrada al historial en lugar de reemplazarla, asi evitamos que el boton de back del browser funcione de forma correcta.
 *  - Cosas de accesibilidad se pueden mejorar como darle labels a todos los controles, poner headers a las tablas
 *  - Se usan strings hardcodeados en español, es esto correcto? o se debe usar alguna librería tipo i18n para los strings?
 *  - Se podría separar este componente en varios, por que hacemos el URL parsing, el fetching, el manejo de estado y la renderización en uno solo. esto dificulta el reuso y el testeo
 */

export function TicketsPage() {
  const { teamId } = useParams();
  const [searchParams, setSearchParams] = useSearchParams();
  // REVIEW: Estamos usando any[] cuando tenemos tipos bien definidos
  const [tickets, setTickets] = useState<any[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  // REVIEW: Tenemos `q` en el estado local `useState` del input y tambien en el URL. deberíamos tener un solo valor como single source of truth
  const [search, setSearch] = useState(searchParams.get("q") ?? "");
  // REVIEW: Los URL params no han sido validados (offset=NaN, state=FOO, ...) y van directo al backend
  const offset = parseInt(searchParams.get("offset")!);
  const limit = 20;
  // REVIEW: Los URL params no han sido validados (offset=NaN, state=FOO, ...) y van directo al backend
  // REVIEW: "ALL" no hace falta enviarlo: es el default del contrato (sin filtro).
  const state = searchParams.get("state") || "ALL";

  // REVIEW: Race condition: Si hacemos dos peticiones seguidas, y la vieja tarda mas, pues pisamos el resultado de la nueva y mostramos resultados erroneos.
  useEffect(() => {
    setLoading(true);
    // REVIEW: El endpoint no existe en el contrato acordado, se acordo Get Tickets y Update Ticket. Pero la url nunca hablaba del Team o el TeamId
    // REVIEW: El equipo no deberia mandarse desde el cliente: el backend decide que tickets ve el usuario segun su token (Bearer / permisos de /me).
    //         Si el cliente manda el teamId, editar la URL permitiria pedir tickets de otro equipo (IDOR) salvo que el backend lo revalide.
    // REVIEW: El valor de `q` no se encodea en URL asi que podemos tener query-param injection o request que fallen
    // REVIEW: "ALL" no hace falta enviarlo: es el default del contrato (sin filtro).
    // REVIEW: Tampoco veo que se haya implementado filtro por severity ni sort. En el contrato el endpoint soporta ambos.
    fetch(`/api/v1/teams/${teamId!}/tickets?offset=${offset}&limit=${limit}&state=${state}&q=${search}`)
    // REVIEW: Agregar manejo de errores. Por ahora se queda el spinner o se rompe
    .then((r) => r.json())
    .then((body) => {
      setTickets(body.data);
      setTotal(body.pagination.totalElements);
      // REVIEW: Agregar manejo de errores. Por ahora se queda el spinner (si falla algo antes, nunca se llega a esta línea)
      setLoading(false);
    });
  // REVIEW: En el useEffect nos faltan dependencias, como limit, o en este caso teamId, si se actualiza uno de estos valores, tendremos data desactualizada
  }, [offset, state, search]);

  const changeState = (value: string) => {
    // REVIEW: Problema con searchParams.set(...) modifica directamente el objeto que devuelve el hook (mutación en sitio) en vez de trabajar sobre una copia con setSearchParams(prev => ...), y cada cambio de filtro añade una entrada al historial en lugar de reemplazarla
    // REVIEW: Si estamos en una página como la 5 por ejemplo. y filtramos a alguno con pocos resultados el offset se mantiene y pedimos una página que no existe. entonces deberiamos poner siempre offset = 0 cuando hay cambios en el filtro
    searchParams.set("state", value);
    setSearchParams(searchParams);
  };

  // REVIEW: <p>{expired.length} tickets caducados</p> solo muestra los de la página actual, no el total, además incluye los DONE y recalcula su valor en cada fila, hace new Date en cada fila.
  const expired = tickets.filter((t) => new Date(t.targetDate) < new Date());

  return (
    <div>
      {/* REVIEW: Cosas de accesibilidad se pueden mejorar como darle labels a todos los controles */}
      <input value={search} onChange={(e) => setSearch(e.target.value)} />
      {/* REVIEW: Tampoco veo el PENDING_SECURITY entre las opciones */}
      {/* REVIEW: Tampoco veo que se haya implementado filtro por severity ni sort. En el contrato el endpoint soporta ambos. */}
      {/* REVIEW: Se usan strings hardcodeados en español, es esto correcto? o se debe usar alguna librería tipo i18n para los strings? */}
      <select value={state} onChange={(e) => changeState(e.target.value)}>
        {/* REVIEW: "ALL" no hace falta enviarlo: es el default del contrato (sin filtro). */}
        <option value="ALL">Todos</option>
        <option value="REPORTED">Reportado</option>
        <option value="IN_PROGRESS">En curso</option>
        <option value="DONE">Hecho</option>
      </select>
      {/* REVIEW: La interfaz ademas, cuando se esta cargando datos, se ve el spinner, pero si se ha cambiado el filtro y el request tarda mucho, se siguen viendo valores antiguos. se puede atenuar la tabla. */}
      {loading && <Spinner />}
      {/* REVIEW: <p>{expired.length} tickets caducados</p> solo muestra los de la página actual, no el total, además incluye los DONE y recalcula su valor en cada fila, hace new Date en cada fila. */}
      <p>{expired.length} tickets caducados</p>
      {/* REVIEW: Cosas de accesibilidad se pueden mejorar como poner headers a las tablas */}
      {/* REVIEW: La interfaz se puede mejorar agregando mensajes de estado tipo "Sin resultados" cuando no existan. */}
      <table>
        <tbody>
        {/* REVIEW: No deberíamos usar key={i} usar el índice como key hace que React asocie cada fila a su posición y no al ticket, si hay cambio de data por algun filtro o paginación, podemos tener conflictos */}
        {/* REVIEW: `onChange={() => setTickets([...tickets])}` no entiendo que hace esto realmente.. si se quería hacer una actualización de un ticket en concreto se debería hacer de otra forma. */}
        {tickets.map((t, i) => (<TicketRow key={i} ticket={t} onChange={() => setTickets([...tickets])} />))}
        </tbody>
      </table>
      <Pagination
        total={total}
        offset={offset}
        limit={limit}
        onChange={(o: number) => {
          // REVIEW: Problema con searchParams.set(...) modifica directamente el objeto que devuelve el hook (mutación en sitio) en vez de trabajar sobre una copia con setSearchParams(prev => ...)
          searchParams.set("offset", String(o));
          setSearchParams(searchParams);
        }}
      />
    </div>
  );
}
// REVIEW: Se podría separar este componente en varios, por que hacemos el URL parsing, el fetching, el manejo de estado y la renderización en uno solo. esto dificulta el reuso y el testeo
