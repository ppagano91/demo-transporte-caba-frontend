import { useMemo, useState } from "react";
import EcobiciMapView from "../components/EcobiciMapView";
import SectionOverview from "../components/SectionOverview";
import { useEcobiciStations } from "../hooks/useEcobiciStations";
import type { EcobiciStationMerged } from "../types/ecobici";

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
      <section className="page-split-layout">
        <div className="page-split-sidebar">
          <SectionOverview
            kicker="Operacion"
            title="Estado general de estaciones"
            // description="Resumen, refresco y exploracion detallada reunidos en un panel lateral para dejar el mapa siempre visible."
            actions={
              <>
                <button
                  className="secondary"
                  onClick={refreshNow}
                  disabled={loading || isRefreshing}
                >
                  Actualizar ahora
                </button>

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
              </>
            }
            metrics={[
              { label: "Estaciones totales", value: stations.length },
              { label: "Estaciones visibles", value: visibleStations.length },
              {
                label: "Filtros",
                value: hasActiveFilters ? "Aplicados" : "Sin filtros",
                tone: hasActiveFilters ? "accent" : "default",
              },
            ]}
            isRefreshing={isRefreshing}
            lastUpdated={lastUpdated}
          />

          {error && (
            <div className="state-banner-static error">Error: {error}</div>
          )}
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

          <article className="ecobici-card ecobici-stations-card">
            <div className="ecobici-section-header">
              <div className="ecobici-section-heading">
                <p className="section-kicker">Exploracion</p>
                <h2>Tabla y filtros</h2>
              </div>
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
        </div>

        <div className="page-split-main">
          <article className="ecobici-card ecobici-map-card ecobici-map-card-primary map-feature-card">
            <div className="ecobici-section-header">
              <div className="ecobici-section-heading">
                <p className="section-kicker">Vista principal</p>
                <h2>Mapa de estaciones</h2>
                <p className="ecobici-section-copy">
                  Vista principal de estaciones con el mapa siempre disponible
                  como elemento dominante de la pantalla.
                </p>
              </div>
              <div className="ecobici-map-badges">
                <span className="badge">{stations.length} totales</span>
                <span className={`badge ${hasActiveFilters ? "filtered" : ""}`}>
                  {visibleStations.length} visibles
                </span>
              </div>
            </div>

            <div className="ecobici-map-panel">
              <EcobiciMapView stations={visibleStations} />
            </div>
          </article>
        </div>
      </section>
    </section>
  );
}

export default EcobiciPage;
