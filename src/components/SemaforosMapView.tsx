import { useEffect, useRef, useState } from "react";
import type { SemaforoMapItem } from "../types/semaforos";

interface SemaforosMapViewProps {
  semaforos: SemaforoMapItem[];
}

interface MapLibreMarker {
  setLngLat: (lngLat: [number, number]) => MapLibreMarker;
  setPopup: (popup: MapLibrePopup) => MapLibreMarker;
  addTo: (map: MapLibreMap) => MapLibreMarker;
  remove: () => void;
}

interface MapLibrePopup {
  setHTML: (html: string) => MapLibrePopup;
}

interface MapLibreMap {
  fitBounds: (
    bounds: [[number, number], [number, number]],
    options?: { padding?: number; duration?: number },
  ) => void;
  remove: () => void;
}

interface MapLibreApi {
  Map: new (options: {
    container: HTMLElement;
    style: string | Record<string, unknown>;
    center: [number, number];
    zoom: number;
  }) => MapLibreMap;
  Marker: new (options?: {
    color?: string;
    element?: HTMLElement;
    anchor?: "center" | "bottom";
  }) => MapLibreMarker;
  Popup: new (options?: {
    closeButton?: boolean;
    closeOnClick?: boolean;
  }) => MapLibrePopup;
}

declare global {
  interface Window {
    maplibregl?: MapLibreApi;
  }
}

const MAP_STYLE_URL = {
  version: 8,
  sources: {
    osm: {
      type: "raster",
      tiles: ["https://tile.openstreetmap.org/{z}/{x}/{y}.png"],
      tileSize: 256,
      attribution: "© OpenStreetMap contributors",
    },
  },
  layers: [
    {
      id: "osm",
      type: "raster",
      source: "osm",
    },
  ],
};
const MAPLIBRE_SCRIPT_ID = "maplibre-js-cdn";
const MAPLIBRE_CSS_ID = "maplibre-css-cdn";
const MAPLIBRE_SCRIPT_URL =
  "https://unpkg.com/maplibre-gl@4.7.1/dist/maplibre-gl.js";
const MAPLIBRE_CSS_URL =
  "https://unpkg.com/maplibre-gl@4.7.1/dist/maplibre-gl.css";

let mapLibreLoadPromise: Promise<void> | null = null;

const loadMapLibreAssets = (): Promise<void> => {
  if (window.maplibregl) {
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
    if (existingScript && window.maplibregl) {
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

const markerKey = (semaforo: SemaforoMapItem, index: number): string => {
  const code = semaforo.code?.trim();
  const name = semaforo.name?.trim();
  return code || `${name ?? "semaforo"}-${index}`;
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

function SemaforosMapView({ semaforos }: SemaforosMapViewProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<MapLibreMap | null>(null);
  const markersRef = useRef<Map<string, MapLibreMarker>>(new Map());
  const fittedRef = useRef(false);
  const [mapReady, setMapReady] = useState(false);

  useEffect(() => {
    let active = true;

    const init = async () => {
      if (!containerRef.current || mapRef.current) {
        return;
      }

      await loadMapLibreAssets();
      if (!active || !containerRef.current || !window.maplibregl) {
        return;
      }

      mapRef.current = new window.maplibregl.Map({
        container: containerRef.current,
        style: MAP_STYLE_URL,
        center: [-58.3816, -34.6037],
        zoom: 11,
      });
      setMapReady(true);
    };

    void init();

    return () => {
      active = false;
      markersRef.current.forEach((marker) => marker.remove());
      markersRef.current.clear();
      mapRef.current?.remove();
      mapRef.current = null;
      setMapReady(false);
    };
  }, []);

  useEffect(() => {
    const map = mapRef.current;
    const mapLibre = window.maplibregl;
    if (!mapReady || !map || !mapLibre) {
      return;
    }

    if (semaforos.length === 0) {
      fittedRef.current = false;
    }

    const nextIds = new Set<string>();

    semaforos.forEach((semaforo, index) => {
      const id = markerKey(semaforo, index);
      nextIds.add(id);

      const lngLat: [number, number] = [semaforo.longitude, semaforo.latitude];
      const popup = new mapLibre.Popup({ closeButton: true }).setHTML(
        toPopupContent(semaforo),
      );
      const existingMarker = markersRef.current.get(id);

      if (existingMarker) {
        existingMarker.setLngLat(lngLat).setPopup(popup);
      } else {
        const marker = new mapLibre.Marker({ color: "#dc2626" })
          .setLngLat(lngLat)
          .setPopup(popup)
          .addTo(map);
        markersRef.current.set(id, marker);
      }
    });

    markersRef.current.forEach((marker, id) => {
      if (!nextIds.has(id)) {
        marker.remove();
        markersRef.current.delete(id);
      }
    });

    if (!fittedRef.current && semaforos.length > 0) {
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

  return <div ref={containerRef} className="map-view semaforos-map-view" />;
}

export default SemaforosMapView;
