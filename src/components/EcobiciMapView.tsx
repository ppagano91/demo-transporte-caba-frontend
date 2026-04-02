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

const getBikesCount = (station: EcobiciStationMerged): number => {
  const value = station.num_bikes_available;
  if (value === undefined || value === null || !Number.isFinite(value)) {
    return 0;
  }
  return Math.max(0, Math.trunc(value));
};

const createMarkerElement = (
  station: EcobiciStationMerged,
  color: string,
): HTMLElement => {
  const bikes = getBikesCount(station);
  const root = document.createElement("div");
  root.className = "ecobici-marker";

  const iconWrap = document.createElement("div");
  iconWrap.className = "ecobici-marker-icon";
  iconWrap.style.color = color;
  iconWrap.setAttribute("aria-hidden", "true");
  iconWrap.innerHTML = `
    <svg fill=${color} role="img" focusable="false" xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" 
	 viewBox="0 0 300.25 300.25" xml:space="preserve">
<path d="M238.703,127.946c-5.119,0-10.089,0.487-14.847,1.67l-18.955-50.955h6.176c9.72,0,18.913-3.577,25.887-10.345l6.541-6.273
	c2.973-2.885,3.043-7.595,0.158-10.568s-7.633-3.024-10.605-0.139l-6.541,6.206c-4.159,4.037-9.643,6.118-15.439,6.118h-16.979
	c-2.458,0-4.76,1.356-6.161,3.375c-1.401,2.02-1.725,4.673-0.865,6.975l7.214,19.372c-0.046-0.001-0.093,0.141-0.139,0.141
	c-0.016,0-0.032,0.137-0.049,0.137H98.126L85.165,71.823l14.078-4.895c3.467-1.191,5.564-4.55,4.961-8.166
	c-0.604-3.615-3.731-6.101-7.397-6.101H55.597c-5.775,0-10.475,4.506-10.475,10.281c0,8.941,7.266,16.12,16.196,16.12
	c1.79,0,3.565-0.347,5.277-0.934l4.103-1.433l13.146,21.996l-10.097,30.285c-3.312-0.669-6.714-1.09-10.193-1.201
	c-17.589-0.563-34.055,6.138-46.219,18.697c-11.694,12.074-17.84,27.992-17.303,44.822c1.032,32.337,27.172,58.476,59.509,59.508
	c0.673,0.021,1.34,0.032,2.008,0.032c16.811,0,32.513-6.716,44.212-18.794c9.464-9.773,15.291-22.38,16.885-35.38h12.051
	c2.598,2,5.961,3.634,9.639,3.634c8.196,0,14.864-6.636,14.864-14.833c0-2.661-0.712-5.139-1.942-7.303l42.042-71.305l10.553,28.289
	c-19.435,10.359-32.698,30.831-32.698,54.348c0,33.938,27.61,61.549,61.548,61.549s61.547-27.61,61.547-61.547
	S272.641,127.946,238.703,127.946z M180.979,108.661l-36.606,62.091c-0.013,0-0.025-0.062-0.037-0.062
	c-0.043,0-0.084,0.096-0.127,0.097l-37.131-62.125H180.979z M93.992,115.669l37.378,62.514c-0.618,1.101-1.089,2.478-1.412,3.478
	h-7.326c-2.591-21-16.064-39.121-34.658-48.001L93.992,115.669z M74.447,181.661c-0.503-1-1.081-1.526-1.728-2.233l8.865-26.626
	c10.72,5.925,18.562,16.859,20.834,28.859H74.447z M91.395,218.126c-8.215,8.481-19.311,13.04-31.215,12.655
	c-21.822-0.696-39.461-18.319-40.157-40.141c-0.363-11.369,3.784-22.112,11.679-30.262c7.898-8.154,18.497-12.642,29.845-12.642
	c0.455,0,0.91,0.01,1.369,0.024c1.502,0.048,2.981,0.185,4.439,0.389l-8.966,26.9c-6.569,1.537-11.481,7.43-11.481,14.461
	c0,8.196,6.668,14.801,14.863,14.801c5.552,0,10.395-2.65,12.947-7.65h27.699C100.966,204.661,97.197,212.135,91.395,218.126z
	 M238.703,231.042c-22.909,0-41.548-18.639-41.548-41.548c0-14.932,7.921-28.044,19.779-35.369l14.098,37.785
	c1.125,3.017,3.986,4.88,7.027,4.88c0.871,0,1.757-0.152,2.621-0.476c3.881-1.447,5.853-5.768,4.404-9.648l-14.169-37.977
	c2.524-0.481,5.125-0.743,7.788-0.743c22.909,0,41.547,18.639,41.547,41.548S261.613,231.042,238.703,231.042z"/>
</svg>
  `;

  const valueBadge = document.createElement("div");
  valueBadge.className = "ecobici-marker-count";
  valueBadge.textContent = String(bikes);

  root.append(iconWrap, valueBadge);
  return root;
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
      const markerColor = getMarkerColor(station);
      const markerElement = createMarkerElement(station, markerColor);
      const popup = new mapLibre.Popup({ closeButton: true }).setHTML(
        toPopupContent(station),
      );

      const existingMarker = markersRef.current.get(station.station_id);
      if (existingMarker) {
        existingMarker.remove();
      }

      const marker = new mapLibre.Marker({
        element: markerElement,
        anchor: "bottom",
      })
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
