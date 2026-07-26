import {
  useEffect,
  useId,
  type ReactNode,
  type SVGProps,
} from "react";
import {
  getSubwayLineStyle,
  type SubwayLineCode,
} from "../constants/subwayLines";
import type {
  SubteDisplayStation,
  SubwayDirection,
} from "../types/subte";

export type SubtePanelState = "closed" | "summary" | "expanded";
export type SubtePanelTab = "arrivals" | "stations";

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
  activeTab: SubtePanelTab;
  onActiveTabChange: (tab: SubtePanelTab) => void;
  onSelectDirection: (key: string | null) => void;
  arrivals: SubteArrivalItem[];
  selectedArrivalKey: string | null;
  routeStations: SubteDisplayStation[];
  selectedStationKey: string | null;
  forecastLoading: boolean;
  isRefreshing: boolean;
  forecastError: boolean;
  forecastEmpty: boolean;
  lastUpdated: Date | null;
  onRefresh: () => void;
  onSelectArrival: (key: string) => void;
  onSelectRouteStation: (station: SubteDisplayStation) => void;
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

/** Maximize2-style icon */
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

/** Minimize2-style icon */
function CollapseIcon(props: SVGProps<SVGSVGElement>) {
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

function EmptyMessage({ children }: { children: ReactNode }) {
  return <p className="subte-panel-empty">{children}</p>;
}

function ArrivalCard({
  item,
  isActive,
  compact,
  hideLineBadge,
  onSelect,
}: {
  item: SubteArrivalItem;
  isActive: boolean;
  compact?: boolean;
  hideLineBadge?: boolean;
  onSelect: () => void;
}) {
  const lineStyle = getSubwayLineStyle(item.lineCode);
  const destinationHint =
    item.destinationName ??
    (item.directionLabel?.includes("→")
      ? item.directionLabel.split("→").pop()?.trim()
      : item.directionLabel);

  return (
    <button
      type="button"
      className={`subte-arrival-card ${isActive ? "active" : ""}`}
      onClick={onSelect}
      aria-pressed={isActive}
    >
      <div className="subte-arrival-card-top">
        {!hideLineBadge && lineStyle ? (
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
          {destinationHint ? <span>Hacia {destinationHint}</span> : null}
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
  directions,
  selectedDirectionKey,
  selectedDirection,
  activeTab,
  onActiveTabChange,
  onSelectDirection,
  arrivals,
  selectedArrivalKey,
  routeStations,
  selectedStationKey,
  forecastLoading,
  isRefreshing,
  forecastError,
  forecastEmpty,
  lastUpdated,
  onRefresh,
  onSelectArrival,
  onSelectRouteStation,
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
  const showDirectionSelector = Boolean(selectedLine) && directions.length > 0;
  const tabsId = useId();
  const arrivalsTabId = `${tabsId}-arrivals`;
  const stationsTabId = `${tabsId}-stations`;
  const arrivalsPanelId = `${tabsId}-arrivals-panel`;
  const stationsPanelId = `${tabsId}-stations-panel`;

  const headerIdentity = (() => {
    if (!selectedLine || !lineStyle) {
      return { title: "Red de Subtes", showBadge: false as const };
    }

    const origin =
      selectedDirection?.originName ??
      directions.find((item) => item.originName)?.originName;
    const destination =
      selectedDirection?.destinationName ??
      directions.find((item) => item.destinationName)?.destinationName;

    if (origin && destination) {
      return {
        title: `${origin} ↔ ${destination}`,
        showBadge: true as const,
      };
    }

    return {
      title: lineStyle.label.replace(/^Linea\s+/i, "Línea "),
      showBadge: true as const,
    };
  })();

  const statusMessage = (() => {
    if (forecastLoading) {
      return "Cargando próximas llegadas…";
    }
    if (forecastError) {
      return "No se pudieron obtener las próximas llegadas. El mapa sigue disponible.";
    }
    if (forecastEmpty) {
      return "No hay próximas llegadas disponibles.";
    }
    if (selectedStationName && arrivals.length === 0) {
      return "No hay próximas llegadas disponibles.";
    }
    if (selectedLine && arrivals.length === 0) {
      return "No hay próximas llegadas disponibles.";
    }
    if (arrivals.length === 0) {
      return "No hay próximas llegadas disponibles.";
    }
    return null;
  })();

  const panelClassName = [
    "subte-info-panel",
    isMobile ? "is-mobile" : "is-desktop",
    `state-${state}`,
    isOpen ? "is-open" : "is-closed",
  ].join(" ");

  useEffect(() => {
    const shouldLock = isMobile && isOpen && isExpanded;
    if (!shouldLock) {
      return;
    }

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [isMobile, isOpen, isExpanded]);

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Escape") {
        return;
      }
      if (isExpanded) {
        onMinimize();
        return;
      }
      onClose();
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [isOpen, isExpanded, onMinimize, onClose]);

  const showExpandedContent = !isMobile || isExpanded;
  const hideLineBadgeInArrivals = Boolean(selectedLine);

  return (
    <aside
      className={panelClassName}
      aria-hidden={!isOpen}
      aria-label="Panel de subtes"
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
                isExpanded ? "Reducir panel" : "Expandir panel"
              }
              title={isExpanded ? "Reducir" : "Expandir"}
            >
              <span className="subte-sheet-handle-bar" aria-hidden="true" />
            </button>
          ) : null}

          <div className="subte-info-panel-header-row">
            <div className="subte-info-panel-heading">
              <div className="subte-info-panel-identity">
                {headerIdentity.showBadge && lineStyle ? (
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
                <h2 title={headerIdentity.title}>{headerIdentity.title}</h2>
              </div>
            </div>

            <div className="subte-info-panel-actions">
              <button
                type="button"
                className={`subte-panel-icon-btn ${refreshBusy ? "is-busy" : ""}`}
                onClick={onRefresh}
                disabled={refreshBusy}
                aria-label="Actualizar información"
                title="Actualizar"
              >
                <RefreshIcon className={refreshBusy ? "is-spinning" : undefined} />
              </button>

              {isSummary ? (
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

              {isExpanded ? (
                <button
                  type="button"
                  className="subte-panel-icon-btn"
                  onClick={onMinimize}
                  aria-label="Reducir panel"
                  title="Reducir"
                >
                  <CollapseIcon />
                </button>
              ) : null}

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

        <div className="subte-info-panel-toolbar">
          {showDirectionSelector ? (
            <div
              className="subte-direction-selector"
              role="group"
              aria-label="Sentido de circulación"
            >
              <div className="subte-direction-options">
                {directions.map((direction) => {
                  const isActive = selectedDirectionKey === direction.key;
                  return (
                    <button
                      key={direction.key}
                      type="button"
                      className={`subte-direction-chip ${isActive ? "active" : ""}`}
                      aria-pressed={isActive}
                      onClick={() =>
                        onSelectDirection(isActive ? null : direction.key)
                      }
                    >
                      {direction.label}
                    </button>
                  );
                })}
              </div>
            </div>
          ) : null}

          {selectedStationName ? (
            <div className="subte-selected-station">
              <div className="subte-selected-station-copy">
                <strong>{selectedStationName}</strong>
                {selectedStationLineLabel ? (
                  <span className="subte-detail-subtitle">
                    {selectedStationLineLabel}
                  </span>
                ) : null}
              </div>
              <button
                type="button"
                className="secondary subte-clear-station-btn"
                onClick={onClearStation}
              >
                Quitar
              </button>
            </div>
          ) : null}
        </div>

        {isSummary && isMobile ? (
          <div className="subte-info-panel-body is-summary">
            <div className="subte-panel-summary">
              {statusMessage ? (
                <EmptyMessage>{statusMessage}</EmptyMessage>
              ) : nextArrival ? (
                <ArrivalCard
                  item={nextArrival}
                  isActive={nextArrival.key === selectedArrivalKey}
                  compact
                  hideLineBadge={hideLineBadgeInArrivals}
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
          </div>
        ) : null}

        {showExpandedContent ? (
          <>
            <div
              className="subte-panel-tabs"
              role="tablist"
              aria-label="Contenido del panel"
            >
              <button
                type="button"
                role="tab"
                id={arrivalsTabId}
                aria-controls={arrivalsPanelId}
                aria-selected={activeTab === "arrivals"}
                tabIndex={activeTab === "arrivals" ? 0 : -1}
                className={`subte-panel-tab ${activeTab === "arrivals" ? "active" : ""}`}
                onClick={() => onActiveTabChange("arrivals")}
              >
                Próximas llegadas
              </button>
              <button
                type="button"
                role="tab"
                id={stationsTabId}
                aria-controls={stationsPanelId}
                aria-selected={activeTab === "stations"}
                tabIndex={activeTab === "stations" ? 0 : -1}
                className={`subte-panel-tab ${activeTab === "stations" ? "active" : ""}`}
                onClick={() => onActiveTabChange("stations")}
              >
                Estaciones
              </button>
            </div>

            <div className="subte-info-panel-body is-tabbed">
              {activeTab === "arrivals" ? (
                <div
                  role="tabpanel"
                  id={arrivalsPanelId}
                  aria-labelledby={arrivalsTabId}
                  className="subte-tab-panel"
                >
                  {statusMessage ? (
                    <EmptyMessage>{statusMessage}</EmptyMessage>
                  ) : (
                    <div className="subte-arrival-list">
                      {arrivals.map((item) => (
                        <ArrivalCard
                          key={item.key}
                          item={item}
                          isActive={item.key === selectedArrivalKey}
                          hideLineBadge={hideLineBadgeInArrivals}
                          onSelect={() => onSelectArrival(item.key)}
                        />
                      ))}
                    </div>
                  )}
                </div>
              ) : (
                <div
                  role="tabpanel"
                  id={stationsPanelId}
                  aria-labelledby={stationsTabId}
                  className="subte-tab-panel"
                >
                  {routeStations.length === 0 ? (
                    <EmptyMessage>
                      No hay estaciones disponibles para este recorrido.
                    </EmptyMessage>
                  ) : (
                    <ol className="subte-station-timeline">
                      {routeStations.map((station, index) => {
                        const isActive =
                          selectedStationKey === station.key ||
                          (selectedStationName !== null &&
                            station.displayName === selectedStationName);
                        return (
                          <li key={station.key}>
                            <button
                              type="button"
                              className={`subte-station-timeline-item ${isActive ? "active" : ""}`}
                              onClick={() => onSelectRouteStation(station)}
                              aria-pressed={isActive}
                            >
                              <span
                                className="subte-station-timeline-index"
                                aria-hidden="true"
                              >
                                {index + 1}
                              </span>
                              <span className="subte-station-timeline-copy">
                                <strong>{station.displayName}</strong>
                                {station.arrivalTime || station.departureTime ? (
                                  <span className="subte-station-timeline-meta">
                                    {formatTimeOnly(
                                      station.arrivalTime ??
                                        station.departureTime,
                                    )}
                                    {station.arrivalDelay !== undefined ||
                                    station.departureDelay !== undefined ? (
                                      <span
                                        className={`subte-delay-badge ${getDelayTone(station.arrivalDelay ?? station.departureDelay)}`}
                                      >
                                        {formatDelay(
                                          station.arrivalDelay ??
                                            station.departureDelay,
                                        )}
                                      </span>
                                    ) : null}
                                  </span>
                                ) : null}
                              </span>
                            </button>
                          </li>
                        );
                      })}
                    </ol>
                  )}
                </div>
              )}
            </div>
          </>
        ) : null}

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
