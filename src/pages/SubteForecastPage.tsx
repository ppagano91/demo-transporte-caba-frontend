import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import SubteInfoPanel, {
  type SubteArrivalItem,
  type SubtePanelState,
  type SubtePanelTab,
} from "../components/SubteInfoPanel";
import SubteMapView, {
  type StationArrivalSummary,
} from "../components/SubteMapView";
import {
  SUBWAY_LINES,
  getSubwayLineStyle,
  parseSubwayLineCode,
  type SubwayLineCode,
} from "../constants/subwayLines";
import { useSubteForecast } from "../hooks/useSubteForecast";
import { useSubteStaticData } from "../hooks/useSubteStaticData";
import type { SubteDisplayStation, SubteEntityForecast } from "../types/subte";
import {
  buildStationDirectory,
  forecastStationMatchesSelection,
  normalizeStationName,
  resolveForecastStation,
} from "../utils/resolveStation";
import {
  entityMatchesDirection,
  listSubwayDirections,
  resolveSubwayDirection,
} from "../utils/subwayDirection";

/** Overlay (tablet/móvil) cuando width <= 1024; split (laptop) cuando width > 1024. */
const DESKTOP_SPLIT_MIN_WIDTH_PX = 1025;
/** Bottom sheet / fullscreen móvil dentro del modo overlay. */
const MOBILE_SHEET_MAX_WIDTH_PX = 900;
const FORECAST_REFRESH_INTERVAL_MS = 15000;

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

const formatArrivalLabel = (unixSeconds?: number, referenceTime?: number): string | undefined => {
  if (!unixSeconds || !Number.isFinite(unixSeconds)) {
    return undefined;
  }
  if (
    referenceTime !== undefined &&
    Number.isFinite(referenceTime) &&
    unixSeconds >= referenceTime
  ) {
    const minutes = Math.max(0, Math.round((unixSeconds - referenceTime) / 60));
    if (minutes <= 0) {
      return "Ahora";
    }
    return `${minutes} min`;
  }
  return new Intl.DateTimeFormat("es-AR", {
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(unixSeconds * 1000));
};

const formatDelayLabel = (seconds?: number): string | undefined => {
  if (seconds === undefined || seconds === null || !Number.isFinite(seconds)) {
    return undefined;
  }
  if (seconds === 0) {
    return "A tiempo";
  }
  const absoluteSeconds = Math.abs(seconds);
  const sign = seconds > 0 ? "+" : "-";
  if (absoluteSeconds >= 60) {
    return `${sign}${Math.floor(absoluteSeconds / 60)} m`;
  }
  return `${sign}${absoluteSeconds} s`;
};

const useMediaMatches = (query: string): boolean => {
  const [matches, setMatches] = useState(() => {
    if (typeof window === "undefined") {
      return false;
    }
    return window.matchMedia(query).matches;
  });

  useEffect(() => {
    const media = window.matchMedia(query);
    const onChange = () => setMatches(media.matches);
    onChange();
    media.addEventListener("change", onChange);
    return () => media.removeEventListener("change", onChange);
  }, [query]);

  return matches;
};

function SubteForecastPage() {
  const isDesktopSplit = useMediaMatches(
    `(min-width: ${DESKTOP_SPLIT_MIN_WIDTH_PX}px)`,
  );
  const isMobile = useMediaMatches(
    `(max-width: ${MOBILE_SHEET_MAX_WIDTH_PX}px)`,
  );
  const [panelState, setPanelState] = useState<SubtePanelState>(() => {
    if (typeof window === "undefined") {
      return "closed";
    }
    return window.matchMedia(
      `(min-width: ${DESKTOP_SPLIT_MIN_WIDTH_PX}px)`,
    ).matches
      ? "expanded"
      : "closed";
  });
  const [panelTab, setPanelTab] = useState<SubtePanelTab>("arrivals");
  const [layoutTick, setLayoutTick] = useState(0);
  const wasDesktopSplitRef = useRef(isDesktopSplit);
  const [selectedEntityKey, setSelectedEntityKey] = useState<string | null>(
    null,
  );
  const [selectedArrivalKey, setSelectedArrivalKey] = useState<string | null>(
    null,
  );
  const [selectedLine, setSelectedLine] = useState<SubwayLineCode | null>(null);
  const [selectedDirectionKey, setSelectedDirectionKey] = useState<
    string | null
  >(null);
  const [selectedStationId, setSelectedStationId] = useState<string | null>(
    null,
  );

  const { data, loading, error, empty, isRefreshing, lastUpdated, refreshNow } =
    useSubteForecast({
      refreshIntervalMs: FORECAST_REFRESH_INTERVAL_MS,
      autoRefreshEnabled: true,
    });

  const {
    network,
    stations,
    loading: staticLoading,
    networkError,
    stationsError,
  } = useSubteStaticData();

  const stationDirectory = useMemo(
    () => buildStationDirectory(stations),
    [stations],
  );

  const directionOptions = useMemo(
    () => ({ directory: stationDirectory }),
    [stationDirectory],
  );

  const allEntities = useMemo(() => data?.entities ?? [], [data]);

  const lineEntities = useMemo(
    () =>
      allEntities.filter((entity) => entityMatchesLine(entity, selectedLine)),
    [allEntities, selectedLine],
  );

  const availableDirections = useMemo(() => {
    if (!selectedLine) {
      return [];
    }
    return listSubwayDirections(lineEntities, selectedLine, directionOptions);
  }, [lineEntities, selectedLine, directionOptions]);

  const resolvedDirectionKey = useMemo(() => {
    if (!selectedDirectionKey) {
      return null;
    }
    return availableDirections.some(
      (direction) => direction.key === selectedDirectionKey,
    )
      ? selectedDirectionKey
      : null;
  }, [availableDirections, selectedDirectionKey]);

  const orderedEntities = useMemo(
    () =>
      lineEntities.filter((entity) =>
        entityMatchesDirection(
          entity,
          resolvedDirectionKey,
          directionOptions,
        ),
      ),
    [lineEntities, resolvedDirectionKey, directionOptions],
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

  const selectedStationStaticId = useMemo(() => {
    const id = selectedStationFeature?.properties?.id;
    if (typeof id === "number" || typeof id === "string") {
      return String(id);
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
      return style.label.replace(/^Linea\s+/i, "Línea ");
    }
    return typeof ral === "string" ? ral : null;
  }, [selectedStationFeature]);

  const arrivals = useMemo(() => {
    const referenceTime = data?.headerTimestamp;
    const items: SubteArrivalItem[] = [];

    orderedEntities.forEach((entity, entityIndex) => {
      const linea = entity.Linea;
      const lineCode = parseSubwayLineCode(linea?.Route_Id);
      const tripEntityKey = entityKey(entity, entityIndex);
      const direction = resolveSubwayDirection(entity, directionOptions);
      const stationsForTrip = linea?.Estaciones ?? [];

      stationsForTrip.forEach((station, stationIndex) => {
        if (
          !forecastStationMatchesSelection(
            stationDirectory,
            station,
            lineCode,
            selectedStationStaticId,
            selectedStationName,
          )
        ) {
          return;
        }

        const resolved = resolveForecastStation(
          stationDirectory,
          station,
          lineCode,
        );
        const name = resolved.displayName;
        if (!name) {
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
          directionId:
            typeof direction?.directionId === "number"
              ? direction.directionId
              : linea?.Direction_ID,
          directionKey: direction?.key,
          directionLabel: direction?.label,
          originName: direction?.originName,
          destinationName: direction?.destinationName,
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
  }, [
    orderedEntities,
    selectedStationName,
    selectedStationStaticId,
    data?.headerTimestamp,
    stationDirectory,
    directionOptions,
  ]);

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

  const routeStations = useMemo((): SubteDisplayStation[] => {
    const linea = selectedEntity?.Linea;
    if (linea?.Estaciones?.length) {
      const lineCode = parseSubwayLineCode(linea.Route_Id);
      return linea.Estaciones.map((station, index) => {
        const resolved = resolveForecastStation(
          stationDirectory,
          station,
          lineCode,
        );
        return {
          key: `${station.stop_id ?? "stop"}-${index}`,
          displayName: resolved.displayName || station.stop_name || "Estación",
          staticId: resolved.staticId,
          arrivalTime: station.arrival?.time,
          departureTime: station.departure?.time,
          arrivalDelay: station.arrival?.delay,
          departureDelay: station.departure?.delay,
        };
      });
    }

    if (!selectedLine) {
      return [];
    }

    const staticStations = stationDirectory.byLine.get(selectedLine) ?? [];
    return staticStations.map((station) => ({
      key: `static-${station.staticId}`,
      displayName: station.name,
      staticId: station.staticId,
    }));
  }, [selectedEntity, selectedLine, stationDirectory]);

  const selectedStationKey = useMemo(() => {
    if (!selectedStationName && !selectedStationStaticId) {
      return null;
    }
    const match = routeStations.find((station) => {
      if (
        selectedStationStaticId &&
        station.staticId === selectedStationStaticId
      ) {
        return true;
      }
      return (
        selectedStationName !== null &&
        normalizeStationName(station.displayName) ===
          normalizeStationName(selectedStationName)
      );
    });
    return match?.key ?? null;
  }, [routeStations, selectedStationName, selectedStationStaticId]);

  const selectedLineStyle = getSubwayLineStyle(selectedLine);
  // El mapa base se monta siempre; network/stations/forecast son independientes.
  const effectivePanelState: SubtePanelState = isDesktopSplit
    ? "expanded"
    : panelState;
  const layoutRevision =
    (isDesktopSplit ? 10 : 0) +
    (effectivePanelState === "closed" ? 0 : 1) +
    (effectivePanelState === "expanded" ? 2 : 0) +
    (effectivePanelState === "summary" ? 4 : 0) +
    layoutTick * 8;

  useEffect(() => {
    const wasDesktopSplit = wasDesktopSplitRef.current;
    wasDesktopSplitRef.current = isDesktopSplit;

    if (isDesktopSplit) {
      // En split laptop/escritorio el panel permanece siempre visible.
      setPanelState("expanded");
      return;
    }

    if (wasDesktopSplit && !isDesktopSplit) {
      // Al salir del split, evitar llevar fullscreen / panel expandido al overlay.
      setPanelState((current) =>
        current === "expanded" ? "summary" : current,
      );
    }
  }, [isDesktopSplit]);

  const openPanel = (
    preferred: SubtePanelState = "summary",
    tab: SubtePanelTab = "arrivals",
  ) => {
    setPanelTab(tab);
    if (isDesktopSplit) {
      setPanelState("expanded");
      return;
    }
    if (preferred === "closed") {
      setPanelState("closed");
      return;
    }
    setPanelState(preferred);
  };

  const resetTripSelection = () => {
    setSelectedEntityKey(null);
    setSelectedArrivalKey(null);
  };

  const handleChipSelect = (line: SubwayLineCode) => {
    setSelectedLine((current) => {
      const next = current === line ? null : line;
      setSelectedStationId(null);
      setSelectedDirectionKey(null);
      resetTripSelection();
      return next;
    });
    openPanel("summary", "arrivals");
  };

  const handleSelectAllLines = () => {
    setSelectedLine(null);
    setSelectedStationId(null);
    setSelectedDirectionKey(null);
    resetTripSelection();
  };

  const getStationArrivalSummary = useCallback(
    (
      stationId: string,
      line: SubwayLineCode | null,
    ): StationArrivalSummary | null => {
      const feature = stations?.features.find((item) => {
        const id = item.properties?.id;
        const nam = item.properties?.nam;
        return (
          String(id ?? "") === stationId ||
          (typeof nam === "string" && nam === stationId)
        );
      });
      const stationName =
        typeof feature?.properties?.nam === "string"
          ? feature.properties.nam.trim()
          : stationId;
      const normalizedName = normalizeStationName(stationName);
      const referenceTime = data?.headerTimestamp;
      const candidates = allEntities.filter((entity) =>
        entityMatchesLine(entity, line),
      );

      for (const entity of candidates) {
        const linea = entity.Linea;
        const lineCode = parseSubwayLineCode(linea?.Route_Id);
        for (const station of linea?.Estaciones ?? []) {
          const resolved = resolveForecastStation(
            stationDirectory,
            station,
            lineCode,
          );
          if (normalizeStationName(resolved.displayName) !== normalizedName) {
            continue;
          }
          const direction = resolveSubwayDirection(entity, directionOptions);
          const arrivalTime = station.arrival?.time ?? station.departure?.time;
          return {
            available: Boolean(arrivalTime),
            directionLabel: direction?.label,
            arrivalLabel: formatArrivalLabel(arrivalTime, referenceTime),
            delayLabel: formatDelayLabel(
              station.arrival?.delay ?? station.departure?.delay,
            ),
          };
        }
      }

      return { available: false };
    },
    [
      allEntities,
      data?.headerTimestamp,
      directionOptions,
      stationDirectory,
      stations,
    ],
  );

  const panelIsClosed = effectivePanelState === "closed";
  const mapStageClassName = [
    "subte-map-stage",
    isDesktopSplit ? "is-split" : "is-overlay",
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <section className="subte-page">
      <div
        className="subte-line-filters"
        role="toolbar"
        aria-label="Filtro de líneas"
      >
        <button
          type="button"
          className={`subte-line-chip is-all ${selectedLine === null ? "active" : ""}`}
          onClick={handleSelectAllLines}
          aria-pressed={selectedLine === null}
          aria-label="Seleccionar todas las líneas"
          title="Todas"
        >
          Todas
        </button>
        {SUBWAY_LINES.map((line) => {
          const isActive = selectedLine === line.code;
          return (
            <button
              key={line.code}
              type="button"
              className={`subte-line-chip is-line ${isActive ? "active" : ""}`}
              style={{
                ["--subte-line-color" as string]: line.color,
                ["--subte-line-text" as string]: line.textColor,
              }}
              onClick={() => handleChipSelect(line.code)}
              aria-pressed={isActive}
              aria-label={`Seleccionar Línea ${line.code}`}
              title={`Línea ${line.code}`}
            >
              <span className="subte-line-chip-swatch" aria-hidden="true" />
              <span className="subte-line-chip-code">{line.code}</span>
            </button>
          );
        })}
      </div>

      {(staticLoading || networkError || stationsError || error) && (
        <div className="subte-inline-status" role="status">
          {staticLoading ? <span>Cargando recorridos y estaciones…</span> : null}
          {networkError ? (
            <span className="is-error">No pudimos cargar los recorridos.</span>
          ) : null}
          {stationsError ? (
            <span className="is-error">No pudimos cargar las estaciones.</span>
          ) : null}
          {!loading && error ? (
            <span className="is-error">
              No pudimos cargar las próximas llegadas.
            </span>
          ) : null}
        </div>
      )}

      <div
        className={mapStageClassName}
        onTransitionEnd={(event) => {
          if (event.target !== event.currentTarget) {
            return;
          }
          setLayoutTick((tick) => tick + 1);
        }}
      >
        <div className="subte-map-column">
          <SubteMapView
            network={network}
            stations={stations}
            selectedLine={selectedLine}
            selectedStationId={selectedStationId}
            layoutRevision={layoutRevision}
            panelState={effectivePanelState}
            isDesktopSplit={isDesktopSplit}
            getStationArrivalSummary={getStationArrivalSummary}
            onSelectLine={(line) => {
              setSelectedLine(line);
              setSelectedStationId(null);
              setSelectedDirectionKey(null);
              resetTripSelection();
            }}
            onSelectStation={(stationId, line) => {
              setSelectedStationId(stationId);
              setSelectedArrivalKey(null);
              if (line && line !== selectedLine) {
                setSelectedLine(line);
                setSelectedDirectionKey(null);
              } else if (line) {
                setSelectedLine(line);
              }
            }}
            onOpenStationArrivals={(stationId, line) => {
              setSelectedStationId(stationId);
              setSelectedArrivalKey(null);
              if (line) {
                setSelectedLine(line);
              }
              openPanel("summary", "arrivals");
            }}
            onOpenLinePanel={(line) => {
              setSelectedLine(line);
              setSelectedStationId(null);
              setSelectedDirectionKey(null);
              resetTripSelection();
              openPanel("summary", "arrivals");
            }}
          />

          {!isDesktopSplit && panelIsClosed ? (
            <button
              type="button"
              className="subte-open-panel-btn"
              onClick={() => openPanel("summary", "arrivals")}
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
        </div>

        <SubteInfoPanel
          state={effectivePanelState}
          isMobile={isMobile}
          isDesktopSplit={isDesktopSplit}
          selectedLine={selectedLine}
          selectedStationName={selectedStationName}
          selectedStationLineLabel={selectedStationLineLabel}
          directions={availableDirections}
          selectedDirectionKey={resolvedDirectionKey}
          activeTab={panelTab}
          onActiveTabChange={setPanelTab}
          onSelectDirection={(key) => {
            setSelectedDirectionKey(key);
            resetTripSelection();
          }}
          arrivals={arrivals}
          selectedArrivalKey={resolvedArrivalKey}
          routeStations={routeStations}
          selectedStationKey={selectedStationKey}
          forecastLoading={loading}
          isRefreshing={isRefreshing}
          forecastError={Boolean(error)}
          forecastEmpty={empty}
          lastUpdated={lastUpdated}
          onRefresh={refreshNow}
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
          onSelectRouteStation={(station) => {
            if (station.staticId) {
              setSelectedStationId(station.staticId);
            } else {
              setSelectedStationId(station.displayName);
            }
            setSelectedArrivalKey(null);
            setPanelTab("arrivals");
          }}
          onClose={() => {
            if (!isDesktopSplit) {
              setPanelState("closed");
            }
          }}
          onMinimize={() => {
            if (!isDesktopSplit) {
              setPanelState("summary");
            }
          }}
          onExpand={() => setPanelState("expanded")}
          onClearStation={() => setSelectedStationId(null)}
          onLayoutTransitionEnd={() => {
            setLayoutTick((tick) => tick + 1);
          }}
        />
      </div>
    </section>
  );
}

export default SubteForecastPage;
