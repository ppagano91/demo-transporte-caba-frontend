import { useEffect, useRef, useState } from "react";
import bikeIcon from "../assets/bike.svg";
import { MAP_BASEMAP_STYLE } from "../constants/mapBasemap";
import type { EcobiciStationMerged } from "../types/ecobici";

interface EcobiciMapViewProps {
  stations: EcobiciStationMerged[];
}

type EcobiciPointFeature = {
  type: "Feature";
  geometry: {
    type: "Point";
    coordinates: [number, number];
  };
  properties: {
    station_id: string;
    popup_html: string;
    marker_color: string;
    bikes_count: number;
  };
};

type EcobiciFeatureCollection = {
  type: "FeatureCollection";
  features: EcobiciPointFeature[];
};

interface EcobiciMapLibrePopup {
  setHTML: (html: string) => EcobiciMapLibrePopup;
  setLngLat: (lngLat: [number, number]) => EcobiciMapLibrePopup;
  addTo: (map: EcobiciMapLibreMap) => EcobiciMapLibrePopup;
}

interface EcobiciMapLibreGeoJSONSource {
  setData: (data: EcobiciFeatureCollection) => void;
  getClusterExpansionZoom: (
    clusterId: number,
    callback: (error: Error | null, zoom: number) => void,
  ) => void;
}

interface EcobiciMapLibreMapMouseEvent {
  lngLat: { lng: number; lat: number };
  features?: Array<{
    geometry?: { coordinates?: unknown };
    properties?: Record<string, unknown>;
  }>;
}

interface EcobiciMapLibreMap {
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
      data: EcobiciFeatureCollection;
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
  removeLayer: (id: string) => void;
  removeSource: (id: string) => void;
  on: {
    (event: "load", handler: () => void): void;
    (
      event: "click",
      layerId: string,
      handler: (ev: EcobiciMapLibreMapMouseEvent) => void,
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
      handler: (ev: EcobiciMapLibreMapMouseEvent) => void,
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
  loadImage: (
    url: string,
    callback: (error: Error | null, image: HTMLImageElement | null) => void,
  ) => void;
  addImage: (
    id: string,
    image: HTMLImageElement | ImageData,
    options?: { sdf?: boolean },
  ) => void;
}

interface EcobiciMapLibreApi {
  Map: new (options: {
    container: HTMLElement;
    style: string | Record<string, unknown>;
    center: [number, number];
    zoom: number;
  }) => EcobiciMapLibreMap;
  Popup: new (options?: {
    closeButton?: boolean;
    closeOnClick?: boolean;
  }) => EcobiciMapLibrePopup;
}

const MAPLIBRE_SCRIPT_ID = "maplibre-js-cdn";
const MAPLIBRE_CSS_ID = "maplibre-css-cdn";
const MAPLIBRE_SCRIPT_URL =
  "https://unpkg.com/maplibre-gl@4.7.1/dist/maplibre-gl.js";
const MAPLIBRE_CSS_URL =
  "https://unpkg.com/maplibre-gl@4.7.1/dist/maplibre-gl.css";
const ECOBICI_SOURCE_ID = "ecobici-stations";
const ECOBICI_CLUSTERS_LAYER_ID = "ecobici-clusters";
const ECOBICI_CLUSTER_COUNT_LAYER_ID = "ecobici-cluster-count";
const ECOBICI_UNCLUSTERED_CIRCLE_LAYER_ID = "ecobici-unclustered-circle";
const ECOBICI_UNCLUSTERED_ICON_LAYER_ID = "ecobici-unclustered-icon";
const ECOBICI_UNCLUSTERED_COUNT_LAYER_ID = "ecobici-unclustered-count";
const ECOBICI_CLUSTER_RADIUS = 50;
const ECOBICI_CLUSTER_MAX_ZOOM = 14;
const ECOBICI_MARKER_ICON_ID = "ecobici-marker";

let mapLibreLoadPromise: Promise<void> | null = null;
const getMapLibre = (): EcobiciMapLibreApi | undefined => {
  return (window as Window & { maplibregl?: EcobiciMapLibreApi }).maplibregl;
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

const toEcobiciGeoJson = (
  stations: EcobiciStationMerged[],
): EcobiciFeatureCollection => {
  const features: EcobiciPointFeature[] = [];

  for (const station of stations) {
    if (!Number.isFinite(station.lon) || !Number.isFinite(station.lat)) {
      continue;
    }

    features.push({
      type: "Feature",
      geometry: {
        type: "Point",
        coordinates: [station.lon, station.lat],
      },
      properties: {
        station_id: station.station_id,
        popup_html: toPopupContent(station),
        marker_color: getMarkerColor(station),
        bikes_count: getBikesCount(station),
      },
    });
  }

  return {
    type: "FeatureCollection",
    features,
  };
};

const getBikesCount = (station: EcobiciStationMerged): number => {
  const value = station.num_bikes_available;
  if (
    value === undefined ||
    value === null ||
    typeof value !== "number" ||
    !Number.isFinite(value)
  ) {
    return 0;
  }
  return Math.max(0, Math.trunc(value));
};

const getMarkerColor = (station: EcobiciStationMerged): string => {
  if (station.status && station.status !== "IN_SERVICE") {
    return "#6b7280";
  }

  const bikes = getBikesCount(station);
  if (bikes <= 0) {
    return "#b02929";
  }
  if (bikes <= 5) {
    return "#d4af09";
  }
  return "#16a361";
};

const loadSvgAsMapImage = async (
  map: EcobiciMapLibreMap,
  id: string,
  svgUrl: string,
  size = 64,
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
    canvas.width = 80;
    canvas.height = 80;

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

const addEcobiciSourceAndLayers = (map: EcobiciMapLibreMap): void => {
  if (!map.getSource(ECOBICI_SOURCE_ID)) {
    map.addSource(ECOBICI_SOURCE_ID, {
      type: "geojson",
      data: {
        type: "FeatureCollection",
        features: [],
      },
      cluster: true,
      clusterRadius: ECOBICI_CLUSTER_RADIUS,
      clusterMaxZoom: ECOBICI_CLUSTER_MAX_ZOOM,
    });
  }

  if (!map.getLayer(ECOBICI_CLUSTERS_LAYER_ID)) {
    map.addLayer({
      id: ECOBICI_CLUSTERS_LAYER_ID,
      type: "circle",
      source: ECOBICI_SOURCE_ID,
      filter: ["has", "point_count"],
      paint: {
        "circle-color": "#1d4ed8",
        "circle-radius": ["step", ["get", "point_count"], 16, 50, 20, 200, 24],
      },
    });
  }

  if (!map.getLayer(ECOBICI_CLUSTER_COUNT_LAYER_ID)) {
    map.addLayer({
      id: ECOBICI_CLUSTER_COUNT_LAYER_ID,
      type: "symbol",
      source: ECOBICI_SOURCE_ID,
      filter: ["has", "point_count"],
      layout: {
        "text-field": ["get", "point_count_abbreviated"],
        "text-size": 12,
        "text-font": ["Noto Sans Regular"],
      },
      paint: {
        "text-color": "#ffffff",
      },
    });
  }

  if (!map.getLayer(ECOBICI_UNCLUSTERED_CIRCLE_LAYER_ID)) {
    map.addLayer({
      id: ECOBICI_UNCLUSTERED_CIRCLE_LAYER_ID,
      type: "circle",
      source: ECOBICI_SOURCE_ID,
      filter: ["!", ["has", "point_count"]],
      paint: {
        "circle-color": ["coalesce", ["get", "marker_color"]],
        "circle-radius": 12,
        // "circle-stroke-color": "#fff",
        // "circle-stroke-width": 1,
      },
    });
  }

  if (!map.getLayer(ECOBICI_UNCLUSTERED_ICON_LAYER_ID)) {
    map.addLayer({
      id: ECOBICI_UNCLUSTERED_ICON_LAYER_ID,
      type: "symbol",
      source: ECOBICI_SOURCE_ID,
      filter: ["!", ["has", "point_count"]],
      layout: {
        "icon-image": ECOBICI_MARKER_ICON_ID,
        "icon-size": 0.5,
        "icon-allow-overlap": true,
      },
      paint: {
        "icon-color": "#fff",
      },
    });
  }

  if (!map.getLayer(ECOBICI_UNCLUSTERED_COUNT_LAYER_ID)) {
    map.addLayer({
      id: ECOBICI_UNCLUSTERED_COUNT_LAYER_ID,
      type: "symbol",
      source: ECOBICI_SOURCE_ID,
      filter: ["!", ["has", "point_count"]],
      layout: {
        "text-field": ["to-string", ["get", "bikes_count"]],
        "text-size": 10,
        "text-font": ["Noto Sans Bold"],
        "text-offset": [1.5, 1.5],
        "text-anchor": "bottom-right",
      },
      paint: {
        "text-color": "#ffffff",
        "text-halo-color": "#111827",
        "text-halo-width": 2,
      },
    });
  }
};

const ensureEcobiciIconAndLayers = async (
  map: EcobiciMapLibreMap,
): Promise<void> => {
  if (!map.hasImage(ECOBICI_MARKER_ICON_ID)) {
    await loadSvgAsMapImage(map, ECOBICI_MARKER_ICON_ID, bikeIcon, 32 * 1.25);
  }
  addEcobiciSourceAndLayers(map);
};

function EcobiciMapView({ stations }: EcobiciMapViewProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<EcobiciMapLibreMap | null>(null);
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
          await ensureEcobiciIconAndLayers(createdMap);
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
    if (!mapReady || !map) {
      return;
    }

    if (!mapLoadedRef.current) {
      return;
    }

    void ensureEcobiciIconAndLayers(map);
    const source = map.getSource(ECOBICI_SOURCE_ID) as
      | EcobiciMapLibreGeoJSONSource
      | undefined;
    if (!source) {
      return;
    }

    source.setData(toEcobiciGeoJson(stations));

    if (stations.length === 0) {
      fittedRef.current = false;
      return;
    }

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

  useEffect(() => {
    const map = mapRef.current;
    const mapLibre = getMapLibre();
    if (!mapReady || !map || !mapLibre) {
      return;
    }

    const onClusterClick = (ev: EcobiciMapLibreMapMouseEvent) => {
      const feature = ev.features?.[0];
      const coordinates = feature?.geometry?.coordinates;
      const properties = feature?.properties ?? {};
      const clusterId = properties.cluster_id;

      if (
        !Array.isArray(coordinates) ||
        coordinates.length < 2 ||
        typeof coordinates[0] !== "number" ||
        typeof coordinates[1] !== "number" ||
        typeof clusterId !== "number"
      ) {
        return;
      }

      const source = map.getSource(ECOBICI_SOURCE_ID) as
        | EcobiciMapLibreGeoJSONSource
        | undefined;
      if (!source) {
        return;
      }

      source.getClusterExpansionZoom(clusterId, (error, zoom) => {
        if (error) {
          return;
        }
        map.easeTo({
          center: [coordinates[0], coordinates[1]],
          zoom,
          duration: 500,
        });
      });
    };

    const onUnclusteredPointClick = (ev: EcobiciMapLibreMapMouseEvent) => {
      const feature = ev.features?.[0];
      const coordinates = feature?.geometry?.coordinates;
      const properties = feature?.properties ?? {};
      const popupHtml = properties.popup_html;

      if (
        !Array.isArray(coordinates) ||
        coordinates.length < 2 ||
        typeof coordinates[0] !== "number" ||
        typeof coordinates[1] !== "number" ||
        typeof popupHtml !== "string"
      ) {
        return;
      }

      new mapLibre.Popup({ closeButton: true })
        .setLngLat([coordinates[0], coordinates[1]])
        .setHTML(popupHtml)
        .addTo(map);
    };

    const onMouseEnter = () => {
      map.getCanvas().style.cursor = "pointer";
    };
    const onMouseLeave = () => {
      map.getCanvas().style.cursor = "";
    };

    map.on("click", ECOBICI_CLUSTERS_LAYER_ID, onClusterClick);
    map.on(
      "click",
      ECOBICI_UNCLUSTERED_CIRCLE_LAYER_ID,
      onUnclusteredPointClick,
    );
    map.on("click", ECOBICI_UNCLUSTERED_ICON_LAYER_ID, onUnclusteredPointClick);
    map.on(
      "click",
      ECOBICI_UNCLUSTERED_COUNT_LAYER_ID,
      onUnclusteredPointClick,
    );
    map.on("mouseenter", ECOBICI_CLUSTERS_LAYER_ID, onMouseEnter);
    map.on("mouseleave", ECOBICI_CLUSTERS_LAYER_ID, onMouseLeave);
    map.on("mouseenter", ECOBICI_UNCLUSTERED_CIRCLE_LAYER_ID, onMouseEnter);
    map.on("mouseleave", ECOBICI_UNCLUSTERED_CIRCLE_LAYER_ID, onMouseLeave);
    map.on("mouseenter", ECOBICI_UNCLUSTERED_ICON_LAYER_ID, onMouseEnter);
    map.on("mouseleave", ECOBICI_UNCLUSTERED_ICON_LAYER_ID, onMouseLeave);
    map.on("mouseenter", ECOBICI_UNCLUSTERED_COUNT_LAYER_ID, onMouseEnter);
    map.on("mouseleave", ECOBICI_UNCLUSTERED_COUNT_LAYER_ID, onMouseLeave);

    return () => {
      map.off("click", ECOBICI_CLUSTERS_LAYER_ID, onClusterClick);
      map.off(
        "click",
        ECOBICI_UNCLUSTERED_CIRCLE_LAYER_ID,
        onUnclusteredPointClick,
      );
      map.off(
        "click",
        ECOBICI_UNCLUSTERED_ICON_LAYER_ID,
        onUnclusteredPointClick,
      );
      map.off(
        "click",
        ECOBICI_UNCLUSTERED_COUNT_LAYER_ID,
        onUnclusteredPointClick,
      );
      map.off("mouseenter", ECOBICI_CLUSTERS_LAYER_ID, onMouseEnter);
      map.off("mouseleave", ECOBICI_CLUSTERS_LAYER_ID, onMouseLeave);
      map.off("mouseenter", ECOBICI_UNCLUSTERED_CIRCLE_LAYER_ID, onMouseEnter);
      map.off("mouseleave", ECOBICI_UNCLUSTERED_CIRCLE_LAYER_ID, onMouseLeave);
      map.off("mouseenter", ECOBICI_UNCLUSTERED_ICON_LAYER_ID, onMouseEnter);
      map.off("mouseleave", ECOBICI_UNCLUSTERED_ICON_LAYER_ID, onMouseLeave);
      map.off("mouseenter", ECOBICI_UNCLUSTERED_COUNT_LAYER_ID, onMouseEnter);
      map.off("mouseleave", ECOBICI_UNCLUSTERED_COUNT_LAYER_ID, onMouseLeave);
    };
  }, [mapReady]);

  return <div ref={containerRef} className="map-view ecobici-map-view" />;
}

export default EcobiciMapView;
