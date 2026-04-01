import { useMemo, useState } from "react";
import { useSubteForecast } from "../hooks/useSubteForecast";
import type { SubteEntityForecast } from "../types/subte";

const formatDateTime = (unixSeconds?: number): string => {
  if (!unixSeconds || !Number.isFinite(unixSeconds)) {
    return "-";
  }
  return new Date(unixSeconds * 1000).toLocaleString("es-AR");
};

const formatDelay = (seconds?: number): string => {
  if (seconds === undefined || seconds === null || !Number.isFinite(seconds)) {
    return "-";
  }
  return `${seconds}s`;
};

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

const entityKey = (entity: SubteEntityForecast, index: number): string => {
  return entity.ID ?? entity.Linea?.Trip_Id ?? `entity-${index}`;
};

function SubteForecastPage() {
  const [autoRefreshEnabled, setAutoRefreshEnabled] = useState(true);
  const [refreshIntervalMs, setRefreshIntervalMs] = useState(15000);

  const { data, loading, error, empty, isRefreshing, lastUpdated, refreshNow } =
    useSubteForecast({
      refreshIntervalMs,
      autoRefreshEnabled,
    });

  const totalEntities = data?.entities.length ?? 0;
  const orderedEntities = useMemo(() => data?.entities ?? [], [data]);

  return (
    <section className="subte-page">
      <header className="app-header">
        <h1>Pronostico GTFS Subtes</h1>
        <p>Consulta de forecastGTFS desde el backend local.</p>
      </header>

      <section className="subte-toolbar">
        <div className="toolbar-controls">
          <button
            onClick={refreshNow}
            disabled={loading || isRefreshing}
            className="secondary"
          >
            Actualizar ahora
          </button>

          <label className="field inline">
            <span>Auto refresh</span>
            <input
              type="checkbox"
              checked={autoRefreshEnabled}
              onChange={(event) => setAutoRefreshEnabled(event.target.checked)}
            />
          </label>

          <label className="field">
            <span>Intervalo</span>
            <select
              value={refreshIntervalMs}
              disabled={!autoRefreshEnabled}
              onChange={(event) => setRefreshIntervalMs(Number(event.target.value))}
            >
              <option value={10000}>10s</option>
              <option value={15000}>15s</option>
              <option value={30000}>30s</option>
            </select>
          </label>
        </div>

        <div className="toolbar-status">
          <span className="badge">Viajes: {totalEntities}</span>
          <span className="badge">
            Timestamp Header: {formatDateTime(data?.headerTimestamp)}
          </span>
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
        <div className="state-banner-static loading">Cargando pronostico...</div>
      )}
      {!error && !loading && empty && (
        <div className="state-banner-static empty">Sin entidades en la respuesta.</div>
      )}

      {!error && !loading && !empty && (
        <section className="subte-entities">
          {orderedEntities.map((entity, index) => {
            const linea = entity.Linea;
            const estaciones = linea?.Estaciones ?? [];

            return (
              <article key={entityKey(entity, index)} className="subte-card">
                <h2>{entity.ID ?? `Entidad #${index + 1}`}</h2>
                <div className="subte-meta">
                  <span>
                    <strong>Trip_Id:</strong> {linea?.Trip_Id ?? "-"}
                  </span>
                  <span>
                    <strong>Route_Id:</strong> {linea?.Route_Id ?? "-"}
                  </span>
                  <span>
                    <strong>Direction_ID:</strong>{" "}
                    {linea?.Direction_ID !== undefined ? linea.Direction_ID : "-"}
                  </span>
                  <span>
                    <strong>start_time:</strong> {linea?.start_time ?? "-"}
                  </span>
                  <span>
                    <strong>start_date:</strong> {linea?.start_date ?? "-"}
                  </span>
                </div>

                {estaciones.length === 0 ? (
                  <p className="subte-no-stations">Esta entidad no tiene estaciones.</p>
                ) : (
                  <div className="subte-table-wrap">
                    <table className="subte-table">
                      <thead>
                        <tr>
                          <th>Estacion</th>
                          <th>Stop ID</th>
                          <th>Arrival time</th>
                          <th>Arrival delay</th>
                          <th>Departure time</th>
                          <th>Departure delay</th>
                        </tr>
                      </thead>
                      <tbody>
                        {estaciones.map((station, stationIndex) => (
                          <tr
                            key={`${entityKey(entity, index)}-${station.stop_id ?? "stop"}-${stationIndex}`}
                          >
                            <td>{station.stop_name ?? "-"}</td>
                            <td>{station.stop_id ?? "-"}</td>
                            <td>{formatDateTime(station.arrival?.time)}</td>
                            <td>{formatDelay(station.arrival?.delay)}</td>
                            <td>{formatDateTime(station.departure?.time)}</td>
                            <td>{formatDelay(station.departure?.delay)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </article>
            );
          })}
        </section>
      )}
    </section>
  );
}

export default SubteForecastPage;
