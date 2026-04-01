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

  const { stations, loading, error, empty, isRefreshing, lastUpdated, refreshNow } =
    useEcobiciStations({
      refreshIntervalMs,
    });

  const visibleStations = useMemo(() => {
    const normalizedFilter = textFilter.trim().toLowerCase();

    return stations.filter((station) => {
      if (normalizedFilter) {
        const byName = station.name?.toLowerCase().includes(normalizedFilter);
        const byAddress = station.address
          ?.toLowerCase()
          .includes(normalizedFilter);
        if (!byName && !byAddress) {
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

  return (
    <section className="ecobici-page">
      <header className="app-header">
        <h1>Ecobici Ciudad</h1>
        <p>Mapa y estado operativo de estaciones en tiempo real.</p>
      </header>

      <section className="ecobici-toolbar">
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
              onChange={(event) => setRefreshIntervalMs(Number(event.target.value))}
            >
              <option value={10000}>10s</option>
              <option value={15000}>15s</option>
              <option value={30000}>30s</option>
            </select>
          </label>

          <label className="field ecobici-filter-field">
            <span>Buscar por nombre o direccion</span>
            <input
              value={textFilter}
              onChange={(event) => setTextFilter(event.target.value)}
              placeholder="Ej: Retiro, Ramos Mejia"
            />
          </label>

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

        <div className="toolbar-status">
          <span className="badge">Estaciones totales: {stations.length}</span>
          <span className="badge">Estaciones visibles: {visibleStations.length}</span>
          <span className={`update-state ${isRefreshing ? "refreshing" : "idle"}`}>
            {isRefreshing ? "Actualizando..." : "Estable"}
          </span>
          <span className="last-updated">
            Ultima actualizacion: {formatLastUpdate(lastUpdated)}
          </span>
        </div>
      </section>

      {error && <div className="state-banner-static error">Error: {error}</div>}
      {!error && loading && (
        <div className="state-banner-static loading">Cargando estaciones...</div>
      )}
      {!error && !loading && empty && (
        <div className="state-banner-static empty">
          Sin estaciones con coordenadas validas para mostrar.
        </div>
      )}

      <section className="ecobici-content">
        <div className="ecobici-map-panel">
          <EcobiciMapView stations={visibleStations} />
        </div>

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
                  <td>{station.groups.length > 0 ? station.groups.join(", ") : "-"}</td>
                  <td>{station.num_bikes_available ?? "-"}</td>
                  <td>{station.num_docks_available ?? "-"}</td>
                  <td>{station.status ?? "Sin estado"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </section>
  );
}

export default EcobiciPage;
