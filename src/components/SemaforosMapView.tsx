import { useEffect, useRef, useState } from "react";
import trafficLightIcon from "../assets/traffic_light.svg";
import { MAP_BASEMAP_STYLE } from "../constants/mapBasemap";
import type { SemaforoMapItem } from "../types/semaforos";

interface SemaforosMapViewProps {
  semaforos: SemaforoMapItem[];
}

type SemaforoPointFeature = {
  type: "Feature";
  geometry: {
    type: "Point";
    coordinates: [number, number];
  };
  properties: {
    code: string;
    name: string;
    status: string;
    provider: string;
    type: string;
    popup_html: string;
    marker_color: string;
  };
};

type SemaforosFeatureCollection = {
  type: "FeatureCollection";
  features: SemaforoPointFeature[];
};

interface SemaforosMapLibrePopup {
  setHTML: (html: string) => SemaforosMapLibrePopup;
  setLngLat: (lngLat: [number, number]) => SemaforosMapLibrePopup;
  addTo: (map: SemaforosMapLibreMap) => SemaforosMapLibrePopup;
}

interface SemaforosMapLibreGeoJSONSource {
  setData: (data: SemaforosFeatureCollection) => void;
  getClusterExpansionZoom: (
    clusterId: number,
    callback: (error: Error | null, zoom: number) => void,
  ) => void;
}

interface SemaforosMapLibreMapMouseEvent {
  features?: Array<{
    geometry?: { coordinates?: unknown };
    properties?: Record<string, unknown>;
  }>;
}

interface SemaforosMapLibreMap {
  fitBounds: (
    bounds: [[number, number], [number, number]],
    options?: { padding?: number; duration?: number },
  ) => void;
  easeTo: (options: {
    center: [number, number];
    zoom: number;
    duration?: number;
  }) => void;
  addSource: (
    id: string,
    source: {
      type: "geojson";
      data: SemaforosFeatureCollection;
      cluster?: boolean;
      clusterRadius?: number;
      clusterMaxZoom?: number;
    },
  ) => void;
  getSource: (id: string) => unknown;
  addLayer: (layer: {
    id: string;
    type: "circle" | "symbol";
    source: string;
    filter?: unknown[];
    paint?: Record<string, unknown>;
    layout?: Record<string, unknown>;
  }) => void;
  getLayer: (id: string) => unknown;
  on: {
    (event: "load", handler: () => void): void;
    (
      event: "click",
      layerId: string,
      handler: (ev: SemaforosMapLibreMapMouseEvent) => void,
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
      handler: (ev: SemaforosMapLibreMapMouseEvent) => void,
    ): void;
    (
      event: "mouseenter" | "mouseleave",
      layerId: string,
      handler: () => void,
    ): void;
  };
  getCanvas: () => HTMLCanvasElement;
  remove: () => void;
  hasImage: (id: string) => boolean;
  addImage: (
    id: string,
    image: HTMLImageElement | ImageData,
    options?: { sdf?: boolean },
  ) => void;
}

interface SemaforosMapLibreApi {
  Map: new (options: {
    container: HTMLElement;
    style: string | Record<string, unknown>;
    center: [number, number];
    zoom: number;
  }) => SemaforosMapLibreMap;
  Popup: new (options?: {
    closeButton?: boolean;
    closeOnClick?: boolean;
  }) => SemaforosMapLibrePopup;
}

const MAPLIBRE_SCRIPT_ID = "maplibre-js-cdn";
const MAPLIBRE_CSS_ID = "maplibre-css-cdn";
const MAPLIBRE_SCRIPT_URL =
  "https://unpkg.com/maplibre-gl@4.7.1/dist/maplibre-gl.js";
const MAPLIBRE_CSS_URL =
  "https://unpkg.com/maplibre-gl@4.7.1/dist/maplibre-gl.css";
const SEMAFOROS_SOURCE_ID = "semaforos";
const SEMAFOROS_CLUSTERS_LAYER_ID = "semaforos-clusters";
const SEMAFOROS_CLUSTER_COUNT_LAYER_ID = "semaforos-cluster-count";
const SEMAFOROS_UNCLUSTERED_CIRCLE_LAYER_ID = "semaforos-unclustered-circle";
const SEMAFOROS_UNCLUSTERED_ICON_LAYER_ID = "semaforos-unclustered-icon";
const SEMAFOROS_CLUSTER_RADIUS = 50;
const SEMAFOROS_CLUSTER_MAX_ZOOM = 14;
const SEMAFOROS_MARKER_ICON_ID = "semaforo-marker";
const FALLBACK_STATUS_COLOR = "#6b7280";

let mapLibreLoadPromise: Promise<void> | null = null;

const getMapLibre = (): SemaforosMapLibreApi | undefined => {
  return (window as Window & { maplibregl?: SemaforosMapLibreApi }).maplibregl;
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

const escapeHtml = (value: string): string => {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
};

const formatText = (value?: string): string => {
  return value && value.trim().length > 0 ? value : "-";
};

const formatCoordinate = (value: number): string => {
  return value.toFixed(6);
};

const normalizeStatus = (value?: string): string => {
  return (value ?? "")
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
};

const getStatusColor = (status?: string): string => {
  const normalizedStatus = normalizeStatus(status);
  if (!normalizedStatus) {
    return FALLBACK_STATUS_COLOR;
  }
  if (normalizedStatus.includes("desconect")) {
    return "#dc2626";
  }
  if (normalizedStatus.includes("conect")) {
    return "#16a34a";
  }
  if (
    normalizedStatus.includes("manten") ||
    normalizedStatus.includes("alert") ||
    normalizedStatus.includes("pend") ||
    normalizedStatus.includes("intermit") ||
    normalizedStatus.includes("precau")
  ) {
    return "#d97706";
  }
  return "#eab308";
};

const toPopupContent = (semaforo: SemaforoMapItem): string => {
  const rows: Array<[string, string]> = [
    ["name", formatText(semaforo.name)],
    ["code", formatText(semaforo.code)],
    ["status", formatText(semaforo.status)],
    ["type", formatText(semaforo.type)],
    ["provider", formatText(semaforo.provider)],
    ["latitude", formatCoordinate(semaforo.latitude)],
    ["longitude", formatCoordinate(semaforo.longitude)],
  ];

  return rows
    .map(
      ([label, value]) =>
        `<div><strong>${escapeHtml(label)}:</strong> ${escapeHtml(value)}</div>`,
    )
    .join("");
};

const toSemaforosGeoJson = (
  semaforos: SemaforoMapItem[],
): SemaforosFeatureCollection => {
  const features: SemaforoPointFeature[] = [];

  for (const semaforo of semaforos) {
    if (
      !Number.isFinite(semaforo.latitude) ||
      !Number.isFinite(semaforo.longitude)
    ) {
      continue;
    }

    features.push({
      type: "Feature",
      geometry: {
        type: "Point",
        coordinates: [semaforo.longitude, semaforo.latitude],
      },
      properties: {
        code: formatText(semaforo.code),
        name: formatText(semaforo.name),
        status: formatText(semaforo.status),
        provider: formatText(semaforo.provider),
        type: formatText(semaforo.type),
        popup_html: toPopupContent(semaforo),
        marker_color: getStatusColor(semaforo.status),
      },
    });
  }

  return {
    type: "FeatureCollection",
    features,
  };
};

const loadSvgAsMapImage = async (
  map: SemaforosMapLibreMap,
  id: string,
  svgUrl: string,
  size = 40,
): Promise<void> => {
  if (map.hasImage(id)) {
    return;
  }

  const response = await fetch(svgUrl);
  if (!response.ok) {
    throw new Error(`No se pudo cargar el SVG: ${svgUrl}`);
  }

  const svgText = await response.text();
  const blob = new Blob([svgText], { type: "image/svg+xml;charset=utf-8" });
  const blobUrl = URL.createObjectURL(blob);

  try {
    const img = new Image();
    img.width = size;
    img.height = size;

    await new Promise<void>((resolve, reject) => {
      img.onload = () => resolve();
      img.onerror = () =>
        reject(new Error("No se pudo decodificar el SVG en Image()"));
      img.src = blobUrl;
    });

    const canvas = document.createElement("canvas");
    canvas.width = size;
    canvas.height = size;

    const ctx = canvas.getContext("2d");
    if (!ctx) {
      throw new Error("No se pudo obtener contexto 2D del canvas");
    }

    ctx.drawImage(img, 0, 0, size, size);
    const imageData = ctx.getImageData(0, 0, size, size);
    map.addImage(id, imageData, { sdf: true });
  } finally {
    URL.revokeObjectURL(blobUrl);
  }
};

const addSemaforosSourceAndLayers = (map: SemaforosMapLibreMap): void => {
  if (!map.getSource(SEMAFOROS_SOURCE_ID)) {
    map.addSource(SEMAFOROS_SOURCE_ID, {
      type: "geojson",
      data: {
        type: "FeatureCollection",
        features: [],
      },
      cluster: true,
      clusterRadius: SEMAFOROS_CLUSTER_RADIUS,
      clusterMaxZoom: SEMAFOROS_CLUSTER_MAX_ZOOM,
    });
  }

  if (!map.getLayer(SEMAFOROS_CLUSTERS_LAYER_ID)) {
    map.addLayer({
      id: SEMAFOROS_CLUSTERS_LAYER_ID,
      type: "circle",
      source: SEMAFOROS_SOURCE_ID,
      filter: ["has", "point_count"],
      paint: {
        "circle-color": "#1d4ed8",
        "circle-radius": ["step", ["get", "point_count"], 18, 25, 22, 100, 26],
        "circle-stroke-color": "#ffffff",
        "circle-stroke-width": 2,
      },
    });
  }

  if (!map.getLayer(SEMAFOROS_CLUSTER_COUNT_LAYER_ID)) {
    map.addLayer({
      id: SEMAFOROS_CLUSTER_COUNT_LAYER_ID,
      type: "symbol",
      source: SEMAFOROS_SOURCE_ID,
      filter: ["has", "point_count"],
      layout: {
        "text-field": ["get", "point_count_abbreviated"],
        "text-size": 12,
        "text-font": ["Noto Sans Bold"],
      },
      paint: {
        "text-color": "#ffffff",
      },
    });
  }

  if (!map.getLayer(SEMAFOROS_UNCLUSTERED_CIRCLE_LAYER_ID)) {
    map.addLayer({
      id: SEMAFOROS_UNCLUSTERED_CIRCLE_LAYER_ID,
      type: "circle",
      source: SEMAFOROS_SOURCE_ID,
      filter: ["!", ["has", "point_count"]],
      paint: {
        "circle-color": ["coalesce", ["get", "marker_color"], FALLBACK_STATUS_COLOR],
        "circle-radius": 13,
        "circle-stroke-color": "#ffffff",
        "circle-stroke-width": 2,
      },
    });
  }

  if (!map.getLayer(SEMAFOROS_UNCLUSTERED_ICON_LAYER_ID)) {
    map.addLayer({
      id: SEMAFOROS_UNCLUSTERED_ICON_LAYER_ID,
      type: "symbol",
      source: SEMAFOROS_SOURCE_ID,
      filter: ["!", ["has", "point_count"]],
      layout: {
        "icon-image": SEMAFOROS_MARKER_ICON_ID,
        "icon-size": 0.55,
        "icon-allow-overlap": true,
      },
      paint: {
        "icon-color": "#ffffff",
      },
    });
  }
};

const ensureSemaforosIconAndLayers = async (
  map: SemaforosMapLibreMap,
): Promise<void> => {
  if (!map.hasImage(SEMAFOROS_MARKER_ICON_ID)) {
    await loadSvgAsMapImage(map, SEMAFOROS_MARKER_ICON_ID, trafficLightIcon);
  }
  addSemaforosSourceAndLayers(map);
};

const getFeatureCoordinates = (
  event: SemaforosMapLibreMapMouseEvent,
): [number, number] | null => {
  const coordinates = event.features?.[0]?.geometry?.coordinates;
  if (
    !Array.isArray(coordinates) ||
    coordinates.length < 2 ||
    typeof coordinates[0] !== "number" ||
    typeof coordinates[1] !== "number"
  ) {
    return null;
  }
  return [coordinates[0], coordinates[1]];
};

const getNumberProperty = (
  properties: Record<string, unknown>,
  key: string,
): number | null => {
  const value = properties[key];
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }
  if (typeof value === "string") {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
};

function SemaforosMapView({ semaforos }: SemaforosMapViewProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<SemaforosMapLibreMap | null>(null);
  const fittedRef = useRef(false);
  const mapLoadedRef = useRef(false);
  const [mapReady, setMapReady] = useState(false);

  useEffect(() => {
    let active = true;

    const init = async () => {
      if (!containerRef.current || mapRef.current) {
        return;
      }

      await loadMapLibreAssets();
      const mapLibre = getMapLibre();
      if (!active || !containerRef.current || !mapLibre) {
        return;
      }

      const createdMap = new mapLibre.Map({
        container: containerRef.current,
          style: MAP_BASEMAP_STYLE,
        center: [-58.3816, -34.6037],
        zoom: 11,
      });

      mapRef.current = createdMap;
      const onLoad = async () => {
        if (!active) {
          return;
        }
        try {
          await ensureSemaforosIconAndLayers(createdMap);
          mapLoadedRef.current = true;
          setMapReady(true);
        } catch {
          mapLoadedRef.current = false;
          setMapReady(false);
        }
      };

      createdMap.on("load", onLoad);
    };

    void init();

    return () => {
      active = false;
      mapRef.current?.remove();
      mapRef.current = null;
      mapLoadedRef.current = false;
      setMapReady(false);
    };
  }, []);

  useEffect(() => {
    const map = mapRef.current;
    if (!mapReady || !map || !mapLoadedRef.current) {
      return;
    }

    void ensureSemaforosIconAndLayers(map);
    const source = map.getSource(SEMAFOROS_SOURCE_ID) as
      | SemaforosMapLibreGeoJSONSource
      | undefined;
    if (!source) {
      return;
    }

    source.setData(toSemaforosGeoJson(semaforos));

    if (semaforos.length === 0) {
      fittedRef.current = false;
      return;
    }

    if (!fittedRef.current) {
      let minLat = semaforos[0].latitude;
      let minLon = semaforos[0].longitude;
      let maxLat = semaforos[0].latitude;
      let maxLon = semaforos[0].longitude;

      for (const semaforo of semaforos) {
        minLat = Math.min(minLat, semaforo.latitude);
        minLon = Math.min(minLon, semaforo.longitude);
        maxLat = Math.max(maxLat, semaforo.latitude);
        maxLon = Math.max(maxLon, semaforo.longitude);
      }

      map.fitBounds(
        [
          [minLon, minLat],
          [maxLon, maxLat],
        ],
        { padding: 40, duration: 800 },
      );
      fittedRef.current = true;
    }
  }, [mapReady, semaforos]);

  useEffect(() => {
    const map = mapRef.current;
    const mapLibre = getMapLibre();
    if (!mapReady || !map || !mapLibre) {
      return;
    }

    const onClusterClick = (event: SemaforosMapLibreMapMouseEvent) => {
      const coordinates = getFeatureCoordinates(event);
      const properties = event.features?.[0]?.properties ?? {};
      const clusterId = getNumberProperty(properties, "cluster_id");

      if (!coordinates || clusterId === null) {
        return;
      }

      const source = map.getSource(SEMAFOROS_SOURCE_ID) as
        | SemaforosMapLibreGeoJSONSource
        | undefined;
      if (!source) {
        return;
      }

      source.getClusterExpansionZoom(clusterId, (error, zoom) => {
        if (error) {
          return;
        }
        map.easeTo({
          center: coordinates,
          zoom,
          duration: 500,
        });
      });
    };

    const onUnclusteredPointClick = (event: SemaforosMapLibreMapMouseEvent) => {
      const coordinates = getFeatureCoordinates(event);
      const popupHtml = event.features?.[0]?.properties?.popup_html;
      if (!coordinates || typeof popupHtml !== "string") {
        return;
      }

      new mapLibre.Popup({ closeButton: true })
        .setLngLat(coordinates)
        .setHTML(popupHtml)
        .addTo(map);
    };

    const onMouseEnter = () => {
      map.getCanvas().style.cursor = "pointer";
    };
    const onMouseLeave = () => {
      map.getCanvas().style.cursor = "";
    };

    map.on("click", SEMAFOROS_CLUSTERS_LAYER_ID, onClusterClick);
    map.on(
      "click",
      SEMAFOROS_UNCLUSTERED_CIRCLE_LAYER_ID,
      onUnclusteredPointClick,
    );
    map.on(
      "click",
      SEMAFOROS_UNCLUSTERED_ICON_LAYER_ID,
      onUnclusteredPointClick,
    );
    map.on("mouseenter", SEMAFOROS_CLUSTERS_LAYER_ID, onMouseEnter);
    map.on("mouseleave", SEMAFOROS_CLUSTERS_LAYER_ID, onMouseLeave);
    map.on("mouseenter", SEMAFOROS_UNCLUSTERED_CIRCLE_LAYER_ID, onMouseEnter);
    map.on("mouseleave", SEMAFOROS_UNCLUSTERED_CIRCLE_LAYER_ID, onMouseLeave);
    map.on("mouseenter", SEMAFOROS_UNCLUSTERED_ICON_LAYER_ID, onMouseEnter);
    map.on("mouseleave", SEMAFOROS_UNCLUSTERED_ICON_LAYER_ID, onMouseLeave);

    return () => {
      map.off("click", SEMAFOROS_CLUSTERS_LAYER_ID, onClusterClick);
      map.off(
        "click",
        SEMAFOROS_UNCLUSTERED_CIRCLE_LAYER_ID,
        onUnclusteredPointClick,
      );
      map.off(
        "click",
        SEMAFOROS_UNCLUSTERED_ICON_LAYER_ID,
        onUnclusteredPointClick,
      );
      map.off("mouseenter", SEMAFOROS_CLUSTERS_LAYER_ID, onMouseEnter);
      map.off("mouseleave", SEMAFOROS_CLUSTERS_LAYER_ID, onMouseLeave);
      map.off("mouseenter", SEMAFOROS_UNCLUSTERED_CIRCLE_LAYER_ID, onMouseEnter);
      map.off("mouseleave", SEMAFOROS_UNCLUSTERED_CIRCLE_LAYER_ID, onMouseLeave);
      map.off("mouseenter", SEMAFOROS_UNCLUSTERED_ICON_LAYER_ID, onMouseEnter);
      map.off("mouseleave", SEMAFOROS_UNCLUSTERED_ICON_LAYER_ID, onMouseLeave);
    };
  }, [mapReady]);

  return <div ref={containerRef} className="map-view semaforos-map-view" />;
}

export default SemaforosMapView;
