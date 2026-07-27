import type { ColorTheme } from "./theme";

/**
 * Configuración centralizada de mapas base (MapLibre).
 *
 * Proveedor activo: Stadia Maps (vectorial).
 * Alternativa preparada: Thunderforest Transport (raster), para un futuro selector
 * "Mapa" / "Transporte" sin duplicar la lógica del mapa.
 */

export type BasemapPresetId = "stadia-alidade" | "thunderforest-transport";

export type MapStyleDefinition = string | Record<string, unknown>;

export interface BasemapPreset {
  id: BasemapPresetId;
  /** Etiqueta orientada a UI (futuro selector). */
  name: string;
  lightStyle: MapStyleDefinition;
  darkStyle: MapStyleDefinition;
  attribution: string;
  requiresApiKey: boolean;
}

const STADIA_API_KEY = (
  import.meta.env.VITE_STADIA_MAPS_API_KEY as string | undefined
)?.trim();

const THUNDERFOREST_API_KEY = (
  import.meta.env.VITE_THUNDERFOREST_API_KEY as string | undefined
)?.trim();

const STADIA_ATTRIBUTION =
  '© <a href="https://stadiamaps.com/" target="_blank" rel="noopener noreferrer">Stadia Maps</a> © <a href="https://openmaptiles.org/" target="_blank" rel="noopener noreferrer">OpenMapTiles</a> © <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener noreferrer">OpenStreetMap</a>';

const THUNDERFOREST_ATTRIBUTION =
  '© <a href="https://www.thunderforest.com/" target="_blank" rel="noopener noreferrer">Thunderforest</a> © <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener noreferrer">OpenStreetMap</a>';

const withQueryParam = (
  url: string,
  key: string,
  value: string | undefined,
): string => {
  if (!value) {
    return url;
  }
  const separator = url.includes("?") ? "&" : "?";
  return `${url}${separator}${key}=${encodeURIComponent(value)}`;
};

const buildRasterBasemapStyle = (
  tiles: string[],
  attribution: string,
): Record<string, unknown> => ({
  version: 8,
  sources: {
    basemap: {
      type: "raster",
      tiles,
      tileSize: 256,
      attribution,
    },
  },
  layers: [
    {
      id: "basemap",
      type: "raster",
      source: "basemap",
    },
  ],
  glyphs: "https://demotiles.maplibre.org/font/{fontstack}/{range}.pbf",
});

const buildThunderforestStyle = (variant: "transport" | "transport-dark") => {
  const tileUrl = withQueryParam(
    `https://tile.thunderforest.com/${variant}/{z}/{x}/{y}.png`,
    "apikey",
    THUNDERFOREST_API_KEY,
  );
  return buildRasterBasemapStyle([tileUrl], THUNDERFOREST_ATTRIBUTION);
};

export const MAP_BASEMAP_PRESETS: Record<BasemapPresetId, BasemapPreset> = {
  "stadia-alidade": {
    id: "stadia-alidade",
    name: "Mapa",
    lightStyle: withQueryParam(
      "https://tiles.stadiamaps.com/styles/alidade_smooth.json",
      "api_key",
      STADIA_API_KEY,
    ),
    darkStyle: withQueryParam(
      "https://tiles.stadiamaps.com/styles/alidade_smooth_dark.json",
      "api_key",
      STADIA_API_KEY,
    ),
    attribution: STADIA_ATTRIBUTION,
    requiresApiKey: Boolean(STADIA_API_KEY),
  },
  "thunderforest-transport": {
    id: "thunderforest-transport",
    name: "Transporte",
    lightStyle: buildThunderforestStyle("transport"),
    darkStyle: buildThunderforestStyle("transport-dark"),
    attribution: THUNDERFOREST_ATTRIBUTION,
    requiresApiKey: true,
  },
};

/** Preset activo. Cambiar solo aquí para alternar proveedor. */
export const ACTIVE_BASEMAP_PRESET_ID: BasemapPresetId = "stadia-alidade";

export const getActiveBasemapPreset = (): BasemapPreset => {
  return MAP_BASEMAP_PRESETS[ACTIVE_BASEMAP_PRESET_ID];
};

/**
 * Par claro / oscuro del proveedor activo.
 * Reutilizar esta constante en lugar de hardcodear URLs en componentes.
 */
export const MAP_BASE_STYLES: Record<ColorTheme, MapStyleDefinition> = {
  light: getActiveBasemapPreset().lightStyle,
  dark: getActiveBasemapPreset().darkStyle,
};

export const getBasemapStyleForTheme = (
  theme: ColorTheme,
): MapStyleDefinition => {
  return MAP_BASE_STYLES[theme];
};

/**
 * Compatibilidad con mapas que aún no reciben tema.
 * Preferir getBasemapStyleForTheme cuando el mapa soporte dark mode.
 */
export const MAP_BASEMAP_STYLE: MapStyleDefinition = MAP_BASE_STYLES.light;
