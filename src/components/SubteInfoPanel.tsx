import type { ReactNode } from "react";
import {
  getSubwayLineStyle,
  type SubwayLineCode,
} from "../constants/subwayLines";
import type { SubteStationForecast } from "../types/subte";

export type SubtePanelState = "closed" | "summary" | "expanded";

export interface SubteArrivalItem {
  key: string;
  entityKey: string;
  lineCode: SubwayLineCode | null;
  stationName: string;
  stopId?: string;
  directionId?: number;
  arrivalTime?: number;
  departureTime?: number;
  arrivalDelay?: number;
  departureDelay?: number;
}

interface SubteInfoPanelProps {
  state: SubtePanelState;
  isMobile: boolean;
  selectedLine: SubwayLineCode | null;
  selectedStationName: string | null;
  selectedStationLineLabel: string | null;
  arrivals: SubteArrivalItem[];
  selectedArrivalKey: string | null;
  detailStations: SubteStationForecast[];
  forecastLoading: boolean;
  forecastError: boolean;
  forecastEmpty: boolean;
  lastUpdated: Date | null;
  onSelectArrival: (key: string) => void;
  onClose: () => void;
  onMinimize: () => void;
  onExpand: () => void;
  onClearStation: () => void;
}

const formatTimeOnly = (unixSeconds?: number): string => {
  if (!unixSeconds || !Number.isFinite(unixSeconds)) {
    return "-";
  }

  return new Intl.DateTimeFormat("es-AR", {
    hour: "2-digit",
    minute: "2-digit",
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
      return `${sign}${minutes} m`;
    }
    return `${sign}${minutes} m ${remainderSeconds} s`;
  }

  return `${sign}${absoluteSeconds} s`;
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

const formatLastUpdate = (value: Date | null): string => {
  if (!value) {
    return "";
  }
  return new Intl.DateTimeFormat("es-AR", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).format(value);
};

const formatDirection = (directionId?: number): string | null => {
  if (directionId === undefined || directionId === null) {
    return null;
  }
  return `Sentido ${directionId}`;
};

const lineTitle = (selectedLine: SubwayLineCode | null): string => {
  const style = getSubwayLineStyle(selectedLine);
  return style ? style.label : "Todas las líneas";
};

function EmptyMessage({ children }: { children: ReactNode }) {
  return <p className="subte-panel-empty">{children}</p>;
}

function ArrivalCard({
  item,
  isActive,
  compact,
  onSelect,
}: {
  item: SubteArrivalItem;
  isActive: boolean;
  compact?: boolean;
  onSelect: () => void;
}) {
  const lineStyle = getSubwayLineStyle(item.lineCode);
  const direction = formatDirection(item.directionId);

  return (
    <button
      type="button"
      className={`subte-arrival-card ${isActive ? "active" : ""}`}
      onClick={onSelect}
      aria-pressed={isActive}
    >
      <div className="subte-arrival-card-top">
        {lineStyle ? (
          <span
            className="subte-line-badge subte-line-badge-sm"
            style={{
              backgroundColor: lineStyle.color,
              color: lineStyle.textColor,
            }}
          >
            {lineStyle.code}
          </span>
        ) : null}
        <strong className="subte-arrival-station">{item.stationName}</strong>
        <span className="subte-arrival-time">
          {formatTimeOnly(item.arrivalTime ?? item.departureTime)}
        </span>
      </div>
      {!compact ? (
        <div className="subte-arrival-card-meta">
          {direction ? <span>{direction}</span> : null}
          <span
            className={`subte-delay-badge ${getDelayTone(item.arrivalDelay ?? item.departureDelay)}`}
          >
            {formatDelay(item.arrivalDelay ?? item.departureDelay)}
          </span>
        </div>
      ) : null}
    </button>
  );
}

function SubteInfoPanel({
  state,
  isMobile,
  selectedLine,
  selectedStationName,
  selectedStationLineLabel,
  arrivals,
  selectedArrivalKey,
  detailStations,
  forecastLoading,
  forecastError,
  forecastEmpty,
  lastUpdated,
  onSelectArrival,
  onClose,
  onMinimize,
  onExpand,
  onClearStation,
}: SubteInfoPanelProps) {
  const lineStyle = getSubwayLineStyle(selectedLine);
  const nextArrival = arrivals[0] ?? null;
  const isOpen = state !== "closed";
  const isSummary = state === "summary";
  const isExpanded = state === "expanded";
  const lastUpdateLabel = formatLastUpdate(lastUpdated);

  const statusMessage = (() => {
    if (forecastLoading) {
      return "Cargando próximas llegadas…";
    }
    if (forecastError) {
      return "No se pudieron obtener las próximas llegadas. El mapa sigue disponible.";
    }
    if (forecastEmpty) {
      return "No hay información de próximas llegadas en este momento.";
    }
    if (selectedStationName && arrivals.length === 0) {
      return "No hay próximas llegadas disponibles para esta estación.";
    }
    if (selectedLine && arrivals.length === 0) {
      return "No hay información de próximas llegadas para esta línea.";
    }
    if (arrivals.length === 0) {
      return "No hay próximas llegadas para mostrar.";
    }
    return null;
  })();

  const panelClassName = [
    "subte-info-panel",
    isMobile ? "is-mobile" : "is-desktop",
    `state-${state}`,
    isOpen ? "is-open" : "is-closed",
  ].join(" ");

  return (
    <aside
      className={panelClassName}
      aria-hidden={!isOpen}
      aria-label="Información de subtes"
      {...(!isOpen ? { inert: true } : {})}
    >
      <div className="subte-info-panel-inner">
        <header className="subte-info-panel-header">
          {isMobile ? (
            <button
              type="button"
              className="subte-sheet-handle"
              onClick={() => {
                if (isExpanded) {
                  onMinimize();
                } else {
                  onExpand();
                }
              }}
              aria-label={
                isExpanded
                  ? "Mostrar vista resumida"
                  : "Expandir información de subtes"
              }
            >
              <span className="subte-sheet-handle-bar" aria-hidden="true" />
            </button>
          ) : null}

          <div className="subte-info-panel-header-row">
            <div className="subte-info-panel-heading">
              <p className="subte-section-kicker">Próximas llegadas</p>
              <h2>{lineTitle(selectedLine)}</h2>
            </div>

            <div className="subte-info-panel-actions">
              {lineStyle ? (
                <span
                  className="subte-line-badge"
                  style={{
                    backgroundColor: lineStyle.color,
                    color: lineStyle.textColor,
                  }}
                >
                  {lineStyle.code}
                </span>
              ) : null}

              {isMobile && isSummary ? (
                <button
                  type="button"
                  className="subte-panel-icon-btn"
                  onClick={onExpand}
                  aria-label="Expandir panel"
                >
                  Expandir
                </button>
              ) : null}

              {isMobile && isExpanded ? (
                <button
                  type="button"
                  className="subte-panel-icon-btn"
                  onClick={onMinimize}
                  aria-label="Minimizar panel"
                >
                  Resumir
                </button>
              ) : null}

              <button
                type="button"
                className="subte-panel-icon-btn"
                onClick={onClose}
                aria-label="Cerrar panel de información"
              >
                Cerrar
              </button>
            </div>
          </div>
        </header>

        <div className="subte-info-panel-body">
          {selectedStationName ? (
            <div className="subte-selected-station">
              <p className="subte-section-kicker">Estación</p>
              <strong>{selectedStationName}</strong>
              {selectedStationLineLabel ? (
                <p className="subte-detail-subtitle">
                  {selectedStationLineLabel}
                </p>
              ) : null}
              <button
                type="button"
                className="secondary subte-clear-station-btn"
                onClick={onClearStation}
              >
                Quitar estación
              </button>
            </div>
          ) : null}

          {isSummary && isMobile ? (
            <div className="subte-panel-summary">
              {statusMessage ? (
                <EmptyMessage>{statusMessage}</EmptyMessage>
              ) : nextArrival ? (
                <ArrivalCard
                  item={nextArrival}
                  isActive={nextArrival.key === selectedArrivalKey}
                  compact
                  onSelect={() => {
                    onSelectArrival(nextArrival.key);
                    onExpand();
                  }}
                />
              ) : null}
              {!statusMessage && arrivals.length > 1 ? (
                <p className="subte-summary-hint">
                  +{arrivals.length - 1} llegadas más · expandí para ver el
                  detalle
                </p>
              ) : null}
            </div>
          ) : null}

          {(!isMobile || isExpanded) && (
            <>
              {statusMessage ? (
                <EmptyMessage>{statusMessage}</EmptyMessage>
              ) : (
                <section className="subte-panel-section" aria-label="Llegadas">
                  <div className="subte-panel-section-header">
                    <h3>Próximas llegadas</h3>
                    <span className="badge">{arrivals.length}</span>
                  </div>
                  <div className="subte-arrival-list">
                    {arrivals.map((item) => (
                      <ArrivalCard
                        key={item.key}
                        item={item}
                        isActive={item.key === selectedArrivalKey}
                        onSelect={() => onSelectArrival(item.key)}
                      />
                    ))}
                  </div>
                </section>
              )}

              {!statusMessage && detailStations.length > 0 ? (
                <section
                  className="subte-panel-section"
                  aria-label="Detalle del recorrido"
                >
                  <div className="subte-panel-section-header">
                    <h3>Detalle del recorrido</h3>
                  </div>

                  <div className="subte-arrival-list subte-detail-cards is-mobile-only">
                    {detailStations.map((station, index) => (
                      <div
                        key={`${station.stop_id ?? "stop"}-${index}`}
                        className="subte-detail-card"
                      >
                        <strong>{station.stop_name ?? "Estación"}</strong>
                        <div className="subte-detail-card-row">
                          <span>
                            Llegada {formatTimeOnly(station.arrival?.time)}
                          </span>
                          <span
                            className={`subte-delay-badge ${getDelayTone(station.arrival?.delay)}`}
                          >
                            {formatDelay(station.arrival?.delay)}
                          </span>
                        </div>
                        <div className="subte-detail-card-row">
                          <span>
                            Salida {formatTimeOnly(station.departure?.time)}
                          </span>
                          <span
                            className={`subte-delay-badge ${getDelayTone(station.departure?.delay)}`}
                          >
                            {formatDelay(station.departure?.delay)}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>

                  <div className="subte-table-wrap is-desktop-only">
                    <table className="subte-table subte-table-compact">
                      <thead>
                        <tr>
                          <th>Estación</th>
                          <th>Llegada</th>
                          <th>Demora</th>
                          <th>Salida</th>
                        </tr>
                      </thead>
                      <tbody>
                        {detailStations.map((station, index) => (
                          <tr
                            key={`${station.stop_id ?? "stop"}-${index}`}
                          >
                            <td className="subte-stop-name">
                              {station.stop_name ?? "-"}
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
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </section>
              ) : null}
            </>
          )}
        </div>

        {lastUpdateLabel ? (
          <footer className="subte-info-panel-footer">
            Actualizado {lastUpdateLabel}
          </footer>
        ) : null}
      </div>
    </aside>
  );
}

export default SubteInfoPanel;
