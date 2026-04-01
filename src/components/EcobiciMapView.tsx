import { useEffect, useRef, useState } from "react";
import type { EcobiciStationMerged } from "../types/ecobici";

interface EcobiciMapViewProps {
  stations: EcobiciStationMerged[];
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
  Marker: new (options?: { color?: string }) => MapLibreMarker;
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

const formatNumber = (value?: number): string => {
  if (value === undefined || value === null || !Number.isFinite(value)) {
    return "-";
  }
  return String(value);
};

const formatBoolean = (value?: boolean): string => {
  if (value === undefined || value === null) {
    return "-";
  }
  return value ? "Si" : "No";
};

const formatUnixDateTime = (value?: number): string => {
  if (value === undefined || value === null || !Number.isFinite(value)) {
    return "-";
  }
  return new Date(value * 1000).toLocaleString("es-AR");
};

const getMarkerColor = (station: EcobiciStationMerged): string => {
  if (station.status && station.status !== "IN_SERVICE") {
    return "#6b7280";
  }
  const bikes = station.num_bikes_available ?? 0;
  if (bikes <= 0) {
    return "#dc2626";
  }
  if (bikes <= 5) {
    return "#d97706";
  }
  return "#16a34a";
};

const toPopupContent = (station: EcobiciStationMerged): string => {
  const rows: Array<[string, string]> = [
    ["station_id", station.station_id],
    ["name", station.name ?? "-"],
    ["address", station.address ?? "-"],
    ["groups", station.groups.length > 0 ? station.groups.join(", ") : "-"],
    ["capacity", formatNumber(station.capacity)],
    ["status", station.status ?? "Sin estado"],
    ["num_bikes_available", formatNumber(station.num_bikes_available)],
    ["num_docks_available", formatNumber(station.num_docks_available)],
    ["num_bikes_disabled", formatNumber(station.num_bikes_disabled)],
    ["num_docks_disabled", formatNumber(station.num_docks_disabled)],
    ["mechanical", formatNumber(station.mechanical)],
    ["ebike", formatNumber(station.ebike)],
    ["is_installed", formatNumber(station.is_installed)],
    ["is_renting", formatNumber(station.is_renting)],
    ["is_returning", formatNumber(station.is_returning)],
    ["last_reported", formatUnixDateTime(station.last_reported)],
    ["is_charging_station", formatBoolean(station.is_charging_station)],
  ];

  return rows
    .map(
      ([label, value]) =>
        `<div><strong>${escapeHtml(label)}:</strong> ${escapeHtml(value)}</div>`,
    )
    .join("");
};

function EcobiciMapView({ stations }: EcobiciMapViewProps) {
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

    if (stations.length === 0) {
      fittedRef.current = false;
      markersRef.current.forEach((marker) => marker.remove());
      markersRef.current.clear();
      return;
    }

    const nextIds = new Set<string>();

    for (const station of stations) {
      nextIds.add(station.station_id);
      const lngLat: [number, number] = [station.lon, station.lat];
      const popup = new mapLibre.Popup({ closeButton: true }).setHTML(
        toPopupContent(station),
      );

      const existingMarker = markersRef.current.get(station.station_id);
      if (existingMarker) {
        existingMarker.remove();
      }

      const marker = new mapLibre.Marker({ color: getMarkerColor(station) })
        .setLngLat(lngLat)
        .setPopup(popup)
        .addTo(map);

      markersRef.current.set(station.station_id, marker);
    }

    markersRef.current.forEach((marker, stationId) => {
      if (!nextIds.has(stationId)) {
        marker.remove();
        markersRef.current.delete(stationId);
      }
    });

    if (!fittedRef.current) {
      let minLat = stations[0].lat;
      let minLon = stations[0].lon;
      let maxLat = stations[0].lat;
      let maxLon = stations[0].lon;

      for (const station of stations) {
        minLat = Math.min(minLat, station.lat);
        minLon = Math.min(minLon, station.lon);
        maxLat = Math.max(maxLat, station.lat);
        maxLon = Math.max(maxLon, station.lon);
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
  }, [mapReady, stations]);

  return <div ref={containerRef} className="map-view ecobici-map-view" />;
}

export default EcobiciMapView;
