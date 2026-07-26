import { useEffect, useMemo, useState } from "react";
import SubteInfoPanel, {
  type SubteArrivalItem,
  type SubtePanelState,
} from "../components/SubteInfoPanel";
import SubteMapView from "../components/SubteMapView";
import {
  SUBWAY_LINES,
  getSubwayLineStyle,
  parseSubwayLineCode,
  type SubwayLineCode,
} from "../constants/subwayLines";
import { useSubteForecast } from "../hooks/useSubteForecast";
import { useSubteStaticData } from "../hooks/useSubteStaticData";
import type { SubteEntityForecast } from "../types/subte";

const MOBILE_BREAKPOINT_PX = 900;

const entityKey = (entity: SubteEntityForecast, index: number): string => {
  return entity.ID ?? entity.Linea?.Trip_Id ?? `entity-${index}`;
};

const entityMatchesLine = (
  entity: SubteEntityForecast,
  line: SubwayLineCode | null,
): boolean => {
  if (!line) {
    return true;
  }
  return parseSubwayLineCode(entity.Linea?.Route_Id) === line;
};

const normalizeName = (value: string | null | undefined): string => {
  return (value ?? "").trim().toLowerCase();
};

const useIsMobile = (breakpointPx: number): boolean => {
  const [isMobile, setIsMobile] = useState(() => {
    if (typeof window === "undefined") {
      return false;
    }
    return window.matchMedia(`(max-width: ${breakpointPx}px)`).matches;
  });

  useEffect(() => {
    const media = window.matchMedia(`(max-width: ${breakpointPx}px)`);
    const onChange = () => setIsMobile(media.matches);
    onChange();
    media.addEventListener("change", onChange);
    return () => media.removeEventListener("change", onChange);
  }, [breakpointPx]);

  return isMobile;
};

function SubteForecastPage() {
  const isMobile = useIsMobile(MOBILE_BREAKPOINT_PX);
  const [autoRefreshEnabled, setAutoRefreshEnabled] = useState(true);
  const [refreshIntervalMs, setRefreshIntervalMs] = useState(15000);
  const [panelState, setPanelState] = useState<SubtePanelState>("closed");
  const [selectedEntityKey, setSelectedEntityKey] = useState<string | null>(
    null,
  );
  const [selectedArrivalKey, setSelectedArrivalKey] = useState<string | null>(
    null,
  );
  const [selectedLine, setSelectedLine] = useState<SubwayLineCode | null>(null);
  const [selectedStationId, setSelectedStationId] = useState<string | null>(
    null,
  );

  const { data, loading, error, empty, isRefreshing, lastUpdated, refreshNow } =
    useSubteForecast({
      refreshIntervalMs,
      autoRefreshEnabled,
    });

  const {
    network,
    stations,
    loading: staticLoading,
    networkError,
    stationsError,
  } = useSubteStaticData();

  const allEntities = useMemo(() => data?.entities ?? [], [data]);

  const orderedEntities = useMemo(
    () =>
      allEntities.filter((entity) => entityMatchesLine(entity, selectedLine)),
    [allEntities, selectedLine],
  );

  const selectedStationFeature = useMemo(() => {
    if (!selectedStationId || !stations) {
      return null;
    }
    return (
      stations.features.find((feature) => {
        const id = feature.properties?.id;
        const nam = feature.properties?.nam;
        return (
          String(id ?? "") === selectedStationId ||
          (typeof nam === "string" && nam === selectedStationId)
        );
      }) ?? null
    );
  }, [selectedStationId, stations]);

  const selectedStationName = useMemo(() => {
    const nam = selectedStationFeature?.properties?.nam;
    if (typeof nam === "string" && nam.trim()) {
      return nam.trim();
    }
    return selectedStationId;
  }, [selectedStationFeature, selectedStationId]);

  const selectedStationLineLabel = useMemo(() => {
    const ral = selectedStationFeature?.properties?.ral;
    const lineCode = parseSubwayLineCode(
      typeof selectedStationFeature?.properties?.lineCode === "string"
        ? selectedStationFeature.properties.lineCode
        : typeof ral === "string"
          ? ral
          : null,
    );
    const style = getSubwayLineStyle(lineCode);
    if (style) {
      return style.label;
    }
    return typeof ral === "string" ? ral : null;
  }, [selectedStationFeature]);

  const arrivals = useMemo(() => {
    const referenceTime = data?.headerTimestamp;
    const items: SubteArrivalItem[] = [];
    const stationFilter = normalizeName(selectedStationName);

    orderedEntities.forEach((entity, entityIndex) => {
      const linea = entity.Linea;
      const lineCode = parseSubwayLineCode(linea?.Route_Id);
      const tripEntityKey = entityKey(entity, entityIndex);
      const stationsForTrip = linea?.Estaciones ?? [];

      stationsForTrip.forEach((station, stationIndex) => {
        const name = station.stop_name?.trim();
        if (!name) {
          return;
        }

        if (stationFilter && normalizeName(name) !== stationFilter) {
          return;
        }

        const arrivalTime = station.arrival?.time;
        const departureTime = station.departure?.time;
        const relevantTime = arrivalTime ?? departureTime;
        if (
          referenceTime !== undefined &&
          Number.isFinite(referenceTime) &&
          relevantTime !== undefined &&
          Number.isFinite(relevantTime) &&
          relevantTime + 120 < referenceTime
        ) {
          return;
        }

        items.push({
          key: `${tripEntityKey}-${station.stop_id ?? stationIndex}`,
          entityKey: tripEntityKey,
          lineCode,
          stationName: name,
          stopId: station.stop_id,
          directionId: linea?.Direction_ID,
          arrivalTime,
          departureTime,
          arrivalDelay: station.arrival?.delay,
          departureDelay: station.departure?.delay,
        });
      });
    });

    items.sort((a, b) => {
      const timeA = a.arrivalTime ?? a.departureTime ?? Number.POSITIVE_INFINITY;
      const timeB = b.arrivalTime ?? b.departureTime ?? Number.POSITIVE_INFINITY;
      return timeA - timeB;
    });

    return items.slice(0, 40);
  }, [orderedEntities, selectedStationName, data?.headerTimestamp]);

  const resolvedArrivalKey = useMemo(() => {
    if (
      selectedArrivalKey &&
      arrivals.some((item) => item.key === selectedArrivalKey)
    ) {
      return selectedArrivalKey;
    }
    return arrivals[0]?.key ?? null;
  }, [arrivals, selectedArrivalKey]);

  const selectedEntity = useMemo(() => {
    const arrival = arrivals.find((item) => item.key === resolvedArrivalKey);
    if (arrival) {
      return (
        orderedEntities.find(
          (entity, index) => entityKey(entity, index) === arrival.entityKey,
        ) ?? null
      );
    }

    if (selectedEntityKey) {
      return (
        orderedEntities.find(
          (entity, index) => entityKey(entity, index) === selectedEntityKey,
        ) ?? null
      );
    }

    return orderedEntities[0] ?? null;
  }, [arrivals, resolvedArrivalKey, orderedEntities, selectedEntityKey]);

  const detailStations = selectedEntity?.Linea?.Estaciones ?? [];
  const selectedLineStyle = getSubwayLineStyle(selectedLine);
  const staticReady = Boolean(network || stations);

  const openPanel = (
    preferred: SubtePanelState = isMobile ? "summary" : "expanded",
  ) => {
    setPanelState(isMobile ? preferred : preferred === "closed" ? "closed" : "expanded");
  };

  const handleChipSelect = (line: SubwayLineCode) => {
    setSelectedLine((current) => {
      const next = current === line ? null : line;
      setSelectedStationId(null);
      setSelectedEntityKey(null);
      setSelectedArrivalKey(null);
      return next;
    });
    openPanel(isMobile ? "summary" : "expanded");
  };

  const handleSelectAllLines = () => {
    setSelectedLine(null);
    setSelectedStationId(null);
    setSelectedEntityKey(null);
    setSelectedArrivalKey(null);
  };

  const effectivePanelState: SubtePanelState =
    !isMobile && panelState === "summary" ? "expanded" : panelState;

  return (
    <section className="subte-page">
      <div className="subte-toolbar">
        <div className="subte-toolbar-copy">
          <p className="subte-section-kicker">Subtes</p>
          <h2>Red de subterráneos</h2>
        </div>
        <div className="subte-toolbar-actions">
          <button
            type="button"
            onClick={refreshNow}
            disabled={loading || isRefreshing}
            className="secondary"
          >
            Actualizar
          </button>

          <label
            className="toggle-control"
            aria-label="Actualización automática"
          >
            <span className="toggle-control-copy">
              <span className="toggle-control-label">Auto</span>
            </span>
            <input
              type="checkbox"
              className="toggle-control-input"
              checked={autoRefreshEnabled}
              onChange={(event) => setAutoRefreshEnabled(event.target.checked)}
            />
            <span className="toggle-control-switch" aria-hidden="true">
              <span className="toggle-control-thumb" />
            </span>
          </label>

          <select
            value={refreshIntervalMs}
            disabled={!autoRefreshEnabled}
            aria-label="Intervalo de actualización"
            onChange={(event) =>
              setRefreshIntervalMs(Number(event.target.value))
            }
          >
            <option value={10000}>10s</option>
            <option value={15000}>15s</option>
            <option value={30000}>30s</option>
          </select>
        </div>
      </div>

      <div
        className="subte-line-filters"
        role="toolbar"
        aria-label="Filtro de líneas"
      >
        <button
          type="button"
          className={`subte-line-chip ${selectedLine === null ? "active" : ""}`}
          onClick={handleSelectAllLines}
        >
          Todas
        </button>
        {SUBWAY_LINES.map((line) => {
          const isActive = selectedLine === line.code;
          return (
            <button
              key={line.code}
              type="button"
              className={`subte-line-chip ${isActive ? "active" : ""}`}
              style={{
                ["--subte-line-color" as string]: line.color,
                ["--subte-line-text" as string]: line.textColor,
              }}
              onClick={() => handleChipSelect(line.code)}
              aria-pressed={isActive}
            >
              <span className="subte-line-chip-swatch" aria-hidden="true" />
              {line.code}
            </button>
          );
        })}
      </div>

      {(staticLoading || networkError || stationsError) && (
        <div className="subte-inline-status" role="status">
          {staticLoading ? <span>Cargando mapa…</span> : null}
          {networkError || stationsError ? (
            <span className="is-error">
              No se pudo cargar parte del mapa. Podés seguir consultando lo
              disponible.
            </span>
          ) : null}
        </div>
      )}

      <div className="subte-map-stage">
        {(staticReady || staticLoading) && (
          <SubteMapView
            network={network}
            stations={stations}
            selectedLine={selectedLine}
            selectedStationId={selectedStationId}
            onSelectLine={(line) => {
              setSelectedLine(line);
              setSelectedStationId(null);
              setSelectedEntityKey(null);
              setSelectedArrivalKey(null);
              if (line) {
                openPanel(isMobile ? "summary" : "expanded");
              }
            }}
            onSelectStation={(stationId, line) => {
              setSelectedStationId(stationId);
              setSelectedArrivalKey(null);
              if (line) {
                setSelectedLine(line);
              }
              openPanel(isMobile ? "summary" : "expanded");
            }}
          />
        )}

        {effectivePanelState === "closed" ? (
          <button
            type="button"
            className="subte-open-panel-btn"
            onClick={() => openPanel(isMobile ? "summary" : "expanded")}
            aria-label="Abrir próximas llegadas"
          >
            <span className="subte-open-panel-btn-icon" aria-hidden="true">
              ◷
            </span>
            Próximas llegadas
            {selectedLineStyle ? (
              <span
                className="subte-open-panel-btn-line"
                style={{ backgroundColor: selectedLineStyle.color }}
                aria-hidden="true"
              />
            ) : null}
          </button>
        ) : null}

        <SubteInfoPanel
          state={effectivePanelState}
          isMobile={isMobile}
          selectedLine={selectedLine}
          selectedStationName={selectedStationName}
          selectedStationLineLabel={selectedStationLineLabel}
          arrivals={arrivals}
          selectedArrivalKey={resolvedArrivalKey}
          detailStations={detailStations}
          forecastLoading={loading}
          forecastError={Boolean(error)}
          forecastEmpty={empty}
          lastUpdated={lastUpdated}
          onSelectArrival={(key) => {
            setSelectedArrivalKey(key);
            const arrival = arrivals.find((item) => item.key === key);
            if (arrival) {
              setSelectedEntityKey(arrival.entityKey);
            }
            if (isMobile && effectivePanelState === "summary") {
              setPanelState("expanded");
            }
          }}
          onClose={() => setPanelState("closed")}
          onMinimize={() => setPanelState(isMobile ? "summary" : "closed")}
          onExpand={() => setPanelState("expanded")}
          onClearStation={() => setSelectedStationId(null)}
        />
      </div>
    </section>
  );
}

export default SubteForecastPage;
