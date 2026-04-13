import { useMemo, useState } from "react";
import EcobiciMapView from "../components/EcobiciMapView";
import { useEcobiciStations } from "../hooks/useEcobiciStations";
import type { EcobiciStationMerged } from "../types/ecobici";

const formatLastUpdate = (value: Date | null): string => {
  if (!value) {
    return "-";
  }
  return new Intl.DateTimeFormat("es-AR", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).format(value);
};

const stationKey = (station: EcobiciStationMerged, index: number): string => {
  return station.external_id ?? `${station.station_id}-${index}`;
};

function EcobiciPage() {
  const [refreshIntervalMs, setRefreshIntervalMs] = useState(15000);
  const [textFilter, setTextFilter] = useState("");
  const [inServiceOnly, setInServiceOnly] = useState(false);
  const [withBikesOnly, setWithBikesOnly] = useState(false);

  const {
    stations,
    loading,
    error,
    empty,
    isRefreshing,
    lastUpdated,
    refreshNow,
  } = useEcobiciStations({
    refreshIntervalMs,
  });

  const visibleStations = useMemo(() => {
    const normalizedFilter = textFilter.trim().toLowerCase();

    return stations.filter((station) => {
      if (normalizedFilter) {
        // const byName = station.name?.toLowerCase().includes(normalizedFilter);
        const byGroups = station.groups?.some((group) =>
          group.toLowerCase().includes(normalizedFilter),
        );
        const byAddress = station.address
          ?.toLowerCase()
          .includes(normalizedFilter);
        if (!byGroups && !byAddress) {
          return false;
        }
      }

      if (inServiceOnly && station.status !== "IN_SERVICE") {
        return false;
      }

      if (withBikesOnly && (station.num_bikes_available ?? 0) <= 0) {
        return false;
      }

      return true;
    });
  }, [inServiceOnly, stations, textFilter, withBikesOnly]);
  const hasActiveFilters =
    textFilter.trim().length > 0 || inServiceOnly || withBikesOnly;

  return (
    <section className="ecobici-page">
      <header className="app-header">
        <h1>Ecobici Ciudad</h1>
        <p>Mapa y estado operativo de estaciones en tiempo real.</p>
      </header>

      <section className="ecobici-toolbar">
        <div className="ecobici-toolbar-top">
          <div>
            <p className="subte-section-kicker">Resumen</p>
            <h2>Estado general de estaciones</h2>
            <p className="ecobici-toolbar-copy">
              El mapa concentra la vista principal y la tabla queda como espacio
              de exploracion y detalle.
            </p>
          </div>

          <div className="toolbar-controls">
            <button
              className="secondary"
              onClick={refreshNow}
              disabled={loading || isRefreshing}
            >
              Actualizar ahora
            </button>

            <label className="field">
              <span>Intervalo de estado</span>
              <select
                value={refreshIntervalMs}
                onChange={(event) =>
                  setRefreshIntervalMs(Number(event.target.value))
                }
              >
                <option value={10000}>10s</option>
                <option value={15000}>15s</option>
                <option value={30000}>30s</option>
              </select>
            </label>
          </div>
        </div>

        <div className="ecobici-summary-grid">
          <div className="ecobici-summary-item">
            <span className="ecobici-summary-label">Estaciones totales</span>
            <strong>{stations.length}</strong>
          </div>
          <div className="ecobici-summary-item">
            <span className="ecobici-summary-label">Estaciones visibles</span>
            <strong>{visibleStations.length}</strong>
          </div>
          <div className="ecobici-summary-item">
            <span className="ecobici-summary-label">Estado de actualizacion</span>
            <strong
              className={`update-state ${isRefreshing ? "refreshing" : "idle"}`}
            >
              {isRefreshing ? "Actualizando..." : "Estable"}
            </strong>
          </div>
          <div className="ecobici-summary-item">
            <span className="ecobici-summary-label">Ultima actualizacion</span>
            <strong>{formatLastUpdate(lastUpdated)}</strong>
          </div>
        </div>
      </section>

      {error && <div className="state-banner-static error">Error: {error}</div>}
      {!error && loading && (
        <div className="state-banner-static loading">
          Cargando estaciones...
        </div>
      )}
      {!error && !loading && empty && (
        <div className="state-banner-static empty">
          Sin estaciones con coordenadas validas para mostrar.
        </div>
      )}

      <section className="ecobici-layout">
        <article className="ecobici-card ecobici-map-card">
          <div className="ecobici-section-header">
            <div>
              <p className="subte-section-kicker">Vista principal</p>
              <h2>Mapa de estaciones</h2>
              <p className="ecobici-section-copy">
                Visualiza disponibilidad y estado operativo sin compartir espacio
                lateral con la tabla.
              </p>
            </div>
            <span className={`badge ${hasActiveFilters ? "filtered" : ""}`}>
              {visibleStations.length} visibles
            </span>
          </div>

          <div className="ecobici-map-panel">
            <EcobiciMapView stations={visibleStations} />
          </div>
        </article>

        <article className="ecobici-card ecobici-stations-card">
          <div className="ecobici-section-header">
            <div>
              <p className="subte-section-kicker">Exploracion</p>
              <h2>Estaciones y filtros</h2>
              <p className="ecobici-section-copy">
                El buscador y los filtros quedan asociados a la tabla para una
                lectura mas clara del listado.
              </p>
            </div>
            <span className={`badge ${hasActiveFilters ? "filtered" : ""}`}>
              {hasActiveFilters ? "Filtros activos" : "Sin filtros"}
            </span>
          </div>

          <div className="ecobici-table-toolbar">
            <label className="field ecobici-filter-field">
              <span>Buscar por zona o direccion</span>
              <input
                value={textFilter}
                onChange={(event) => setTextFilter(event.target.value)}
                placeholder="Ej: Retiro, Ramos Mejia"
              />
            </label>

            <div className="ecobici-filter-toggles">
              <label className="field inline">
                <span>Solo IN_SERVICE</span>
                <input
                  type="checkbox"
                  checked={inServiceOnly}
                  onChange={(event) => setInServiceOnly(event.target.checked)}
                />
              </label>

              <label className="field inline">
                <span>Solo con bicicletas</span>
                <input
                  type="checkbox"
                  checked={withBikesOnly}
                  onChange={(event) => setWithBikesOnly(event.target.checked)}
                />
              </label>
            </div>
          </div>

          {visibleStations.length === 0 ? (
            <p className="ecobici-empty-state">
              No hay estaciones que coincidan con los filtros actuales.
            </p>
          ) : (
            <div className="ecobici-table-wrap">
              <table className="ecobici-table">
                <thead>
                  <tr>
                    <th>Nombre</th>
                    <th>ID</th>
                    <th>Zona</th>
                    <th>Bicis</th>
                    <th>Anclajes</th>
                    <th>Estado</th>
                  </tr>
                </thead>
                <tbody>
                  {visibleStations.map((station, index) => (
                    <tr key={stationKey(station, index)}>
                      <td>{station.name ?? "-"}</td>
                      <td>{station.station_id}</td>
                      <td>
                        {station.groups.length > 0
                          ? station.groups.join(", ")
                          : "-"}
                      </td>
                      <td>{station.num_bikes_available ?? "-"}</td>
                      <td>{station.num_docks_available ?? "-"}</td>
                      <td>{station.status ?? "Sin estado"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </article>
      </section>
    </section>
  );
}

export default EcobiciPage;
