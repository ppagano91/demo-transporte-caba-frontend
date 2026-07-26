import { useEffect, useRef, useState } from "react";
import busIcon from "../assets/bus.svg";
import { MAP_BASEMAP_STYLE } from "../constants/mapBasemap";
import type { VehiclePosition } from "../types/vehicle";

interface MapViewProps {
  vehicles: VehiclePosition[];
  markerBackgroundColor: string;
}

interface MapLibreMarker {
  setLngLat: (lngLat: [number, number]) => MapLibreMarker;
  setPopup: (popup: MapLibrePopup) => MapLibreMarker;
  addTo: (map: MapLibreMap) => MapLibreMarker;
  getElement: () => HTMLElement;
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

const toPopupContent = (vehicle: VehiclePosition): string => {
  const timestampText = vehicle.timestamp
    ? new Date(vehicle.timestamp * 1000).toLocaleString("es-AR")
    : "-";

  const items = [
    ["id", vehicle.sourceId ?? vehicle.id],
    ["route id", vehicle.routeId],
    ["route short name", vehicle.route_short_name],
    ["agency id", vehicle.agencyId],
    ["agency name", vehicle.agencyName],
    ["direction", vehicle.directionId],
    ["tip id", vehicle.tipId],
    ["trip headsign", vehicle.tripHeadsign],
    ["timestamp", timestampText],
    ["latitude", vehicle.latitude.toFixed(6)],
    ["longitude", vehicle.longitude.toFixed(6)],
    ["bearing", vehicle.bearing?.toFixed(1)],
    ["speed", vehicle.speed?.toString()],
  ];

  return items
    .map(
      ([label, value]) =>
        `<div><strong>${label}:</strong> ${value ?? "-"}</div>`,
    )
    .join("");
};

const normalizeBearing = (value?: number): number | undefined => {
  if (value === undefined || !Number.isFinite(value)) {
    return undefined;
  }

  return ((value % 360) + 360) % 360;
};

const toRadians = (value: number): number => (value * Math.PI) / 180;

const toDegrees = (value: number): number => (value * 180) / Math.PI;

const inferBearing = (
  previous: { latitude: number; longitude: number } | undefined,
  current: { latitude: number; longitude: number },
): number | undefined => {
  if (!previous) {
    return undefined;
  }

  const latDiff = Math.abs(current.latitude - previous.latitude);
  const lonDiff = Math.abs(current.longitude - previous.longitude);
  if (latDiff < 0.00001 && lonDiff < 0.00001) {
    return undefined;
  }

  const previousLatitude = toRadians(previous.latitude);
  const currentLatitude = toRadians(current.latitude);
  const deltaLongitude = toRadians(current.longitude - previous.longitude);

  const y = Math.sin(deltaLongitude) * Math.cos(currentLatitude);
  const x =
    Math.cos(previousLatitude) * Math.sin(currentLatitude) -
    Math.sin(previousLatitude) *
      Math.cos(currentLatitude) *
      Math.cos(deltaLongitude);

  return normalizeBearing(toDegrees(Math.atan2(y, x)));
};

const applyMarkerBearing = (
  markerElement: HTMLElement,
  bearing: number | undefined,
): void => {
  if (bearing === undefined) {
    markerElement.classList.remove("has-direction");
    markerElement.style.removeProperty("--bus-marker-bearing");
    return;
  }

  markerElement.classList.add("has-direction");
  markerElement.style.setProperty("--bus-marker-bearing", `${bearing}deg`);
};

const createBusMarkerElement = (markerBackgroundColor: string): HTMLDivElement => {
  const markerElement = document.createElement("div");
  markerElement.className = "bus-marker";
  markerElement.setAttribute("aria-label", "Colectivo");
  markerElement.style.setProperty("--bus-marker-bg", markerBackgroundColor);

  const rotatorElement = document.createElement("div");
  rotatorElement.className = "bus-marker-rotator";

  const directionLayerElement = document.createElement("div");
  directionLayerElement.className = "bus-marker-direction-layer";

  const directionElement = document.createElement("span");
  directionElement.className = "bus-marker-direction";
  directionElement.setAttribute("aria-hidden", "true");

  const iconSurfaceElement = document.createElement("div");
  iconSurfaceElement.className = "bus-marker-surface";

  const imageElement = document.createElement("img");
  imageElement.className = "bus-marker-icon";
  imageElement.src = busIcon;
  imageElement.alt = "Colectivo";
  imageElement.width = 30;
  imageElement.height = 30;
  imageElement.decoding = "async";

  imageElement.onerror = () => {
    imageElement.remove();
    iconSurfaceElement.classList.add("bus-marker-fallback");
    markerElement.setAttribute("aria-label", "Colectivo sin icono");

    const fallbackElement = document.createElement("span");
    fallbackElement.className = "bus-marker-fallback-label";
    fallbackElement.textContent = "B";
    iconSurfaceElement.appendChild(fallbackElement);
  };

  iconSurfaceElement.appendChild(imageElement);
  directionLayerElement.appendChild(directionElement);
  rotatorElement.appendChild(directionLayerElement);
  rotatorElement.appendChild(iconSurfaceElement);
  markerElement.appendChild(rotatorElement);

  return markerElement;
};

function MapView({ vehicles, markerBackgroundColor }: MapViewProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<MapLibreMap | null>(null);
  const markersRef = useRef<Map<string, MapLibreMarker>>(new Map());
  const previousPositionsRef = useRef<
    Map<string, { latitude: number; longitude: number }>
  >(new Map());
  const lastBearingRef = useRef<Map<string, number>>(new Map());
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
          style: MAP_BASEMAP_STYLE,
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
      previousPositionsRef.current.clear();
      lastBearingRef.current.clear();
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

    if (vehicles.length === 0) {
      fittedRef.current = false;
    }

    const nextIds = new Set<string>();

    for (const vehicle of vehicles) {
      nextIds.add(vehicle.id);
      const lngLat: [number, number] = [vehicle.longitude, vehicle.latitude];
      const popup = new mapLibre.Popup({ closeButton: true }).setHTML(
        toPopupContent(vehicle),
      );
      const existingMarker = markersRef.current.get(vehicle.id);
      const previousPosition = previousPositionsRef.current.get(vehicle.id);
      const nextBearing =
        normalizeBearing(vehicle.bearing) ??
        inferBearing(previousPosition, {
          latitude: vehicle.latitude,
          longitude: vehicle.longitude,
        }) ??
        lastBearingRef.current.get(vehicle.id);

      if (existingMarker) {
        const markerElement = existingMarker.getElement();
        markerElement.style.setProperty("--bus-marker-bg", markerBackgroundColor);
        applyMarkerBearing(markerElement, nextBearing);
        existingMarker.setLngLat(lngLat).setPopup(popup);
      } else {
        const markerElement = createBusMarkerElement(markerBackgroundColor);
        applyMarkerBearing(markerElement, nextBearing);
        const marker = new mapLibre.Marker({
          element: markerElement,
          anchor: "center",
        })
          .setLngLat(lngLat)
          .setPopup(popup)
          .addTo(map);
        markersRef.current.set(vehicle.id, marker);
      }

      if (nextBearing !== undefined) {
        lastBearingRef.current.set(vehicle.id, nextBearing);
      }
      previousPositionsRef.current.set(vehicle.id, {
        latitude: vehicle.latitude,
        longitude: vehicle.longitude,
      });
    }

    markersRef.current.forEach((marker, id) => {
      if (!nextIds.has(id)) {
        marker.remove();
        markersRef.current.delete(id);
        previousPositionsRef.current.delete(id);
        lastBearingRef.current.delete(id);
      }
    });

    if (!fittedRef.current && vehicles.length > 0) {
      let minLat = vehicles[0].latitude;
      let minLon = vehicles[0].longitude;
      let maxLat = vehicles[0].latitude;
      let maxLon = vehicles[0].longitude;

      for (const vehicle of vehicles) {
        minLat = Math.min(minLat, vehicle.latitude);
        minLon = Math.min(minLon, vehicle.longitude);
        maxLat = Math.max(maxLat, vehicle.latitude);
        maxLon = Math.max(maxLon, vehicle.longitude);
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
  }, [mapReady, markerBackgroundColor, vehicles]);

  return <div ref={containerRef} className="map-view" />;
}

export default MapView;
