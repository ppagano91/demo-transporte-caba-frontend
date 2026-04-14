import { useMemo, useState } from "react";
import SectionOverview from "../components/SectionOverview";
import { useSubteForecast } from "../hooks/useSubteForecast";
import type { SubteEntityForecast } from "../types/subte";

const formatDateTime = (unixSeconds?: number): string => {
  if (!unixSeconds || !Number.isFinite(unixSeconds)) {
    return "-";
  }
  return new Date(unixSeconds * 1000).toLocaleString("es-AR");
};

const formatTimeOnly = (unixSeconds?: number): string => {
  if (!unixSeconds || !Number.isFinite(unixSeconds)) {
    return "-";
  }

  return new Intl.DateTimeFormat("es-AR", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).format(new Date(unixSeconds * 1000));
};

const formatDelay = (seconds?: number): string => {
  if (seconds === undefined || seconds === null || !Number.isFinite(seconds)) {
    return "-";
  }

  if (seconds === 0) {
    return "A tiempo";
  }

  const absoluteSeconds = Math.abs(seconds);
  const sign = seconds > 0 ? "+" : "-";

  if (absoluteSeconds >= 60) {
    const minutes = Math.floor(absoluteSeconds / 60);
    const remainderSeconds = absoluteSeconds % 60;

    if (remainderSeconds === 0) {
      return `${sign}${minutes}m`;
    }

    return `${sign}${minutes}m ${remainderSeconds}s`;
  }

  return `${sign}${absoluteSeconds}s`;
};

const entityKey = (entity: SubteEntityForecast, index: number): string => {
  return entity.ID ?? entity.Linea?.Trip_Id ?? `entity-${index}`;
};

const getDelayTone = (seconds?: number): string => {
  if (seconds === undefined || seconds === null || !Number.isFinite(seconds)) {
    return "muted";
  }

  if (seconds > 0) {
    return "late";
  }

  if (seconds < 0) {
    return "early";
  }

  return "ontime";
};

const getEntityTitle = (entity: SubteEntityForecast, index: number): string => {
  return entity.ID ?? `Entidad #${index + 1}`;
};

const getEntitySubtitle = (entity: SubteEntityForecast): string => {
  const linea = entity.Linea;
  const parts = [
    linea?.Route_Id ? `Ruta ${linea.Route_Id}` : null,
    linea?.Trip_Id ? `Trip ${linea.Trip_Id}` : null,
  ].filter(Boolean);

  return parts.join(" • ") || "Sin datos de viaje";
};

function SubteForecastPage() {
  const [autoRefreshEnabled, setAutoRefreshEnabled] = useState(true);
  const [refreshIntervalMs, setRefreshIntervalMs] = useState(15000);
  const [selectedEntityKey, setSelectedEntityKey] = useState<string | null>(
    null,
  );

  const { data, loading, error, empty, isRefreshing, lastUpdated, refreshNow } =
    useSubteForecast({
      refreshIntervalMs,
      autoRefreshEnabled,
    });

  const totalEntities = data?.entities.length ?? 0;
  const orderedEntities = useMemo(() => data?.entities ?? [], [data]);
  const activeEntityKey = useMemo(() => {
    if (orderedEntities.length === 0) {
      return null;
    }

    const hasSelectedEntity = orderedEntities.some(
      (entity, index) => entityKey(entity, index) === selectedEntityKey,
    );

    if (selectedEntityKey && hasSelectedEntity) {
      return selectedEntityKey;
    }

    return entityKey(orderedEntities[0], 0);
  }, [orderedEntities, selectedEntityKey]);
  const selectedEntity =
    orderedEntities.find(
      (entity, index) => entityKey(entity, index) === activeEntityKey,
    ) ?? orderedEntities[0];
  const selectedEntityIndex = orderedEntities.findIndex(
    (entity, index) => entityKey(entity, index) === activeEntityKey,
  );
  const selectedLinea = selectedEntity?.Linea;
  const selectedStations = selectedLinea?.Estaciones ?? [];
  const selectedTitle =
    selectedEntity && selectedEntityIndex >= 0
      ? getEntityTitle(selectedEntity, selectedEntityIndex)
      : "-";

  return (
    <section className="subte-page">
      <SectionOverview
        kicker="Operacion"
        title="Pronostico GTFS"
        // description="La actualizacion, el timestamp y los controles de refresco comparten la misma estructura visual del resto de la app."
        actions={
          <>
            <button
              onClick={refreshNow}
              disabled={loading || isRefreshing}
              className="secondary"
            >
              Actualizar ahora
            </button>

            <label
              className="toggle-control"
              aria-label="Control de auto refresh"
            >
              <span className="toggle-control-copy">
                <span className="toggle-control-label">Auto refresh</span>
              </span>
              <input
                type="checkbox"
                className="toggle-control-input"
                checked={autoRefreshEnabled}
                onChange={(event) =>
                  setAutoRefreshEnabled(event.target.checked)
                }
              />
              <span className="toggle-control-switch" aria-hidden="true">
                <span className="toggle-control-thumb" />
              </span>
            </label>

            <select
              value={refreshIntervalMs}
              disabled={!autoRefreshEnabled}
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
          { label: "Viajes", value: totalEntities },
          {
            label: "Timestamp header",
            value: formatDateTime(data?.headerTimestamp),
          },
          {
            label: "Auto refresh",
            value: autoRefreshEnabled ? "Activo" : "Pausado",
            tone: autoRefreshEnabled ? "accent" : "default",
          },
        ]}
        isRefreshing={isRefreshing}
        lastUpdated={lastUpdated}
      />

      {error && <div className="state-banner-static error">Error: {error}</div>}
      {!error && loading && (
        <div className="state-banner-static loading">
          Cargando pronostico...
        </div>
      )}
      {!error && !loading && empty && (
        <div className="state-banner-static empty">
          Sin entidades en la respuesta.
        </div>
      )}

      {!error && !loading && !empty && (
        <section className="subte-layout">
          <aside className="subte-selector-panel">
            <div className="subte-selector-header">
              <div>
                <p className="subte-section-kicker">Selector</p>
                <h2>Subtes</h2>
              </div>
              <span className="badge">{totalEntities} entidades</span>
            </div>

            {/* <label className="field subte-selector-field">
              <span>Seleccionar entidad</span>
              <select
                value={activeEntityKey ?? ""}
                onChange={(event) => setSelectedEntityKey(event.target.value)}
              >
                {orderedEntities.map((entity, index) => {
                  const key = entityKey(entity, index);
                  return (
                    <option key={key} value={key}>
                      {getEntityTitle(entity, index)} •{" "}
                      {entity.Linea?.Trip_Id ?? "Sin Trip_Id"}
                    </option>
                  );
                })}
              </select>
            </label> */}

            <div className="subte-entity-list" aria-label="Entidades">
              {orderedEntities.map((entity, index) => {
                const key = entityKey(entity, index);
                const isActive = key === activeEntityKey;
                const estaciones = entity.Linea?.Estaciones ?? [];

                return (
                  <button
                    key={key}
                    type="button"
                    className={`subte-entity-item ${isActive ? "active" : ""}`}
                    onClick={() => setSelectedEntityKey(key)}
                    aria-pressed={isActive}
                  >
                    <span className="subte-entity-item-title">
                      {getEntityTitle(entity, index)}
                    </span>
                    <span className="subte-entity-item-subtitle">
                      {getEntitySubtitle(entity)}
                    </span>
                    <span className="subte-entity-item-meta">
                      {estaciones.length} estaciones
                    </span>
                  </button>
                );
              })}
            </div>
          </aside>

          <section className="subte-detail-panel">
            <article className="subte-card subte-summary-card">
              <div className="subte-detail-header">
                <div>
                  <p className="subte-section-kicker">Detalle</p>
                  <h2>{selectedTitle}</h2>
                  <p className="subte-detail-subtitle">
                    {selectedEntity ? getEntitySubtitle(selectedEntity) : "-"}
                  </p>
                </div>
                <span className="badge">
                  {selectedStations.length} estaciones
                </span>
              </div>

              <div className="subte-meta-grid">
                <div className="subte-meta-item">
                  <span className="subte-meta-label">ID</span>
                  <strong>{selectedEntity?.ID ?? "-"}</strong>
                </div>
                <div className="subte-meta-item">
                  <span className="subte-meta-label">Trip_Id</span>
                  <strong>{selectedLinea?.Trip_Id ?? "-"}</strong>
                </div>
                <div className="subte-meta-item">
                  <span className="subte-meta-label">Route_Id</span>
                  <strong>{selectedLinea?.Route_Id ?? "-"}</strong>
                </div>
                <div className="subte-meta-item">
                  <span className="subte-meta-label">Direction_ID</span>
                  <strong>
                    {selectedLinea?.Direction_ID !== undefined
                      ? selectedLinea.Direction_ID
                      : "-"}
                  </strong>
                </div>
                <div className="subte-meta-item">
                  <span className="subte-meta-label">start_time</span>
                  <strong>{selectedLinea?.start_time ?? "-"}</strong>
                </div>
                <div className="subte-meta-item">
                  <span className="subte-meta-label">start_date</span>
                  <strong>{selectedLinea?.start_date ?? "-"}</strong>
                </div>
              </div>
            </article>

            <article className="subte-card subte-stations-card">
              <div className="subte-stations-header">
                <div>
                  <p className="subte-section-kicker">Estaciones</p>
                  <h3>Pronostico por parada</h3>
                </div>
              </div>

              {selectedStations.length === 0 ? (
                <p className="subte-no-stations">
                  Esta entidad no tiene estaciones para mostrar.
                </p>
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
                      {selectedStations.map((station, stationIndex) => (
                        <tr
                          key={`${activeEntityKey ?? "entity"}-${station.stop_id ?? "stop"}-${stationIndex}`}
                        >
                          <td className="subte-stop-name">
                            {station.stop_name ?? "-"}
                          </td>
                          <td className="subte-code-cell">
                            {station.stop_id ?? "-"}
                          </td>
                          <td>{formatTimeOnly(station.arrival?.time)}</td>
                          <td>
                            <span
                              className={`subte-delay-badge ${getDelayTone(station.arrival?.delay)}`}
                            >
                              {formatDelay(station.arrival?.delay)}
                            </span>
                          </td>
                          <td>{formatTimeOnly(station.departure?.time)}</td>
                          <td>
                            <span
                              className={`subte-delay-badge ${getDelayTone(station.departure?.delay)}`}
                            >
                              {formatDelay(station.departure?.delay)}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </article>
          </section>
        </section>
      )}
    </section>
  );
}

export default SubteForecastPage;
