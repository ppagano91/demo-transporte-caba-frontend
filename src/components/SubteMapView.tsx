import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type SVGProps,
} from "react";
import { getBasemapStyleForTheme } from "../constants/mapBasemap";
import {
  getSubwayLineColor,
  getSubwayLineStyle,
  parseSubwayLineCode,
  type SubwayLineCode,
} from "../constants/subwayLines";
import type { ColorTheme } from "../constants/theme";
import { useTheme } from "../hooks/useTheme";
import type { SubteGeoJsonFeatureCollection } from "../types/subte";
import { normalizeStationName } from "../utils/resolveStation";
import type { SubtePanelState } from "./SubteInfoPanel";

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
  panelState?: SubtePanelState;
  isDesktopSplit?: boolean;
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
  setData: (data: unknown) => void;
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
  isOpen?: () => boolean;
}

interface MapLibreMarker {
  setLngLat: (lngLat: [number, number]) => MapLibreMarker;
  setPopup: (popup: MapLibrePopup) => MapLibreMarker;
  addTo: (map: MapLibreMap) => MapLibreMarker;
  remove: () => void;
  getElement: () => HTMLElement;
  getPopup: () => MapLibrePopup | null;
}

interface MapLibreStyleLayer {
  id: string;
  type?: string;
}

interface MapLibreStyle {
  layers?: MapLibreStyleLayer[];
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
  easeTo: (options: {
    center: [number, number];
    zoom?: number;
    duration?: number;
  }) => void;
  addSource: (
    id: string,
    source: { type: "geojson"; data: unknown },
  ) => void;
  getSource: (id: string) => unknown;
  addLayer: (
    layer: {
      id: string;
      type: "line" | "circle" | "symbol" | "fill";
      source: string;
      filter?: unknown[];
      paint?: Record<string, unknown>;
      layout?: Record<string, unknown>;
    },
    beforeId?: string,
  ) => void;
  getLayer: (id: string) => unknown;
  getStyle: () => MapLibreStyle;
  isStyleLoaded: () => boolean;
  setFilter: (layerId: string, filter: unknown[] | null) => void;
  setPaintProperty: (layerId: string, name: string, value: unknown) => void;
  setStyle: (
    style: string | Record<string, unknown>,
    options?: { diff?: boolean },
  ) => void;
  resize: () => void;
  on: {
    (event: "load" | "style.load" | "idle", handler: () => void): void;
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
  once: (event: "load" | "style.load" | "idle", handler: () => void) => void;
  off: {
    (event: "load" | "style.load" | "idle", handler: () => void): void;
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
    attributionControl?: boolean;
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
  Marker: new (options?: {
    element?: HTMLElement;
    anchor?: string;
    offset?: [number, number];
  }) => MapLibreMarker;
}

type LocationUiState =
  | "idle"
  | "locating"
  | "found"
  | "denied"
  | "unavailable"
  | "timeout"
  | "unsupported"
  | "insecure";

interface UserLocationState {
  lng: number;
  lat: number;
  accuracy: number | null;
}

const MAPLIBRE_SCRIPT_ID = "maplibre-js-cdn";
const MAPLIBRE_CSS_ID = "maplibre-css-cdn";
const MAPLIBRE_SCRIPT_URL =
  "https://unpkg.com/maplibre-gl@4.7.1/dist/maplibre-gl.js";
const MAPLIBRE_CSS_URL =
  "https://unpkg.com/maplibre-gl@4.7.1/dist/maplibre-gl.css";

const NETWORK_SOURCE_ID = "subte-network";
const STATIONS_SOURCE_ID = "subte-stations";
const NETWORK_CASING_LAYER_ID = "subte-network-casing";
const NETWORK_LAYER_ID = "subte-network-line";
const STATIONS_LAYER_ID = "subte-stations-circle";
const STATIONS_SELECTED_LAYER_ID = "subte-stations-selected";
const USER_ACCURACY_SOURCE_ID = "subte-user-accuracy";
const USER_ACCURACY_LAYER_ID = "subte-user-accuracy-fill";
const USER_ACCURACY_OUTLINE_LAYER_ID = "subte-user-accuracy-outline";

const EMPTY_COLLECTION: SubteGeoJsonFeatureCollection = {
  type: "FeatureCollection",
  features: [],
};

const GEOLOCATION_OPTIONS: PositionOptions = {
  enableHighAccuracy: true,
  timeout: 10000,
  maximumAge: 15000,
};

const LOCATION_MESSAGES: Record<
  Exclude<LocationUiState, "idle" | "locating" | "found">,
  string
> = {
  denied: "Permiso de ubicación rechazado.",
  unavailable: "No pudimos obtener tu ubicación.",
  timeout: "La ubicación tardó demasiado. Intentá nuevamente.",
  unsupported: "Tu navegador no permite obtener la ubicación.",
  insecure: "La ubicación requiere HTTPS.",
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

const appendText = (
  parent: HTMLElement,
  tag: string,
  text: string,
  className?: string,
) => {
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

const buildUserLocationPopupContent = ({
  accuracy,
  onClear,
}: {
  accuracy: number | null;
  onClear?: () => void;
}): HTMLElement => {
  const root = document.createElement("div");
  root.className = "subte-map-popup subte-map-popup-user";

  appendText(root, "strong", "VOS", "subte-map-popup-title");
  appendText(
    root,
    "p",
    "Tu ubicación aproximada",
    "subte-map-popup-direction",
  );

  if (
    accuracy !== null &&
    Number.isFinite(accuracy) &&
    accuracy > 0 &&
    accuracy < 5000
  ) {
    appendText(
      root,
      "p",
      `Precisión aproximada: ${Math.round(accuracy)} m`,
      "subte-map-popup-empty",
    );
  }

  if (onClear) {
    const action = document.createElement("button");
    action.type = "button";
    action.className = "subte-map-popup-action secondary";
    action.textContent = "Quitar ubicación";
    action.addEventListener("click", (event) => {
      event.preventDefault();
      event.stopPropagation();
      onClear();
    });
    root.appendChild(action);
  }

  return root;
};

const createUserMarkerElement = (animate = false): HTMLElement => {
  const root = document.createElement("button");
  root.type = "button";
  root.className = `subte-user-marker${animate ? " is-locating-pulse" : ""}`;
  root.setAttribute("aria-label", "Tu ubicación aproximada");
  root.title = "Tu ubicación aproximada";

  const halo = document.createElement("span");
  halo.className = "subte-user-marker-halo";
  halo.setAttribute("aria-hidden", "true");

  const dot = document.createElement("span");
  dot.className = "subte-user-marker-dot";
  dot.setAttribute("aria-hidden", "true");

  root.appendChild(halo);
  root.appendChild(dot);

  if (animate) {
    window.setTimeout(() => {
      root.classList.remove("is-locating-pulse");
    }, 1600);
  }

  return root;
};

/** Busca una capa symbol del basemap para insertar overlays debajo de labels. */
const findBasemapSymbolBeforeId = (map: MapLibreMap): string | undefined => {
  try {
    const layers = map.getStyle()?.layers;
    if (!Array.isArray(layers)) {
      return undefined;
    }
    for (const layer of layers) {
      if (
        layer.type === "symbol" &&
        typeof layer.id === "string" &&
        !layer.id.startsWith("subte-")
      ) {
        return layer.id;
      }
    }
  } catch {
    return undefined;
  }
  return undefined;
};

const addOwnedLayer = (
  map: MapLibreMap,
  layer: {
    id: string;
    type: "line" | "circle" | "symbol" | "fill";
    source: string;
    filter?: unknown[];
    paint?: Record<string, unknown>;
    layout?: Record<string, unknown>;
  },
  beforeId?: string,
): void => {
  if (map.getLayer(layer.id)) {
    return;
  }
  if (beforeId && map.getLayer(beforeId)) {
    map.addLayer(layer, beforeId);
    return;
  }
  map.addLayer(layer);
};

type AccuracyFeatureCollection = {
  type: "FeatureCollection";
  features: Array<{
    type: "Feature";
    properties: Record<string, unknown>;
    geometry: {
      type: "Polygon";
      coordinates: Array<Array<[number, number]>>;
    };
  }>;
};

/** Círculo GeoJSON aproximado en metros (sin envío al backend). */
const buildAccuracyCircle = (
  lng: number,
  lat: number,
  radiusMeters: number,
): AccuracyFeatureCollection => {
  const points = 64;
  const coords: Array<[number, number]> = [];
  const latRad = (lat * Math.PI) / 180;
  const metersPerDegLat = 111320;
  const metersPerDegLng = 111320 * Math.cos(latRad);

  for (let i = 0; i <= points; i += 1) {
    const angle = (i / points) * Math.PI * 2;
    const dLng = (radiusMeters * Math.cos(angle)) / metersPerDegLng;
    const dLat = (radiusMeters * Math.sin(angle)) / metersPerDegLat;
    coords.push([lng + dLng, lat + dLat]);
  }

  return {
    type: "FeatureCollection",
    features: [
      {
        type: "Feature",
        properties: {},
        geometry: {
          type: "Polygon",
          coordinates: [coords],
        },
      },
    ],
  };
};

const emptyAccuracyCollection = (): AccuracyFeatureCollection => ({
  type: "FeatureCollection",
  features: [],
});

function LocateIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg
      viewBox="0 0 24 24"
      width="20"
      height="20"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      {...props}
    >
      <circle cx="12" cy="12" r="3" />
      <path d="M12 2v3M12 19v3M2 12h3M19 12h3" />
      <circle cx="12" cy="12" r="8" />
    </svg>
  );
}

type LayerHandlers = {
  handleStationClick: (event: MapLibreMapMouseEvent) => void;
  handleNetworkClick: (event: MapLibreMapMouseEvent) => void;
  handleStationEnter: () => void;
  handleStationLeave: () => void;
  handleNetworkEnter: () => void;
  handleNetworkLeave: () => void;
};

function SubteMapView({
  network,
  stations,
  selectedLine,
  selectedStationId,
  layoutRevision = 0,
  panelState = "closed",
  isDesktopSplit = true,
  getStationArrivalSummary,
  onSelectLine,
  onSelectStation,
  onOpenStationArrivals,
  onOpenLinePanel,
}: SubteMapViewProps) {
  const { theme } = useTheme();
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<MapLibreMap | null>(null);
  const popupRef = useRef<MapLibrePopup | null>(null);
  const userMarkerRef = useRef<MapLibreMarker | null>(null);
  const userPopupRef = useRef<MapLibrePopup | null>(null);
  const listenersAttachedRef = useRef(false);
  const layerHandlersRef = useRef<LayerHandlers | null>(null);
  const themeRef = useRef<ColorTheme>(theme);
  const networkDataRef = useRef(network);
  const stationsDataRef = useRef(stations);
  const selectedLineRef = useRef(selectedLine);
  const selectedStationIdRef = useRef(selectedStationId);
  const userLocationRef = useRef<UserLocationState | null>(null);
  const locationActiveRef = useRef(false);
  const locationRequestIdRef = useRef(0);
  const styleRequestIdRef = useRef(0);
  const clearUserLocationRef = useRef<() => void>(() => undefined);
  const stationsRef = useRef(stations);
  const getArrivalSummaryRef = useRef(getStationArrivalSummary);
  const onSelectLineRef = useRef(onSelectLine);
  const onSelectStationRef = useRef(onSelectStation);
  const onOpenStationArrivalsRef = useRef(onOpenStationArrivals);
  const onOpenLinePanelRef = useRef(onOpenLinePanel);
  const [mapReady, setMapReady] = useState(false);
  const [mapError, setMapError] = useState<string | null>(null);
  const [locationState, setLocationState] = useState<LocationUiState>("idle");
  const [locationMessage, setLocationMessage] = useState<string | null>(null);
  const [userLocation, setUserLocation] = useState<UserLocationState | null>(
    null,
  );
  const [locationActive, setLocationActive] = useState(false);
  const initialFitDoneRef = useRef(false);
  const basemapThemeRef = useRef<ColorTheme>(theme);
  const toastTimerRef = useRef<number | null>(null);

  themeRef.current = theme;
  networkDataRef.current = network;
  stationsDataRef.current = stations;
  selectedLineRef.current = selectedLine;
  selectedStationIdRef.current = selectedStationId;
  userLocationRef.current = userLocation;
  locationActiveRef.current = locationActive;
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

  const showLocationToast = useCallback((message: string) => {
    setLocationMessage(message);
    if (toastTimerRef.current !== null) {
      window.clearTimeout(toastTimerRef.current);
    }
    toastTimerRef.current = window.setTimeout(() => {
      setLocationMessage(null);
      toastTimerRef.current = null;
    }, 4500);
  }, []);

  const closeActivePopup = useCallback(() => {
    popupRef.current?.remove();
    popupRef.current = null;
  }, []);

  const applySelectionFilters = useCallback((map: MapLibreMap) => {
    const line = selectedLineRef.current;
    const stationId = selectedStationIdRef.current;

    if (map.getLayer(NETWORK_CASING_LAYER_ID)) {
      map.setFilter(NETWORK_CASING_LAYER_ID, lineFilter(line));
    }
    if (map.getLayer(NETWORK_LAYER_ID)) {
      map.setFilter(NETWORK_LAYER_ID, lineFilter(line));
    }
    if (map.getLayer(STATIONS_LAYER_ID)) {
      map.setFilter(STATIONS_LAYER_ID, lineFilter(line));
    }
    if (map.getLayer(STATIONS_SELECTED_LAYER_ID)) {
      map.setFilter(
        STATIONS_SELECTED_LAYER_ID,
        stationId
          ? [
              "all",
              ...(line ? [["==", ["get", "lineCode"], line]] : []),
              [
                "any",
                ["==", ["to-string", ["get", "id"]], stationId],
                ["==", ["get", "nam"], stationId],
              ],
            ]
          : ["==", ["get", "id"], ""],
      );
    }
  }, []);

  const applyThemePaint = useCallback((map: MapLibreMap, nextTheme: ColorTheme) => {
    const isDark = nextTheme === "dark";
    if (map.getLayer(NETWORK_CASING_LAYER_ID)) {
      map.setPaintProperty(
        NETWORK_CASING_LAYER_ID,
        "line-color",
        isDark ? "rgba(15, 23, 42, 0.85)" : "rgba(255, 255, 255, 0.92)",
      );
    }
    if (map.getLayer(STATIONS_LAYER_ID)) {
      map.setPaintProperty(
        STATIONS_LAYER_ID,
        "circle-color",
        isDark ? "#0f172a" : "#ffffff",
      );
      map.setPaintProperty(
        STATIONS_LAYER_ID,
        "circle-stroke-width",
        isDark ? 3 : 2.5,
      );
    }
    if (map.getLayer(STATIONS_SELECTED_LAYER_ID)) {
      map.setPaintProperty(
        STATIONS_SELECTED_LAYER_ID,
        "circle-color",
        isDark ? "rgba(248, 250, 252, 0.16)" : "rgba(15, 23, 42, 0.08)",
      );
      map.setPaintProperty(
        STATIONS_SELECTED_LAYER_ID,
        "circle-stroke-color",
        isDark ? "#f8fafc" : "#0f172a",
      );
    }
    if (map.getLayer(USER_ACCURACY_LAYER_ID)) {
      map.setPaintProperty(
        USER_ACCURACY_LAYER_ID,
        "fill-color",
        isDark ? "rgba(56, 189, 248, 0.12)" : "rgba(11, 58, 102, 0.12)",
      );
    }
    if (map.getLayer(USER_ACCURACY_OUTLINE_LAYER_ID)) {
      map.setPaintProperty(
        USER_ACCURACY_OUTLINE_LAYER_ID,
        "line-color",
        isDark ? "rgba(125, 211, 252, 0.4)" : "rgba(11, 58, 102, 0.35)",
      );
    }
  }, []);

  const syncAccuracySource = useCallback((map: MapLibreMap) => {
    const source = map.getSource(USER_ACCURACY_SOURCE_ID) as
      | MapLibreGeoJSONSource
      | undefined;
    if (!source) {
      return;
    }
    const location = locationActiveRef.current
      ? userLocationRef.current
      : null;
    if (
      !location ||
      location.accuracy === null ||
      !Number.isFinite(location.accuracy) ||
      location.accuracy <= 0
    ) {
      source.setData(emptyAccuracyCollection());
      return;
    }
    source.setData(
      buildAccuracyCircle(location.lng, location.lat, location.accuracy),
    );
  }, []);

  const syncGeoJsonSources = useCallback(
    (map: MapLibreMap) => {
      const networkSource = map.getSource(NETWORK_SOURCE_ID) as
        | MapLibreGeoJSONSource
        | undefined;
      const stationsSource = map.getSource(STATIONS_SOURCE_ID) as
        | MapLibreGeoJSONSource
        | undefined;
      networkSource?.setData(networkDataRef.current ?? EMPTY_COLLECTION);
      stationsSource?.setData(stationsDataRef.current ?? EMPTY_COLLECTION);
      syncAccuracySource(map);
    },
    [syncAccuracySource],
  );

  const ensureLayerHandlers = useCallback((): LayerHandlers => {
    if (layerHandlersRef.current) {
      return layerHandlersRef.current;
    }

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
      const mapInstance = mapRef.current;
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
      const mapInstance = mapRef.current;
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

    layerHandlersRef.current = {
      handleStationClick,
      handleNetworkClick,
      handleStationEnter: () => {
        mapRef.current?.getCanvas().style.setProperty("cursor", "pointer");
      },
      handleStationLeave: () => {
        mapRef.current?.getCanvas().style.removeProperty("cursor");
      },
      handleNetworkEnter: () => {
        mapRef.current?.getCanvas().style.setProperty("cursor", "pointer");
      },
      handleNetworkLeave: () => {
        mapRef.current?.getCanvas().style.removeProperty("cursor");
      },
    };

    return layerHandlersRef.current;
  }, [closeActivePopup]);

  const ensureSubwayLayerListeners = useCallback(
    (map: MapLibreMap) => {
      if (!map.getLayer(STATIONS_LAYER_ID) || !map.getLayer(NETWORK_LAYER_ID)) {
        return;
      }

      const handlers = ensureLayerHandlers();

      // off + on con referencias estables evita duplicados tras setStyle.
      map.off("click", STATIONS_LAYER_ID, handlers.handleStationClick);
      map.off("click", NETWORK_LAYER_ID, handlers.handleNetworkClick);
      map.off("mouseenter", STATIONS_LAYER_ID, handlers.handleStationEnter);
      map.off("mouseleave", STATIONS_LAYER_ID, handlers.handleStationLeave);
      map.off("mouseenter", NETWORK_LAYER_ID, handlers.handleNetworkEnter);
      map.off("mouseleave", NETWORK_LAYER_ID, handlers.handleNetworkLeave);

      map.on("click", STATIONS_LAYER_ID, handlers.handleStationClick);
      map.on("click", NETWORK_LAYER_ID, handlers.handleNetworkClick);
      map.on("mouseenter", STATIONS_LAYER_ID, handlers.handleStationEnter);
      map.on("mouseleave", STATIONS_LAYER_ID, handlers.handleStationLeave);
      map.on("mouseenter", NETWORK_LAYER_ID, handlers.handleNetworkEnter);
      map.on("mouseleave", NETWORK_LAYER_ID, handlers.handleNetworkLeave);

      listenersAttachedRef.current = true;
    },
    [ensureLayerHandlers],
  );

  const ensureSubwaySourcesAndLayers = useCallback(
    (map: MapLibreMap) => {
      if (!map.getSource(NETWORK_SOURCE_ID)) {
        map.addSource(NETWORK_SOURCE_ID, {
          type: "geojson",
          data: EMPTY_COLLECTION,
        });
      }
      if (!map.getSource(STATIONS_SOURCE_ID)) {
        map.addSource(STATIONS_SOURCE_ID, {
          type: "geojson",
          data: EMPTY_COLLECTION,
        });
      }
      if (!map.getSource(USER_ACCURACY_SOURCE_ID)) {
        map.addSource(USER_ACCURACY_SOURCE_ID, {
          type: "geojson",
          data: emptyAccuracyCollection(),
        });
      }

      const beforeId = findBasemapSymbolBeforeId(map);

      addOwnedLayer(
        map,
        {
          id: NETWORK_CASING_LAYER_ID,
          type: "line",
          source: NETWORK_SOURCE_ID,
          layout: {
            "line-join": "round",
            "line-cap": "round",
          },
          paint: {
            "line-color": "rgba(255, 255, 255, 0.92)",
            "line-width": 7,
            "line-opacity": 0.95,
          },
        },
        beforeId,
      );

      addOwnedLayer(
        map,
        {
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
            "line-opacity": 0.96,
          },
        },
        beforeId,
      );

      addOwnedLayer(
        map,
        {
          id: STATIONS_LAYER_ID,
          type: "circle",
          source: STATIONS_SOURCE_ID,
          paint: {
            "circle-radius": 5,
            "circle-color": "#ffffff",
            "circle-stroke-width": 2.5,
            "circle-stroke-color": lineColorExpression,
          },
        },
        beforeId,
      );

      addOwnedLayer(
        map,
        {
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
        },
        beforeId,
      );

      addOwnedLayer(
        map,
        {
          id: USER_ACCURACY_LAYER_ID,
          type: "fill",
          source: USER_ACCURACY_SOURCE_ID,
          paint: {
            "fill-color": "rgba(14, 165, 233, 0.12)",
            "fill-opacity": 1,
          },
        },
        beforeId,
      );

      addOwnedLayer(
        map,
        {
          id: USER_ACCURACY_OUTLINE_LAYER_ID,
          type: "line",
          source: USER_ACCURACY_SOURCE_ID,
          paint: {
            "line-color": "rgba(11, 58, 102, 0.35)",
            "line-width": 1.25,
          },
        },
        beforeId,
      );

      applyThemePaint(map, themeRef.current);
      syncGeoJsonSources(map);
      applySelectionFilters(map);
      ensureSubwayLayerListeners(map);
    },
    [
      applySelectionFilters,
      applyThemePaint,
      ensureSubwayLayerListeners,
      syncGeoJsonSources,
    ],
  );

  const clearUserLocation = useCallback(() => {
    locationRequestIdRef.current += 1;
    locationActiveRef.current = false;
    setLocationActive(false);
    setLocationState("idle");
    setUserLocation(null);
    userLocationRef.current = null;

    try {
      userMarkerRef.current?.remove();
    } catch {
      // Marker ya removido.
    }
    userMarkerRef.current = null;

    try {
      userPopupRef.current?.remove();
    } catch {
      // Popup ya removido.
    }
    userPopupRef.current = null;

    const map = mapRef.current;
    if (map) {
      const source = map.getSource(USER_ACCURACY_SOURCE_ID) as
        | MapLibreGeoJSONSource
        | undefined;
      source?.setData(emptyAccuracyCollection());
    }
  }, []);

  clearUserLocationRef.current = clearUserLocation;

  const upsertUserMarker = useCallback(
    (location: UserLocationState, animate = false) => {
      const map = mapRef.current;
      const maplibre = getMapLibre();
      if (!map || !maplibre || !locationActiveRef.current) {
        return;
      }

      const popupContent = buildUserLocationPopupContent({
        accuracy: location.accuracy,
        onClear: () => clearUserLocationRef.current(),
      });

      if (userMarkerRef.current) {
        userMarkerRef.current.setLngLat([location.lng, location.lat]);
        const existingPopup = userMarkerRef.current.getPopup();
        if (existingPopup) {
          existingPopup.setDOMContent(popupContent);
        }
        const element = userMarkerRef.current.getElement();
        if (animate) {
          element.classList.add("is-locating-pulse");
          window.setTimeout(() => {
            element.classList.remove("is-locating-pulse");
          }, 1600);
        }
        return;
      }

      const element = createUserMarkerElement(animate);
      const popup = new maplibre.Popup({
        closeButton: true,
        closeOnClick: true,
        className: "subte-maplibre-popup",
        maxWidth: "260px",
        offset: 18,
      }).setDOMContent(popupContent);

      userPopupRef.current = popup;

      const marker = new maplibre.Marker({
        element,
        anchor: "center",
        offset: [0, 0],
      })
        .setLngLat([location.lng, location.lat])
        .setPopup(popup)
        .addTo(map);

      userMarkerRef.current = marker;
    },
    [],
  );

  const restoreOwnedMapContent = useCallback(
    (map: MapLibreMap, requestId: number) => {
      if (requestId !== styleRequestIdRef.current) {
        return;
      }

      const run = () => {
        if (requestId !== styleRequestIdRef.current || !mapRef.current) {
          return;
        }
        try {
          if (typeof map.isStyleLoaded === "function" && !map.isStyleLoaded()) {
            map.once("idle", run);
            return;
          }
          listenersAttachedRef.current = false;
          ensureSubwaySourcesAndLayers(map);
          if (locationActiveRef.current && userLocationRef.current) {
            upsertUserMarker(userLocationRef.current, false);
          }
        } catch {
          if (requestId === styleRequestIdRef.current) {
            map.once("idle", run);
          }
        }
      };

      run();
    },
    [ensureSubwaySourcesAndLayers, upsertUserMarker],
  );

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
          style: getBasemapStyleForTheme(themeRef.current),
          center: [-58.42, -34.61],
          zoom: 11.4,
          attributionControl: true,
        });
        mapRef.current = mapInstance;

        const handleLoad = () => {
          if (!mapInstance) {
            return;
          }
          ensureSubwaySourcesAndLayers(mapInstance);
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
      listenersAttachedRef.current = false;
      layerHandlersRef.current = null;
      styleRequestIdRef.current += 1;
      locationRequestIdRef.current += 1;
      popupRef.current?.remove();
      popupRef.current = null;
      clearUserLocationRef.current();
      if (toastTimerRef.current !== null) {
        window.clearTimeout(toastTimerRef.current);
      }
      if (mapInstance) {
        mapInstance.remove();
      }
      mapRef.current = null;
    };
  }, [ensureSubwaySourcesAndLayers]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !mapReady) {
      return;
    }
    if (basemapThemeRef.current === theme) {
      applyThemePaint(map, theme);
      return;
    }

    basemapThemeRef.current = theme;
    const requestId = ++styleRequestIdRef.current;
    let cancelled = false;

    const onStyleLoad = () => {
      if (cancelled) {
        return;
      }
      restoreOwnedMapContent(map, requestId);
    };

    // diff:false fuerza recarga completa y garantiza style.load en MapLibre 4.
    map.once("style.load", onStyleLoad);
    map.setStyle(getBasemapStyleForTheme(theme), { diff: false });

    return () => {
      cancelled = true;
      map.off("style.load", onStyleLoad);
    };
  }, [
    theme,
    mapReady,
    applyThemePaint,
    restoreOwnedMapContent,
  ]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !mapReady) {
      return;
    }
    syncGeoJsonSources(map);
    applySelectionFilters(map);
  }, [
    mapReady,
    network,
    stations,
    selectedLine,
    selectedStationId,
    syncGeoJsonSources,
    applySelectionFilters,
  ]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !mapReady || !map.getLayer(STATIONS_SELECTED_LAYER_ID)) {
      return;
    }

    applySelectionFilters(map);

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
  }, [mapReady, selectedLine, selectedStationId, stations, applySelectionFilters]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !mapReady) {
      return;
    }
    if (initialFitDoneRef.current) {
      return;
    }
    if (!network && !stations) {
      return;
    }
    initialFitDoneRef.current = true;
    fitToFeatures(map, [network, stations], selectedLine);
  }, [mapReady, network, stations, selectedLine]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !mapReady || !initialFitDoneRef.current) {
      return;
    }
    fitToFeatures(map, [network, stations], selectedLine);
  }, [selectedLine, mapReady, network, stations]);

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
  }, [mapReady, layoutRevision, panelState]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !mapReady) {
      return;
    }
    syncAccuracySource(map);
    if (locationActive && userLocation) {
      upsertUserMarker(userLocation, false);
    }
  }, [
    userLocation,
    locationActive,
    mapReady,
    syncAccuracySource,
    upsertUserMarker,
  ]);

  const handleLocateClick = () => {
    if (locationState === "locating") {
      return;
    }

    if (locationActive) {
      clearUserLocation();
      return;
    }

    if (typeof window === "undefined" || !window.isSecureContext) {
      setLocationState("insecure");
      showLocationToast(LOCATION_MESSAGES.insecure);
      return;
    }

    if (!navigator.geolocation) {
      setLocationState("unsupported");
      showLocationToast(LOCATION_MESSAGES.unsupported);
      return;
    }

    const requestId = ++locationRequestIdRef.current;
    setLocationState("locating");

    navigator.geolocation.getCurrentPosition(
      (position) => {
        if (requestId !== locationRequestIdRef.current) {
          return;
        }

        const next: UserLocationState = {
          lng: position.coords.longitude,
          lat: position.coords.latitude,
          accuracy:
            typeof position.coords.accuracy === "number" &&
            Number.isFinite(position.coords.accuracy)
              ? position.coords.accuracy
              : null,
        };

        locationActiveRef.current = true;
        setLocationActive(true);
        setUserLocation(next);
        setLocationState("found");

        const map = mapRef.current;
        if (map) {
          map.easeTo({
            center: [next.lng, next.lat],
            zoom: 16,
            duration: 700,
          });
          upsertUserMarker(next, true);
          syncAccuracySource(map);
        }
      },
      (error) => {
        if (requestId !== locationRequestIdRef.current) {
          return;
        }
        let nextState: LocationUiState = "unavailable";
        if (error.code === error.PERMISSION_DENIED) {
          nextState = "denied";
        } else if (error.code === error.TIMEOUT) {
          nextState = "timeout";
        } else if (error.code === error.POSITION_UNAVAILABLE) {
          nextState = "unavailable";
        }
        setLocationState(nextState);
        setLocationActive(false);
        locationActiveRef.current = false;
        showLocationToast(LOCATION_MESSAGES[nextState]);
      },
      GEOLOCATION_OPTIONS,
    );
  };

  const shellClassName = [
    "subte-map-shell",
    isDesktopSplit ? "is-split" : "is-overlay",
    `panel-${panelState}`,
  ].join(" ");

  const locateLabel = locationActive
    ? "Quitar mi ubicación"
    : "Mostrar mi ubicación";

  return (
    <div className={shellClassName}>
      <div ref={containerRef} className="subte-map-view" />
      <button
        type="button"
        className={`subte-locate-btn ${locationState === "locating" ? "is-busy" : ""} ${locationActive ? "is-active" : ""}`}
        onClick={handleLocateClick}
        disabled={locationState === "locating"}
        aria-label={locateLabel}
        title={locateLabel}
        aria-pressed={locationActive}
        aria-busy={locationState === "locating"}
      >
        <LocateIcon
          className={locationState === "locating" ? "is-spinning" : undefined}
        />
      </button>
      {locationMessage ? (
        <div className="subte-map-toast" role="status">
          {locationMessage}
        </div>
      ) : null}
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
