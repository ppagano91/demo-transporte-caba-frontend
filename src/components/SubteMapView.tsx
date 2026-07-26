import { useEffect, useMemo, useRef, useState } from "react";
import {
  getSubwayLineColor,
  parseSubwayLineCode,
  type SubwayLineCode,
} from "../constants/subwayLines";
import type { SubteGeoJsonFeatureCollection } from "../types/subte";

interface SubteMapViewProps {
  network: SubteGeoJsonFeatureCollection | null;
  stations: SubteGeoJsonFeatureCollection | null;
  selectedLine: SubwayLineCode | null;
  selectedStationId: string | null;
  onSelectLine?: (line: SubwayLineCode | null) => void;
  onSelectStation?: (stationId: string | null, line: SubwayLineCode | null) => void;
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

interface MapLibreMap {
  fitBounds: (
    bounds: MapLibreLngLatBoundsLike | [[number, number], [number, number]],
    options?: { padding?: number; duration?: number; maxZoom?: number },
  ) => void;
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
  }) => {
    setLngLat: (lngLat: [number, number]) => {
      setHTML: (html: string) => {
        addTo: (map: MapLibreMap) => void;
      };
    };
  };
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
  glyphs: "https://demotiles.maplibre.org/font/{fontstack}/{range}.pbf",
};

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

const escapeHtml = (value: string): string => {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
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

function SubteMapView({
  network,
  stations,
  selectedLine,
  selectedStationId,
  onSelectLine,
  onSelectStation,
}: SubteMapViewProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<MapLibreMap | null>(null);
  const onSelectLineRef = useRef(onSelectLine);
  const onSelectStationRef = useRef(onSelectStation);
  const [mapReady, setMapReady] = useState(false);
  const [mapError, setMapError] = useState<string | null>(null);

  onSelectLineRef.current = onSelectLine;
  onSelectStationRef.current = onSelectStation;

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
          style: MAP_STYLE_URL,
          center: [-58.42, -34.61],
          zoom: 11.4,
        });
        mapRef.current = mapInstance;

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
            const lineCode = parseSubwayLineCode(
              typeof properties.lineCode === "string"
                ? properties.lineCode
                : typeof properties.ral === "string"
                  ? properties.ral
                  : null,
            );

            onSelectStationRef.current?.(stationId, lineCode);

            const name =
              typeof properties.nam === "string" ? properties.nam : "Estacion";
            const lineLabel =
              typeof properties.ral === "string" ? properties.ral : "-";
            const corridor =
              typeof properties.cab === "string" ? properties.cab : "-";

            const maplibreApi = getMapLibre();
            if (!maplibreApi || !mapInstance) {
              return;
            }

            new maplibreApi.Popup({ closeButton: true, closeOnClick: true })
              .setLngLat([event.lngLat.lng, event.lngLat.lat])
              .setHTML(
                `<div class="subte-map-popup">
                  <strong>${escapeHtml(name)}</strong>
                  <div>${escapeHtml(lineLabel)}</div>
                  ${
                    corridor && corridor !== "-"
                      ? `<div>${escapeHtml(corridor)}</div>`
                      : ""
                  }
                </div>`,
              )
              .addTo(mapInstance);
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
            if (lineCode) {
              onSelectLineRef.current?.(lineCode);
              onSelectStationRef.current?.(null, lineCode);
            }
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
  }, [mapReady, selectedLine, selectedStationId]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !mapReady) {
      return;
    }
    fitToFeatures(map, [network, stations], selectedLine);
  }, [mapReady, network, stations, selectedLine]);

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
