import { useEffect, useMemo, useRef, useState } from "react";
import { MAP_BASEMAP_STYLE } from "../constants/mapBasemap";
import {
  getSubwayLineColor,
  getSubwayLineStyle,
  parseSubwayLineCode,
  type SubwayLineCode,
} from "../constants/subwayLines";
import type { SubteGeoJsonFeatureCollection } from "../types/subte";
import { normalizeStationName } from "../utils/resolveStation";

export interface StationArrivalSummary {
  directionLabel?: string;
  arrivalLabel?: string;
  delayLabel?: string;
  available: boolean;
}

interface SubteMapViewProps {
  network: SubteGeoJsonFeatureCollection | null;
  stations: SubteGeoJsonFeatureCollection | null;
  selectedLine: SubwayLineCode | null;
  selectedStationId: string | null;
  layoutRevision?: number;
  getStationArrivalSummary?: (
    stationId: string,
    line: SubwayLineCode | null,
  ) => StationArrivalSummary | null;
  onSelectLine?: (line: SubwayLineCode | null) => void;
  onSelectStation?: (
    stationId: string | null,
    line: SubwayLineCode | null,
  ) => void;
  onOpenStationArrivals?: (
    stationId: string,
    line: SubwayLineCode | null,
  ) => void;
  onOpenLinePanel?: (line: SubwayLineCode) => void;
}

interface MapLibreLngLatBoundsLike {
  extend: (coord: [number, number]) => void;
  isEmpty: () => boolean;
}

interface MapLibreGeoJSONSource {
  setData: (data: SubteGeoJsonFeatureCollection) => void;
}

interface MapLibreMapMouseEvent {
  lngLat: { lng: number; lat: number };
  features?: Array<{
    geometry?: { coordinates?: unknown };
    properties?: Record<string, unknown>;
  }>;
}

interface MapLibrePopup {
  setLngLat: (lngLat: [number, number]) => MapLibrePopup;
  setDOMContent: (element: HTMLElement) => MapLibrePopup;
  addTo: (map: MapLibreMap) => MapLibrePopup;
  remove: () => void;
  on: (event: "close" | "open", handler: () => void) => MapLibrePopup;
}

interface MapLibreMap {
  fitBounds: (
    bounds: MapLibreLngLatBoundsLike | [[number, number], [number, number]],
    options?: { padding?: number; duration?: number; maxZoom?: number },
  ) => void;
  flyTo: (options: {
    center: [number, number];
    zoom?: number;
    duration?: number;
  }) => void;
  addSource: (
    id: string,
    source: { type: "geojson"; data: SubteGeoJsonFeatureCollection },
  ) => void;
  getSource: (id: string) => unknown;
  addLayer: (layer: {
    id: string;
    type: "line" | "circle" | "symbol";
    source: string;
    filter?: unknown[];
    paint?: Record<string, unknown>;
    layout?: Record<string, unknown>;
  }) => void;
  getLayer: (id: string) => unknown;
  setFilter: (layerId: string, filter: unknown[] | null) => void;
  setPaintProperty: (layerId: string, name: string, value: unknown) => void;
  resize: () => void;
  on: {
    (event: "load", handler: () => void): void;
    (
      event: "click",
      layerId: string,
      handler: (ev: MapLibreMapMouseEvent) => void,
    ): void;
    (
      event: "mouseenter" | "mouseleave",
      layerId: string,
      handler: () => void,
    ): void;
  };
  off: {
    (event: "load", handler: () => void): void;
    (
      event: "click",
      layerId: string,
      handler: (ev: MapLibreMapMouseEvent) => void,
    ): void;
    (
      event: "mouseenter" | "mouseleave",
      layerId: string,
      handler: () => void,
    ): void;
  };
  getCanvas: () => HTMLCanvasElement;
  remove: () => void;
}

interface MapLibreApi {
  Map: new (options: {
    container: HTMLElement;
    style: string | Record<string, unknown>;
    center: [number, number];
    zoom: number;
  }) => MapLibreMap;
  LngLatBounds: new (
    sw?: [number, number],
    ne?: [number, number],
  ) => MapLibreLngLatBoundsLike;
  Popup: new (options?: {
    closeButton?: boolean;
    closeOnClick?: boolean;
    className?: string;
    maxWidth?: string;
    offset?: number;
  }) => MapLibrePopup;
}

const MAPLIBRE_SCRIPT_ID = "maplibre-js-cdn";
const MAPLIBRE_CSS_ID = "maplibre-css-cdn";
const MAPLIBRE_SCRIPT_URL =
  "https://unpkg.com/maplibre-gl@4.7.1/dist/maplibre-gl.js";
const MAPLIBRE_CSS_URL =
  "https://unpkg.com/maplibre-gl@4.7.1/dist/maplibre-gl.css";

const NETWORK_SOURCE_ID = "subte-network";
const STATIONS_SOURCE_ID = "subte-stations";
const NETWORK_LAYER_ID = "subte-network-line";
const STATIONS_LAYER_ID = "subte-stations-circle";
const STATIONS_SELECTED_LAYER_ID = "subte-stations-selected";

const EMPTY_COLLECTION: SubteGeoJsonFeatureCollection = {
  type: "FeatureCollection",
  features: [],
};

let mapLibreLoadPromise: Promise<void> | null = null;

const getMapLibre = (): MapLibreApi | undefined => {
  return (window as Window & { maplibregl?: MapLibreApi }).maplibregl;
};

const loadMapLibreAssets = (): Promise<void> => {
  if (getMapLibre()) {
    return Promise.resolve();
  }

  if (mapLibreLoadPromise) {
    return mapLibreLoadPromise;
  }

  mapLibreLoadPromise = new Promise<void>((resolve, reject) => {
    if (!document.getElementById(MAPLIBRE_CSS_ID)) {
      const css = document.createElement("link");
      css.id = MAPLIBRE_CSS_ID;
      css.rel = "stylesheet";
      css.href = MAPLIBRE_CSS_URL;
      document.head.appendChild(css);
    }

    const existingScript = document.getElementById(MAPLIBRE_SCRIPT_ID);
    if (existingScript && getMapLibre()) {
      resolve();
      return;
    }

    if (existingScript) {
      existingScript.addEventListener("load", () => resolve(), { once: true });
      existingScript.addEventListener(
        "error",
        () => reject(new Error("No se pudo cargar MapLibre")),
        { once: true },
      );
      return;
    }

    const script = document.createElement("script");
    script.id = MAPLIBRE_SCRIPT_ID;
    script.src = MAPLIBRE_SCRIPT_URL;
    script.async = true;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error("No se pudo cargar MapLibre"));
    document.body.appendChild(script);
  });

  return mapLibreLoadPromise;
};

const lineColorExpression = [
  "match",
  ["coalesce", ["get", "lineCode"], ""],
  "A",
  getSubwayLineColor("A"),
  "B",
  getSubwayLineColor("B"),
  "C",
  getSubwayLineColor("C"),
  "D",
  getSubwayLineColor("D"),
  "E",
  getSubwayLineColor("E"),
  "H",
  getSubwayLineColor("H"),
  "#64748b",
];

const collectCoordinates = (
  geometry: unknown,
  output: Array<[number, number]>,
): void => {
  if (!geometry || typeof geometry !== "object") {
    return;
  }

  const geom = geometry as { type?: string; coordinates?: unknown };
  if (geom.type === "Point" && Array.isArray(geom.coordinates)) {
    const [lng, lat] = geom.coordinates;
    if (typeof lng === "number" && typeof lat === "number") {
      output.push([lng, lat]);
    }
    return;
  }

  if (geom.type === "LineString" && Array.isArray(geom.coordinates)) {
    for (const coord of geom.coordinates) {
      if (
        Array.isArray(coord) &&
        typeof coord[0] === "number" &&
        typeof coord[1] === "number"
      ) {
        output.push([coord[0], coord[1]]);
      }
    }
    return;
  }

  if (geom.type === "MultiLineString" && Array.isArray(geom.coordinates)) {
    for (const line of geom.coordinates) {
      if (!Array.isArray(line)) {
        continue;
      }
      for (const coord of line) {
        if (
          Array.isArray(coord) &&
          typeof coord[0] === "number" &&
          typeof coord[1] === "number"
        ) {
          output.push([coord[0], coord[1]]);
        }
      }
    }
  }
};

const fitToFeatures = (
  map: MapLibreMap,
  collections: Array<SubteGeoJsonFeatureCollection | null>,
  selectedLine: SubwayLineCode | null,
) => {
  const maplibre = getMapLibre();
  if (!maplibre) {
    return;
  }

  const coords: Array<[number, number]> = [];
  for (const collection of collections) {
    if (!collection) {
      continue;
    }
    for (const feature of collection.features) {
      const lineCode = parseSubwayLineCode(
        typeof feature.properties?.lineCode === "string"
          ? feature.properties.lineCode
          : null,
      );
      if (selectedLine && lineCode !== selectedLine) {
        continue;
      }
      collectCoordinates(feature.geometry, coords);
    }
  }

  if (coords.length === 0) {
    return;
  }

  const bounds = new maplibre.LngLatBounds(coords[0], coords[0]);
  for (const coord of coords) {
    bounds.extend(coord);
  }

  map.fitBounds(bounds, {
    padding: 48,
    duration: 500,
    maxZoom: selectedLine ? 13 : 12,
  });
};

const lineFilter = (selectedLine: SubwayLineCode | null): unknown[] | null => {
  if (!selectedLine) {
    return null;
  }
  return ["==", ["get", "lineCode"], selectedLine];
};

const stationIdOf = (properties: Record<string, unknown> | null | undefined) => {
  if (!properties) {
    return null;
  }
  if (typeof properties.id === "number" || typeof properties.id === "string") {
    return String(properties.id);
  }
  if (typeof properties.nam === "string" && properties.nam.trim()) {
    return properties.nam.trim();
  }
  return null;
};

const lineCodeFromStationProperties = (
  properties: Record<string, unknown> | null | undefined,
): SubwayLineCode | null => {
  if (!properties) {
    return null;
  }
  return parseSubwayLineCode(
    typeof properties.lineCode === "string"
      ? properties.lineCode
      : typeof properties.ral === "string"
        ? properties.ral
        : null,
  );
};

const findCombinationLines = (
  stations: SubteGeoJsonFeatureCollection | null,
  stationName: string,
  primaryLine: SubwayLineCode | null,
): SubwayLineCode[] => {
  if (!stations) {
    return primaryLine ? [primaryLine] : [];
  }

  const normalized = normalizeStationName(stationName);
  if (!normalized) {
    return primaryLine ? [primaryLine] : [];
  }

  const codes = new Set<SubwayLineCode>();
  if (primaryLine) {
    codes.add(primaryLine);
  }

  for (const feature of stations.features) {
    const name =
      typeof feature.properties?.nam === "string"
        ? feature.properties.nam
        : "";
    if (normalizeStationName(name) !== normalized) {
      continue;
    }
    const code = lineCodeFromStationProperties(feature.properties);
    if (code) {
      codes.add(code);
    }
  }

  return Array.from(codes).sort();
};

const appendText = (parent: HTMLElement, tag: string, text: string, className?: string) => {
  const element = document.createElement(tag);
  if (className) {
    element.className = className;
  }
  element.textContent = text;
  parent.appendChild(element);
  return element;
};

const buildStationPopupContent = ({
  stationName,
  lineCodes,
  arrivalSummary,
  onOpenArrivals,
}: {
  stationName: string;
  lineCodes: SubwayLineCode[];
  arrivalSummary: StationArrivalSummary | null;
  onOpenArrivals: () => void;
}): HTMLElement => {
  const root = document.createElement("div");
  root.className = "subte-map-popup";

  const header = document.createElement("div");
  header.className = "subte-map-popup-header";

  const badges = document.createElement("div");
  badges.className = "subte-map-popup-badges";
  for (const code of lineCodes) {
    const style = getSubwayLineStyle(code);
    if (!style) {
      continue;
    }
    const badge = document.createElement("span");
    badge.className = "subte-line-badge subte-line-badge-sm";
    badge.style.backgroundColor = style.color;
    badge.style.color = style.textColor;
    badge.textContent = style.code;
    badges.appendChild(badge);
  }
  header.appendChild(badges);
  appendText(header, "strong", stationName, "subte-map-popup-title");
  root.appendChild(header);

  const body = document.createElement("div");
  body.className = "subte-map-popup-body";

  if (lineCodes.length === 1) {
    const style = getSubwayLineStyle(lineCodes[0]);
    if (style) {
      appendText(
        body,
        "p",
        style.label.replace(/^Linea\s+/i, "Línea "),
        "subte-map-popup-line",
      );
    }
  } else if (lineCodes.length > 1) {
    appendText(
      body,
      "p",
      `Combinación entre líneas ${lineCodes.join(" y ")}`,
      "subte-map-popup-combo",
    );
  }

  if (arrivalSummary?.directionLabel) {
    appendText(
      body,
      "p",
      arrivalSummary.directionLabel.includes("→")
        ? `Hacia ${arrivalSummary.directionLabel.split("→").pop()?.trim() ?? arrivalSummary.directionLabel}`
        : arrivalSummary.directionLabel,
      "subte-map-popup-direction",
    );
  }

  if (arrivalSummary?.available && arrivalSummary.arrivalLabel) {
    const status = document.createElement("p");
    status.className = "subte-map-popup-arrival";
    status.textContent = `Próxima llegada: ${arrivalSummary.arrivalLabel}`;
    if (arrivalSummary.delayLabel) {
      const delay = document.createElement("span");
      delay.className = "subte-map-popup-delay";
      delay.textContent = arrivalSummary.delayLabel;
      status.appendChild(document.createTextNode(" · "));
      status.appendChild(delay);
    }
    body.appendChild(status);
  } else {
    appendText(
      body,
      "p",
      "No hay próximas llegadas disponibles.",
      "subte-map-popup-empty",
    );
  }

  root.appendChild(body);

  const action = document.createElement("button");
  action.type = "button";
  action.className = "subte-map-popup-action";
  action.textContent = "Ver próximas llegadas";
  action.addEventListener("click", (event) => {
    event.preventDefault();
    event.stopPropagation();
    onOpenArrivals();
  });
  root.appendChild(action);

  return root;
};

const buildLinePopupContent = ({
  lineCode,
  onOpenLine,
}: {
  lineCode: SubwayLineCode;
  onOpenLine: () => void;
}): HTMLElement => {
  const style = getSubwayLineStyle(lineCode);
  const root = document.createElement("div");
  root.className = "subte-map-popup subte-map-popup-line-only";

  const header = document.createElement("div");
  header.className = "subte-map-popup-header";

  if (style) {
    const badge = document.createElement("span");
    badge.className = "subte-line-badge subte-line-badge-sm";
    badge.style.backgroundColor = style.color;
    badge.style.color = style.textColor;
    badge.textContent = style.code;
    header.appendChild(badge);
    appendText(
      header,
      "strong",
      style.label.replace(/^Linea\s+/i, "Línea "),
      "subte-map-popup-title",
    );
  }

  root.appendChild(header);

  const action = document.createElement("button");
  action.type = "button";
  action.className = "subte-map-popup-action";
  action.textContent = "Ver línea";
  action.addEventListener("click", (event) => {
    event.preventDefault();
    event.stopPropagation();
    onOpenLine();
  });
  root.appendChild(action);

  return root;
};

function SubteMapView({
  network,
  stations,
  selectedLine,
  selectedStationId,
  layoutRevision = 0,
  getStationArrivalSummary,
  onSelectLine,
  onSelectStation,
  onOpenStationArrivals,
  onOpenLinePanel,
}: SubteMapViewProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<MapLibreMap | null>(null);
  const popupRef = useRef<MapLibrePopup | null>(null);
  const stationsRef = useRef(stations);
  const getArrivalSummaryRef = useRef(getStationArrivalSummary);
  const onSelectLineRef = useRef(onSelectLine);
  const onSelectStationRef = useRef(onSelectStation);
  const onOpenStationArrivalsRef = useRef(onOpenStationArrivals);
  const onOpenLinePanelRef = useRef(onOpenLinePanel);
  const [mapReady, setMapReady] = useState(false);
  const [mapError, setMapError] = useState<string | null>(null);

  stationsRef.current = stations;
  getArrivalSummaryRef.current = getStationArrivalSummary;
  onSelectLineRef.current = onSelectLine;
  onSelectStationRef.current = onSelectStation;
  onOpenStationArrivalsRef.current = onOpenStationArrivals;
  onOpenLinePanelRef.current = onOpenLinePanel;

  const hasGeometry = useMemo(() => {
    return (
      (network?.features.length ?? 0) > 0 ||
      (stations?.features.length ?? 0) > 0
    );
  }, [network, stations]);

  useEffect(() => {
    let cancelled = false;
    let mapInstance: MapLibreMap | null = null;

    const setup = async () => {
      if (!containerRef.current) {
        return;
      }

      try {
        await loadMapLibreAssets();
        if (cancelled || !containerRef.current) {
          return;
        }

        const maplibre = getMapLibre();
        if (!maplibre) {
          throw new Error("MapLibre no disponible");
        }

        mapInstance = new maplibre.Map({
          container: containerRef.current,
          style: MAP_BASEMAP_STYLE,
          center: [-58.42, -34.61],
          zoom: 11.4,
        });
        mapRef.current = mapInstance;

        const closeActivePopup = () => {
          popupRef.current?.remove();
          popupRef.current = null;
        };

        const handleLoad = () => {
          if (!mapInstance) {
            return;
          }

          mapInstance.addSource(NETWORK_SOURCE_ID, {
            type: "geojson",
            data: EMPTY_COLLECTION,
          });
          mapInstance.addSource(STATIONS_SOURCE_ID, {
            type: "geojson",
            data: EMPTY_COLLECTION,
          });

          mapInstance.addLayer({
            id: NETWORK_LAYER_ID,
            type: "line",
            source: NETWORK_SOURCE_ID,
            layout: {
              "line-join": "round",
              "line-cap": "round",
            },
            paint: {
              "line-color": lineColorExpression,
              "line-width": 4,
              "line-opacity": 0.92,
            },
          });

          mapInstance.addLayer({
            id: STATIONS_LAYER_ID,
            type: "circle",
            source: STATIONS_SOURCE_ID,
            paint: {
              "circle-radius": 5,
              "circle-color": "#ffffff",
              "circle-stroke-width": 2.5,
              "circle-stroke-color": lineColorExpression,
            },
          });

          mapInstance.addLayer({
            id: STATIONS_SELECTED_LAYER_ID,
            type: "circle",
            source: STATIONS_SOURCE_ID,
            filter: ["==", ["get", "id"], ""],
            paint: {
              "circle-radius": 9,
              "circle-color": "rgba(15, 23, 42, 0.08)",
              "circle-stroke-width": 3,
              "circle-stroke-color": "#0f172a",
            },
          });

          const handleStationClick = (event: MapLibreMapMouseEvent) => {
            const feature = event.features?.[0];
            const properties = feature?.properties ?? {};
            const stationId = stationIdOf(properties);
            const lineCode = lineCodeFromStationProperties(properties);
            const name =
              typeof properties.nam === "string" && properties.nam.trim()
                ? properties.nam.trim()
                : "Estación";

            onSelectStationRef.current?.(stationId, lineCode);

            const maplibreApi = getMapLibre();
            if (!maplibreApi || !mapInstance || !stationId) {
              return;
            }

            closeActivePopup();

            const lineCodes = findCombinationLines(
              stationsRef.current,
              name,
              lineCode,
            );
            const arrivalSummary =
              getArrivalSummaryRef.current?.(stationId, lineCode) ?? null;

            const content = buildStationPopupContent({
              stationName: name,
              lineCodes,
              arrivalSummary,
              onOpenArrivals: () => {
                onOpenStationArrivalsRef.current?.(stationId, lineCode);
                closeActivePopup();
              },
            });

            const popup = new maplibreApi.Popup({
              closeButton: true,
              closeOnClick: true,
              className: "subte-maplibre-popup",
              maxWidth: "320px",
              offset: 16,
            })
              .setLngLat([event.lngLat.lng, event.lngLat.lat])
              .setDOMContent(content)
              .addTo(mapInstance);

            popupRef.current = popup;
            popup.on("close", () => {
              if (popupRef.current === popup) {
                popupRef.current = null;
              }
            });
          };

          const handleNetworkClick = (event: MapLibreMapMouseEvent) => {
            const feature = event.features?.[0];
            const properties = feature?.properties ?? {};
            const lineCode = parseSubwayLineCode(
              typeof properties.lineCode === "string"
                ? properties.lineCode
                : typeof properties.fna === "string"
                  ? properties.fna
                  : typeof properties.nam === "string"
                    ? properties.nam
                    : null,
            );
            if (!lineCode) {
              return;
            }

            onSelectLineRef.current?.(lineCode);
            onSelectStationRef.current?.(null, lineCode);

            const maplibreApi = getMapLibre();
            if (!maplibreApi || !mapInstance) {
              return;
            }

            closeActivePopup();

            const content = buildLinePopupContent({
              lineCode,
              onOpenLine: () => {
                onOpenLinePanelRef.current?.(lineCode);
                closeActivePopup();
              },
            });

            const popup = new maplibreApi.Popup({
              closeButton: true,
              closeOnClick: true,
              className: "subte-maplibre-popup",
              maxWidth: "280px",
              offset: 12,
            })
              .setLngLat([event.lngLat.lng, event.lngLat.lat])
              .setDOMContent(content)
              .addTo(mapInstance);

            popupRef.current = popup;
            popup.on("close", () => {
              if (popupRef.current === popup) {
                popupRef.current = null;
              }
            });
          };

          mapInstance.on("click", STATIONS_LAYER_ID, handleStationClick);
          mapInstance.on("click", NETWORK_LAYER_ID, handleNetworkClick);
          mapInstance.on("mouseenter", STATIONS_LAYER_ID, () => {
            mapInstance?.getCanvas().style.setProperty("cursor", "pointer");
          });
          mapInstance.on("mouseleave", STATIONS_LAYER_ID, () => {
            mapInstance?.getCanvas().style.removeProperty("cursor");
          });
          mapInstance.on("mouseenter", NETWORK_LAYER_ID, () => {
            mapInstance?.getCanvas().style.setProperty("cursor", "pointer");
          });
          mapInstance.on("mouseleave", NETWORK_LAYER_ID, () => {
            mapInstance?.getCanvas().style.removeProperty("cursor");
          });

          setMapReady(true);
        };

        mapInstance.on("load", handleLoad);
      } catch (error) {
        if (!cancelled) {
          setMapError(
            error instanceof Error
              ? error.message
              : "No se pudo inicializar el mapa de subtes",
          );
        }
      }
    };

    void setup();

    return () => {
      cancelled = true;
      setMapReady(false);
      popupRef.current?.remove();
      popupRef.current = null;
      if (mapInstance) {
        mapInstance.remove();
      }
      mapRef.current = null;
    };
  }, []);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !mapReady) {
      return;
    }

    const networkSource = map.getSource(NETWORK_SOURCE_ID) as
      | MapLibreGeoJSONSource
      | undefined;
    const stationsSource = map.getSource(STATIONS_SOURCE_ID) as
      | MapLibreGeoJSONSource
      | undefined;

    networkSource?.setData(network ?? EMPTY_COLLECTION);
    stationsSource?.setData(stations ?? EMPTY_COLLECTION);

    if (map.getLayer(NETWORK_LAYER_ID)) {
      map.setFilter(NETWORK_LAYER_ID, lineFilter(selectedLine));
    }
    if (map.getLayer(STATIONS_LAYER_ID)) {
      map.setFilter(STATIONS_LAYER_ID, lineFilter(selectedLine));
    }
  }, [mapReady, network, stations, selectedLine]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !mapReady || !map.getLayer(STATIONS_SELECTED_LAYER_ID)) {
      return;
    }

    map.setFilter(
      STATIONS_SELECTED_LAYER_ID,
      selectedStationId
        ? [
            "all",
            ...(selectedLine
              ? [["==", ["get", "lineCode"], selectedLine]]
              : []),
            [
              "any",
              ["==", ["to-string", ["get", "id"]], selectedStationId],
              ["==", ["get", "nam"], selectedStationId],
            ],
          ]
        : ["==", ["get", "id"], ""],
    );

    if (!selectedStationId || !stations) {
      return;
    }

    const feature = stations.features.find((item) => {
      const id = item.properties?.id;
      const nam = item.properties?.nam;
      return (
        String(id ?? "") === selectedStationId ||
        (typeof nam === "string" && nam === selectedStationId)
      );
    });

    const geometry = feature?.geometry;
    if (
      geometry &&
      typeof geometry === "object" &&
      geometry.type === "Point" &&
      Array.isArray(geometry.coordinates) &&
      typeof geometry.coordinates[0] === "number" &&
      typeof geometry.coordinates[1] === "number"
    ) {
      map.flyTo({
        center: [geometry.coordinates[0], geometry.coordinates[1]],
        zoom: 14,
        duration: 450,
      });
    }
  }, [mapReady, selectedLine, selectedStationId, stations]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !mapReady) {
      return;
    }
    fitToFeatures(map, [network, stations], selectedLine);
  }, [mapReady, network, stations, selectedLine]);

  useEffect(() => {
    const map = mapRef.current;
    const container = containerRef.current;
    if (!map || !mapReady || !container) {
      return;
    }

    let frame = 0;
    const resize = () => {
      if (!mapRef.current) {
        return;
      }
      mapRef.current.resize();
    };

    const scheduleResize = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(resize);
    };

    scheduleResize();

    if (typeof ResizeObserver === "undefined") {
      return () => cancelAnimationFrame(frame);
    }

    const observer = new ResizeObserver(() => {
      scheduleResize();
    });
    observer.observe(container);
    return () => {
      cancelAnimationFrame(frame);
      observer.disconnect();
    };
  }, [mapReady, layoutRevision]);

  return (
    <div className="subte-map-shell">
      <div ref={containerRef} className="subte-map-view" />
      {mapError ? (
        <div className="subte-map-overlay error">{mapError}</div>
      ) : null}
      {!mapError && !hasGeometry ? (
        <div className="subte-map-overlay">
          Todavía no hay red de subtes para mostrar.
        </div>
      ) : null}
    </div>
  );
}

export default SubteMapView;
