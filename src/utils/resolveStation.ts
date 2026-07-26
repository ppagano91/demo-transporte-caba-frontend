import { parseSubwayLineCode, type SubwayLineCode } from "../constants/subwayLines";
import type {
  SubteGeoJsonFeature,
  SubteGeoJsonFeatureCollection,
  SubteStationForecast,
} from "../types/subte";

/**
 * Vinculación forecastGTFS ↔ JSON estático de estaciones.
 *
 * Formatos observados:
 * - forecast `stop_id`: platform GTFS con sufijo de andén, p. ej. `1118N` / `1118S`.
 *   El sufijo N/S indica lado/sentido del andén, no el id del JSON estático.
 * - JSON estático `properties.id`: entero propio del dataset (1..90), incompatible
 *   con el stop_id GTFS. No hay overlap numérico.
 *
 * Por eso la vinculación principal es por línea + nombre normalizado.
 * No se usan coincidencias parciales peligrosas (substrings cortos / fuzzy libre).
 */

export type StationMatchMethod =
  | "exact-name"
  | "token-containment"
  | "explicit-alias"
  | "forecast-name-only"
  | "unresolved";

export interface ResolvedStation {
  stopId?: string;
  stopIdBase?: string;
  platformSide?: "N" | "S" | null;
  displayName: string;
  forecastName?: string;
  staticId?: string;
  staticName?: string;
  lineCode: SubwayLineCode | null;
  matchMethod: StationMatchMethod;
  matched: boolean;
}

export interface StaticStationRecord {
  staticId: string;
  name: string;
  normalizedName: string;
  tokens: string[];
  lineCode: SubwayLineCode | null;
  feature: SubteGeoJsonFeature;
}

export interface StationDirectory {
  byLine: Map<SubwayLineCode, StaticStationRecord[]>;
  all: StaticStationRecord[];
}

const STOPWORDS = new Set([
  "de",
  "del",
  "la",
  "las",
  "los",
  "el",
  "y",
  "e",
  "a",
  "al",
]);

/** Alias explícitos: clave `${line}|${normalizedForecastName}` → normalized static name. */
const EXPLICIT_NAME_ALIASES: Readonly<Record<string, string>> = {
  "b|carlos pelegrini": "c pellegrini",
  "b|medrano": "almagro medrano",
  "e|general urquiza": "urquiza",
};

const expandAbbreviations = (value: string): string => {
  return value
    .replace(/\bpque\b/g, "parque")
    .replace(/\bav\b/g, "avenida")
    .replace(/\bpdte\b/g, "presidente")
    .replace(/\bdr\b/g, "doctor");
};

export const normalizeStationName = (
  value: string | null | undefined,
): string => {
  if (!value) {
    return "";
  }

  const stripped = expandAbbreviations(
    value
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, " ")
      .trim(),
  );

  return stripped
    .split(/\s+/)
    .filter((token) => token.length > 0 && !STOPWORDS.has(token))
    .join(" ");
};

export const tokenizeStationName = (
  value: string | null | undefined,
): string[] => {
  const normalized = normalizeStationName(value);
  return normalized ? normalized.split(" ") : [];
};

/**
 * Normaliza un stop_id de forecast.
 * Ej.: `1118N` → base `1118`, platformSide `N`.
 */
export const normalizeStopId = (
  stopId: string | null | undefined,
): { raw?: string; base?: string; platformSide: "N" | "S" | null } => {
  if (!stopId) {
    return { platformSide: null };
  }

  const raw = stopId.trim();
  if (!raw) {
    return { platformSide: null };
  }

  const match = raw.match(/^(\d+)([NS])$/i);
  if (match) {
    return {
      raw,
      base: match[1],
      platformSide: match[2].toUpperCase() as "N" | "S",
    };
  }

  return { raw, base: raw, platformSide: null };
};

export const buildStationDirectory = (
  collection: SubteGeoJsonFeatureCollection | null | undefined,
): StationDirectory => {
  const byLine = new Map<SubwayLineCode, StaticStationRecord[]>();
  const all: StaticStationRecord[] = [];

  for (const feature of collection?.features ?? []) {
    const properties = feature.properties ?? {};
    const name =
      typeof properties.nam === "string" ? properties.nam.trim() : "";
    if (!name) {
      continue;
    }

    const lineCode = parseSubwayLineCode(
      typeof properties.lineCode === "string"
        ? properties.lineCode
        : typeof properties.ral === "string"
          ? properties.ral
          : null,
    );

    const staticId =
      typeof properties.id === "number" || typeof properties.id === "string"
        ? String(properties.id)
        : typeof feature.id === "string" || typeof feature.id === "number"
          ? String(feature.id)
          : name;

    const record: StaticStationRecord = {
      staticId,
      name,
      normalizedName: normalizeStationName(name),
      tokens: tokenizeStationName(name),
      lineCode,
      feature,
    };

    all.push(record);
    if (lineCode) {
      const list = byLine.get(lineCode) ?? [];
      list.push(record);
      byLine.set(lineCode, list);
    }
  }

  return { byLine, all };
};

const candidatesForLine = (
  directory: StationDirectory,
  lineCode: SubwayLineCode | null,
): StaticStationRecord[] => {
  if (lineCode) {
    return directory.byLine.get(lineCode) ?? [];
  }
  return directory.all;
};

const findByNormalizedName = (
  candidates: StaticStationRecord[],
  normalizedName: string,
): StaticStationRecord | null => {
  if (!normalizedName) {
    return null;
  }
  const matches = candidates.filter(
    (candidate) => candidate.normalizedName === normalizedName,
  );
  return matches.length === 1 ? matches[0] : null;
};

/**
 * Contención de tokens solo si hay exactamente un candidato en la línea.
 * Evita matches ambiguos (p. ej. nombres cortos compartidos).
 */
const findByTokenContainment = (
  candidates: StaticStationRecord[],
  forecastTokens: string[],
): StaticStationRecord | null => {
  if (forecastTokens.length === 0) {
    return null;
  }

  const matches = candidates.filter((candidate) => {
    if (candidate.tokens.length === 0) {
      return false;
    }
    const forecastInStatic = forecastTokens.every((token) =>
      candidate.tokens.includes(token),
    );
    const staticInForecast = candidate.tokens.every((token) =>
      forecastTokens.includes(token),
    );
    return forecastInStatic || staticInForecast;
  });

  return matches.length === 1 ? matches[0] : null;
};

export const resolveStation = (
  directory: StationDirectory,
  options: {
    stopId?: string | null;
    stopName?: string | null;
    lineCode?: SubwayLineCode | null;
  },
): ResolvedStation => {
  const lineCode = options.lineCode ?? null;
  const forecastName = options.stopName?.trim() || undefined;
  const stopInfo = normalizeStopId(options.stopId);

  const unresolved = (method: StationMatchMethod): ResolvedStation => ({
    stopId: stopInfo.raw,
    stopIdBase: stopInfo.base,
    platformSide: stopInfo.platformSide,
    displayName: forecastName || stopInfo.raw || "Estación",
    forecastName,
    lineCode,
    matchMethod: method,
    matched: false,
  });

  if (!forecastName && !stopInfo.raw) {
    return unresolved("unresolved");
  }

  const candidates = candidatesForLine(directory, lineCode);
  const normalizedForecast = normalizeStationName(forecastName);
  const forecastTokens = tokenizeStationName(forecastName);

  const exact = findByNormalizedName(candidates, normalizedForecast);
  if (exact) {
    return {
      stopId: stopInfo.raw,
      stopIdBase: stopInfo.base,
      platformSide: stopInfo.platformSide,
      displayName: exact.name,
      forecastName,
      staticId: exact.staticId,
      staticName: exact.name,
      lineCode: exact.lineCode ?? lineCode,
      matchMethod: "exact-name",
      matched: true,
    };
  }

  if (lineCode && normalizedForecast) {
    const aliasTarget =
      EXPLICIT_NAME_ALIASES[`${lineCode.toLowerCase()}|${normalizedForecast}`];
    if (aliasTarget) {
      const aliased = findByNormalizedName(candidates, aliasTarget);
      if (aliased) {
        return {
          stopId: stopInfo.raw,
          stopIdBase: stopInfo.base,
          platformSide: stopInfo.platformSide,
          displayName: aliased.name,
          forecastName,
          staticId: aliased.staticId,
          staticName: aliased.name,
          lineCode: aliased.lineCode ?? lineCode,
          matchMethod: "explicit-alias",
          matched: true,
        };
      }
    }
  }

  const contained = findByTokenContainment(candidates, forecastTokens);
  if (contained) {
    return {
      stopId: stopInfo.raw,
      stopIdBase: stopInfo.base,
      platformSide: stopInfo.platformSide,
      displayName: contained.name,
      forecastName,
      staticId: contained.staticId,
      staticName: contained.name,
      lineCode: contained.lineCode ?? lineCode,
      matchMethod: "token-containment",
      matched: true,
    };
  }

  return unresolved(forecastName ? "forecast-name-only" : "unresolved");
};

export const resolveForecastStation = (
  directory: StationDirectory,
  station: SubteStationForecast,
  lineCode: SubwayLineCode | null,
): ResolvedStation => {
  return resolveStation(directory, {
    stopId: station.stop_id,
    stopName: station.stop_name,
    lineCode,
  });
};

/**
 * Compara una estación del forecast con la estación estática seleccionada en el mapa.
 */
export const forecastStationMatchesSelection = (
  directory: StationDirectory,
  station: SubteStationForecast,
  lineCode: SubwayLineCode | null,
  selectedStaticId: string | null,
  selectedStaticName: string | null,
): boolean => {
  if (!selectedStaticId && !selectedStaticName) {
    return true;
  }

  const resolved = resolveForecastStation(directory, station, lineCode);
  if (selectedStaticId && resolved.staticId === selectedStaticId) {
    return true;
  }

  if (selectedStaticName) {
    const selectedNormalized = normalizeStationName(selectedStaticName);
    if (
      selectedNormalized &&
      (normalizeStationName(resolved.displayName) === selectedNormalized ||
        normalizeStationName(resolved.forecastName) === selectedNormalized ||
        normalizeStationName(station.stop_name) === selectedNormalized)
    ) {
      return true;
    }

    const selectedTokens = tokenizeStationName(selectedStaticName);
    const forecastTokens = tokenizeStationName(station.stop_name);
    if (
      selectedTokens.length > 0 &&
      forecastTokens.length > 0 &&
      (forecastTokens.every((token) => selectedTokens.includes(token)) ||
        selectedTokens.every((token) => forecastTokens.includes(token)))
    ) {
      return true;
    }
  }

  return false;
};
