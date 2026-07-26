import type { ReactNode, SVGProps } from "react";
import {
  getSubwayLineStyle,
  type SubwayLineCode,
} from "../constants/subwayLines";
import type { SubteDisplayStation, SubwayDirection } from "../types/subte";

export type SubtePanelState = "closed" | "summary" | "expanded";

export interface SubteArrivalItem {
  key: string;
  entityKey: string;
  lineCode: SubwayLineCode | null;
  stationName: string;
  stopId?: string;
  directionId?: number;
  directionKey?: string;
  directionLabel?: string;
  originName?: string;
  destinationName?: string;
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
  directions: SubwayDirection[];
  selectedDirectionKey: string | null;
  selectedDirection: SubwayDirection | null;
  onSelectDirection: (key: string | null) => void;
  arrivals: SubteArrivalItem[];
  selectedArrivalKey: string | null;
  detailStations: SubteDisplayStation[];
  forecastLoading: boolean;
  isRefreshing: boolean;
  forecastError: boolean;
  forecastEmpty: boolean;
  lastUpdated: Date | null;
  onRefresh: () => void;
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

const lineTitle = (selectedLine: SubwayLineCode | null): string => {
  const style = getSubwayLineStyle(selectedLine);
  return style ? style.label : "Todas las líneas";
};

function RefreshIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg
      viewBox="0 0 24 24"
      width="18"
      height="18"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      {...props}
    >
      <path d="M21 12a9 9 0 1 1-2.1-5.7" />
      <polyline points="21 3 21 9 15 9" />
    </svg>
  );
}

function ExpandIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg
      viewBox="0 0 24 24"
      width="18"
      height="18"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      {...props}
    >
      <polyline points="15 3 21 3 21 9" />
      <polyline points="9 21 3 21 3 15" />
      <line x1="21" y1="3" x2="14" y2="10" />
      <line x1="3" y1="21" x2="10" y2="14" />
    </svg>
  );
}

function MinimizeIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg
      viewBox="0 0 24 24"
      width="18"
      height="18"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      {...props}
    >
      <polyline points="4 14 10 14 10 20" />
      <polyline points="20 10 14 10 14 4" />
      <line x1="14" y1="10" x2="21" y2="3" />
      <line x1="3" y1="21" x2="10" y2="14" />
    </svg>
  );
}

function CloseIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg
      viewBox="0 0 24 24"
      width="18"
      height="18"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      {...props}
    >
      <line x1="18" y1="6" x2="6" y2="18" />
      <line x1="6" y1="6" x2="18" y2="18" />
    </svg>
  );
}

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
          {item.directionLabel ? <span>{item.directionLabel}</span> : null}
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

function DirectionSelector({
  directions,
  selectedDirectionKey,
  onSelectDirection,
  isMobile,
}: {
  directions: SubwayDirection[];
  selectedDirectionKey: string | null;
  onSelectDirection: (key: string | null) => void;
  isMobile: boolean;
}) {
  if (directions.length < 2) {
    return null;
  }

  const useSelect = isMobile && directions.some((d) => d.label.length > 28);

  if (useSelect) {
    return (
      <div className="subte-direction-selector">
        <label className="subte-section-kicker" htmlFor="subte-direction-select">
          Sentido
        </label>
        <select
          id="subte-direction-select"
          className="subte-direction-select"
          value={selectedDirectionKey ?? ""}
          aria-label="Sentido de circulación"
          onChange={(event) => {
            const value = event.target.value;
            onSelectDirection(value.length > 0 ? value : null);
          }}
        >
          <option value="">Ambos</option>
          {directions.map((direction) => (
            <option key={direction.key} value={direction.key}>
              {direction.label}
            </option>
          ))}
        </select>
      </div>
    );
  }

  return (
    <div
      className="subte-direction-selector"
      role="group"
      aria-label="Sentido de circulación"
    >
      <p className="subte-section-kicker">Sentido</p>
      <div className="subte-direction-options">
        <button
          type="button"
          className={`subte-direction-chip ${selectedDirectionKey === null ? "active" : ""}`}
          aria-pressed={selectedDirectionKey === null}
          onClick={() => onSelectDirection(null)}
        >
          Ambos
        </button>
        {directions.map((direction) => {
          const isActive = selectedDirectionKey === direction.key;
          return (
            <button
              key={direction.key}
              type="button"
              className={`subte-direction-chip ${isActive ? "active" : ""}`}
              aria-pressed={isActive}
              onClick={() => onSelectDirection(direction.key)}
            >
              {direction.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}

function SubteInfoPanel({
  state,
  isMobile,
  selectedLine,
  selectedStationName,
  selectedStationLineLabel,
  directions,
  selectedDirectionKey,
  selectedDirection,
  onSelectDirection,
  arrivals,
  selectedArrivalKey,
  detailStations,
  forecastLoading,
  isRefreshing,
  forecastError,
  forecastEmpty,
  lastUpdated,
  onRefresh,
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
  const refreshBusy = forecastLoading || isRefreshing;
  const showDirectionSelector = Boolean(selectedLine) && directions.length >= 2;

  const directionSummaryLabel = selectedDirection
    ? selectedDirection.label
    : selectedLine && directions.length >= 2
      ? "Ambos sentidos"
      : directions[0]?.label ?? null;

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
              <p className="subte-section-kicker">Información de la línea</p>
              <div className="subte-info-panel-title-row">
                {lineStyle ? (
                  <span
                    className="subte-line-badge"
                    style={{
                      backgroundColor: lineStyle.color,
                      color: lineStyle.textColor,
                    }}
                    aria-hidden="true"
                  >
                    {lineStyle.code}
                  </span>
                ) : null}
                <h2>{lineTitle(selectedLine)}</h2>
              </div>
            </div>

            <div className="subte-info-panel-actions">
              {isMobile && isSummary ? (
                <button
                  type="button"
                  className="subte-panel-icon-btn"
                  onClick={onExpand}
                  aria-label="Expandir panel"
                  title="Expandir"
                >
                  <ExpandIcon />
                </button>
              ) : null}

              {isMobile && isExpanded ? (
                <button
                  type="button"
                  className="subte-panel-icon-btn"
                  onClick={onMinimize}
                  aria-label="Resumir panel"
                  title="Resumir"
                >
                  <MinimizeIcon />
                </button>
              ) : null}

              <button
                type="button"
                className={`subte-panel-icon-btn ${refreshBusy ? "is-busy" : ""}`}
                onClick={onRefresh}
                disabled={refreshBusy}
                aria-label="Actualizar información"
                title="Actualizar información"
              >
                <RefreshIcon className={refreshBusy ? "is-spinning" : undefined} />
              </button>

              <button
                type="button"
                className="subte-panel-icon-btn"
                onClick={onClose}
                aria-label="Cerrar panel"
                title="Cerrar"
              >
                <CloseIcon />
              </button>
            </div>
          </div>
        </header>

        <div className="subte-info-panel-body">
          {showDirectionSelector ? (
            <DirectionSelector
              directions={directions}
              selectedDirectionKey={selectedDirectionKey}
              onSelectDirection={onSelectDirection}
              isMobile={isMobile}
            />
          ) : null}

          {selectedLine ? (
            <div className="subte-line-summary" aria-label="Resumen de la línea">
              {directionSummaryLabel ? (
                <p>
                  <span className="subte-summary-label">Sentido</span>
                  <strong>{directionSummaryLabel}</strong>
                </p>
              ) : null}
              {selectedDirection?.originName ? (
                <p>
                  <span className="subte-summary-label">Origen</span>
                  <strong>{selectedDirection.originName}</strong>
                </p>
              ) : null}
              {selectedDirection?.destinationName ? (
                <p>
                  <span className="subte-summary-label">Destino</span>
                  <strong>{selectedDirection.destinationName}</strong>
                </p>
              ) : null}
            </div>
          ) : null}

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
                    <h3>Próximas estaciones</h3>
                  </div>

                  <div className="subte-arrival-list subte-detail-cards is-mobile-only">
                    {detailStations.map((station) => (
                      <div key={station.key} className="subte-detail-card">
                        <strong>{station.displayName}</strong>
                        <div className="subte-detail-card-row">
                          <span>
                            Llegada {formatTimeOnly(station.arrivalTime)}
                          </span>
                          <span
                            className={`subte-delay-badge ${getDelayTone(station.arrivalDelay)}`}
                          >
                            {formatDelay(station.arrivalDelay)}
                          </span>
                        </div>
                        <div className="subte-detail-card-row">
                          <span>
                            Salida {formatTimeOnly(station.departureTime)}
                          </span>
                          <span
                            className={`subte-delay-badge ${getDelayTone(station.departureDelay)}`}
                          >
                            {formatDelay(station.departureDelay)}
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
                        {detailStations.map((station) => (
                          <tr key={station.key}>
                            <td className="subte-stop-name">
                              {station.displayName}
                            </td>
                            <td>{formatTimeOnly(station.arrivalTime)}</td>
                            <td>
                              <span
                                className={`subte-delay-badge ${getDelayTone(station.arrivalDelay)}`}
                              >
                                {formatDelay(station.arrivalDelay)}
                              </span>
                            </td>
                            <td>{formatTimeOnly(station.departureTime)}</td>
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
