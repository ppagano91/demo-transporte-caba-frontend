import { parseSubwayLineCode, type SubwayLineCode } from "../constants/subwayLines";
import type { SubteEntityForecast, SubwayDirection } from "../types/subte";
import {
  type StationDirectory,
  resolveForecastStation,
} from "./resolveStation";

/**
 * Hallazgos de forecastGTFS (inspección de respuesta cruda):
 *
 * - Cada línea suele traer 2 entidades (p. ej. LineaA_A13 / LineaA_A03).
 * - `Linea.Direction_ID` está presente (0 | 1) y es el discriminador estable.
 * - No existe `trip_headsign`.
 * - No hay `stop_sequence`; el orden es `Linea.Estaciones[]`.
 * - Origen/destino = primera y última estación de esa secuencia.
 * - `entity.ID` / `Trip_Id` (A13 vs A03) correlacionan con el sentido pero
 *   NO se usan como regla principal.
 *
 * Etiquetas visibles: `Origen → Destino`.
 * Si faltan nombres seguros: `Sentido 1` / `Sentido 2` (nunca IDs técnicos).
 */

export interface ResolveDirectionOptions {
  directory?: StationDirectory | null;
}

const buildDirectionKey = (
  lineCode: string,
  directionId: number | string | undefined,
  originStopId: string | undefined,
  destinationStopId: string | undefined,
): string => {
  if (directionId !== undefined && directionId !== null && `${directionId}` !== "") {
    return `${lineCode}:dir:${directionId}`;
  }
  if (originStopId || destinationStopId) {
    return `${lineCode}:od:${originStopId ?? ""}>${destinationStopId ?? ""}`;
  }
  return `${lineCode}:unknown`;
};

const buildOdLabel = (
  originName: string | undefined,
  destinationName: string | undefined,
): string | null => {
  if (originName && destinationName) {
    return `${originName} → ${destinationName}`;
  }
  return null;
};

/**
 * Normaliza el sentido de una entidad dinámica de forecast.
 */
export const resolveSubwayDirection = (
  entity: SubteEntityForecast,
  options: ResolveDirectionOptions = {},
): SubwayDirection | null => {
  const linea = entity.Linea;
  if (!linea) {
    return null;
  }

  const parsedLine = parseSubwayLineCode(linea.Route_Id);
  const lineCode = parsedLine ?? (linea.Route_Id?.trim() || "unknown");
  const stations = linea.Estaciones ?? [];

  if (stations.length === 0) {
    const directionId = linea.Direction_ID;
    return {
      key: buildDirectionKey(lineCode, directionId, undefined, undefined),
      lineCode,
      directionId,
      label: "Sentido 1",
      labelIsFallback: true,
      fallbackReason:
        "La entidad no incluye estaciones; no se pudo derivar origen/destino.",
    };
  }

  const origin = stations[0];
  const destination = stations[stations.length - 1];
  const directory = options.directory ?? null;

  const resolvedOrigin = directory
    ? resolveForecastStation(directory, origin, parsedLine)
    : null;
  const resolvedDestination = directory
    ? resolveForecastStation(directory, destination, parsedLine)
    : null;

  const originStopId = origin.stop_id;
  const destinationStopId = destination.stop_id;
  const originName =
    resolvedOrigin?.displayName || origin.stop_name?.trim() || undefined;
  const destinationName =
    resolvedDestination?.displayName ||
    destination.stop_name?.trim() ||
    undefined;

  const directionId = linea.Direction_ID;
  const odLabel = buildOdLabel(originName, destinationName);

  let label: string;
  let labelIsFallback = false;
  let fallbackReason: string | undefined;

  if (odLabel) {
    label = odLabel;
  } else {
    labelIsFallback = true;
    label = "Sentido 1";
    const reasons: string[] = [];
    if (!originName) {
      reasons.push("faltó nombre de origen");
    }
    if (!destinationName) {
      reasons.push("faltó nombre de destino");
    }
    if (directionId === undefined || directionId === null) {
      reasons.push("no había Direction_ID");
    }
    fallbackReason = reasons.join("; ") || "origen/destino incompletos";
  }

  return {
    key: buildDirectionKey(
      lineCode,
      directionId,
      originStopId,
      destinationStopId,
    ),
    lineCode,
    originStopId,
    originName,
    destinationStopId,
    destinationName,
    directionId,
    label,
    labelIsFallback,
    fallbackReason,
  };
};

const directionSortValue = (direction: SubwayDirection): number => {
  if (typeof direction.directionId === "number") {
    return direction.directionId;
  }
  const parsed = Number(direction.directionId);
  return Number.isFinite(parsed) ? parsed : Number.POSITIVE_INFINITY;
};

/**
 * Lista sentidos únicos para una línea, deduplicados por clave estable
 * (`lineCode` + `Direction_ID` o par origen/destino), nunca por entity.id.
 */
export const listSubwayDirections = (
  entities: SubteEntityForecast[],
  lineCode: SubwayLineCode | null = null,
  options: ResolveDirectionOptions = {},
): SubwayDirection[] => {
  const byKey = new Map<string, SubwayDirection>();

  for (const entity of entities) {
    const direction = resolveSubwayDirection(entity, options);
    if (!direction) {
      continue;
    }
    if (lineCode && direction.lineCode !== lineCode) {
      continue;
    }
    if (!byKey.has(direction.key)) {
      byKey.set(direction.key, direction);
    }
  }

  const sorted = Array.from(byKey.values()).sort((a, b) => {
    const diff = directionSortValue(a) - directionSortValue(b);
    if (diff !== 0) {
      return diff;
    }
    return a.label.localeCompare(b.label, "es");
  });

  // Reasignar etiquetas neutrales Sentido 1 / Sentido 2 cuando haga falta,
  // en orden estable (no exponer direction_id crudo al usuario).
  let fallbackOrdinal = 1;
  return sorted.map((direction) => {
    if (!direction.labelIsFallback) {
      return direction;
    }
    const ordinal = fallbackOrdinal;
    fallbackOrdinal += 1;
    return {
      ...direction,
      label: `Sentido ${ordinal}`,
    };
  });
};

export const entityMatchesDirection = (
  entity: SubteEntityForecast,
  directionKey: string | null,
  options: ResolveDirectionOptions = {},
): boolean => {
  if (!directionKey) {
    return true;
  }
  const direction = resolveSubwayDirection(entity, options);
  return direction?.key === directionKey;
};
