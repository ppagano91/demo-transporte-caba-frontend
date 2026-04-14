import {
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
} from "react";
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
  const [mapCardHeight, setMapCardHeight] = useState<number | null>(null);
  const mapCardRef = useRef<HTMLElement | null>(null);

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
  const splitLayoutStyle: CSSProperties | undefined = mapCardHeight
    ? ({
        "--ecobici-reference-height": `${mapCardHeight}px`,
      } as CSSProperties)
    : undefined;
  console.log(mapCardHeight);

  useLayoutEffect(() => {
    const element = mapCardRef.current;

    if (!element) {
      return;
    }

    let frameId = 0;

    const updateHeight = () => {
      cancelAnimationFrame(frameId);
      frameId = requestAnimationFrame(() => {
        const nextHeight = Math.round(element.getBoundingClientRect().height);
        setMapCardHeight((currentHeight) =>
          currentHeight === nextHeight ? currentHeight : nextHeight,
        );
      });
    };

    updateHeight();

    const resizeObserver = new ResizeObserver(() => {
      updateHeight();
    });

    resizeObserver.observe(element);
    window.addEventListener("resize", updateHeight);

    return () => {
      cancelAnimationFrame(frameId);
      resizeObserver.disconnect();
      window.removeEventListener("resize", updateHeight);
    };
  }, []);

  return (
    <section className="ecobici-page">
      <div className="ecobici-summary-stack">
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
      </div>

      <section className="page-split-layout" style={splitLayoutStyle}>
        <div className="page-split-sidebar">
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

              <div
                className="ecobici-filter-toggles"
                role="group"
                aria-label="Filtros rapidos de estaciones"
              >
                <label
                  className={`toggle-control ecobici-filter-toggle ${inServiceOnly ? "is-active" : ""}`}
                >
                  <span className="toggle-control-copy">
                    <span className="toggle-control-label">
                      Solo IN_SERVICE
                    </span>
                    <span className="toggle-control-state">
                      {inServiceOnly ? "Activo" : "Inactivo"}
                    </span>
                  </span>
                  <input
                    type="checkbox"
                    className="toggle-control-input"
                    checked={inServiceOnly}
                    onChange={(event) => setInServiceOnly(event.target.checked)}
                  />
                  <span className="toggle-control-switch" aria-hidden="true">
                    <span className="toggle-control-thumb" />
                  </span>
                </label>

                <label
                  className={`toggle-control ecobici-filter-toggle ${withBikesOnly ? "is-active" : ""}`}
                >
                  <span className="toggle-control-copy">
                    <span className="toggle-control-label">
                      Solo con bicicletas
                    </span>
                    <span className="toggle-control-state">
                      {withBikesOnly ? "Activo" : "Inactivo"}
                    </span>
                  </span>
                  <input
                    type="checkbox"
                    className="toggle-control-input"
                    checked={withBikesOnly}
                    onChange={(event) => setWithBikesOnly(event.target.checked)}
                  />
                  <span className="toggle-control-switch" aria-hidden="true">
                    <span className="toggle-control-thumb" />
                  </span>
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
          <article
            ref={mapCardRef}
            className="ecobici-card ecobici-map-card ecobici-map-card-primary map-feature-card"
          >
            <div className="ecobici-section-header">
              <div className="ecobici-section-heading">
                <p className="section-kicker">Vista principal</p>
                <h2>Mapa de estaciones</h2>
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
