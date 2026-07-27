import { buildApiUrl, toUserFacingFetchError } from "../config/api";
import { parseSubwayLineCode } from "../constants/subwayLines";
import type {
  SubteEntityForecast,
  SubteForecastResponse,
  SubteGeoJsonFeature,
  SubteGeoJsonFeatureCollection,
  SubteLineaForecast,
  SubteStationForecast,
} from "../types/subte";

const SUBTE_API_BASE_URL =
  import.meta.env.VITE_BACKEND_SUBTE_API_BASE ?? buildApiUrl("subtes");

const SUBTE_FORECAST_API_BASE_URL =
  import.meta.env.VITE_BACKEND_SUBTE_FORECAST_API_BASE ??
  `${SUBTE_API_BASE_URL.replace(/\/+$/, "")}/forecast`;

const SUBTE_NETWORK_API_BASE_URL =
  import.meta.env.VITE_BACKEND_SUBTE_NETWORK_API_BASE ??
  `${SUBTE_API_BASE_URL.replace(/\/+$/, "")}/network`;

const SUBTE_STATIONS_API_BASE_URL =
  import.meta.env.VITE_BACKEND_SUBTE_STATIONS_API_BASE ??
  `${SUBTE_API_BASE_URL.replace(/\/+$/, "")}/stations`;

const toRecord = (value: unknown): Record<string, unknown> | undefined => {
  if (value && typeof value === "object") {
    return value as Record<string, unknown>;
  }
  return undefined;
};

const toNumberSafe = (value: unknown): number | undefined => {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }
  if (typeof value === "string") {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) {
      return parsed;
    }
  }
  return undefined;
};

const toStringSafe = (value: unknown): string | undefined => {
  if (typeof value === "string") {
    const trimmed = value.trim();
    return trimmed.length > 0 ? trimmed : undefined;
  }
  if (typeof value === "number" && Number.isFinite(value)) {
    return String(value);
  }
  return undefined;
};

const parseStation = (value: unknown): SubteStationForecast | null => {
  const station = toRecord(value);
  if (!station) {
    return null;
  }

  const arrival = toRecord(station.arrival);
  const departure = toRecord(station.departure);

  return {
    stop_id: toStringSafe(station.stop_id),
    stop_name: toStringSafe(station.stop_name),
    arrival: arrival
      ? {
          time: toNumberSafe(arrival.time),
          delay: toNumberSafe(arrival.delay),
        }
      : undefined,
    departure: departure
      ? {
          time: toNumberSafe(departure.time),
          delay: toNumberSafe(departure.delay),
        }
      : undefined,
  };
};

const parseLinea = (value: unknown): SubteLineaForecast | undefined => {
  const linea = toRecord(value);
  if (!linea) {
    return undefined;
  }

  const rawStations = Array.isArray(linea.Estaciones) ? linea.Estaciones : [];

  return {
    Trip_Id: toStringSafe(linea.Trip_Id),
    Route_Id: toStringSafe(linea.Route_Id),
    Direction_ID: toNumberSafe(linea.Direction_ID),
    start_time: toStringSafe(linea.start_time),
    start_date: toStringSafe(linea.start_date),
    Estaciones: rawStations
      .map((station): SubteStationForecast | null => parseStation(station))
      .filter((station): station is SubteStationForecast => station !== null),
  };
};

export const parseSubteForecastResponse = (
  payload: unknown,
): SubteForecastResponse => {
  const root = toRecord(payload);
  if (!root) {
    return { headerTimestamp: undefined, entities: [] };
  }

  const header = toRecord(root.Header);
  const rawEntities = Array.isArray(root.Entity) ? root.Entity : [];

  const entities: SubteEntityForecast[] = rawEntities
    .map((item): SubteEntityForecast | null => {
      const entity = toRecord(item);
      if (!entity) {
        return null;
      }
      return {
        ID: toStringSafe(entity.ID),
        Linea: parseLinea(entity.Linea),
      };
    })
    .filter((item): item is SubteEntityForecast => item !== null);

  return {
    headerTimestamp: toNumberSafe(header?.timestamp),
    entities,
  };
};

export const fetchSubteForecast = async (): Promise<SubteForecastResponse> => {
  try {
    const response = await fetch(SUBTE_FORECAST_API_BASE_URL, {
      cache: "no-store",
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    const payload: unknown = await response.json();
    return parseSubteForecastResponse(payload);
  } catch (error) {
    throw new Error(
      toUserFacingFetchError(error, "No pudimos cargar las próximas llegadas."),
    );
  }
};

const toStringProp = (value: unknown): string | undefined => {
  if (typeof value === "string") {
    const trimmed = value.trim();
    return trimmed.length > 0 ? trimmed : undefined;
  }
  if (typeof value === "number" && Number.isFinite(value)) {
    return String(value);
  }
  return undefined;
};

const enrichFeatureLineCode = (
  feature: SubteGeoJsonFeature,
  lineHints: Array<string | undefined>,
): SubteGeoJsonFeature => {
  const properties = feature.properties ?? {};
  const lineCode =
    parseSubwayLineCode(lineHints.find(Boolean) ?? null) ?? null;

  return {
    ...feature,
    properties: {
      ...properties,
      lineCode,
    },
  };
};

export const parseSubteGeoJsonFeatureCollection = (
  payload: unknown,
  kind: "network" | "stations",
): SubteGeoJsonFeatureCollection => {
  const root = toRecord(payload);
  if (!root || root.type !== "FeatureCollection") {
    return { type: "FeatureCollection", features: [] };
  }

  const rawFeatures = Array.isArray(root.features) ? root.features : [];
  const features: SubteGeoJsonFeature[] = [];

  for (const item of rawFeatures) {
    const feature = toRecord(item);
    if (!feature || feature.type !== "Feature") {
      continue;
    }

    const geometry = feature.geometry;
    if (!geometry || typeof geometry !== "object") {
      continue;
    }

    const properties = toRecord(feature.properties) ?? {};
    const baseFeature: SubteGeoJsonFeature = {
      type: "Feature",
      geometry: geometry as SubteGeoJsonFeature["geometry"],
      properties,
      id:
        typeof feature.id === "string" || typeof feature.id === "number"
          ? feature.id
          : undefined,
    };

    if (kind === "network") {
      features.push(
        enrichFeatureLineCode(baseFeature, [
          toStringProp(properties.fna),
          toStringProp(properties.nam),
        ]),
      );
      continue;
    }

    features.push(
      enrichFeatureLineCode(baseFeature, [
        toStringProp(properties.ral),
        toStringProp(properties.fna),
        toStringProp(properties.nam),
      ]),
    );
  }

  return {
    type: "FeatureCollection",
    features,
  };
};

const fetchSubteGeoJson = async (
  url: string,
  kind: "network" | "stations",
  friendlyError: string,
): Promise<SubteGeoJsonFeatureCollection> => {
  try {
    const response = await fetch(url, { cache: "force-cache" });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    const payload: unknown = await response.json();
    return parseSubteGeoJsonFeatureCollection(payload, kind);
  } catch (error) {
    throw new Error(toUserFacingFetchError(error, friendlyError));
  }
};

export const fetchSubteNetwork =
  async (): Promise<SubteGeoJsonFeatureCollection> => {
    return fetchSubteGeoJson(
      SUBTE_NETWORK_API_BASE_URL,
      "network",
      "No pudimos cargar los recorridos.",
    );
  };

export const fetchSubteStations =
  async (): Promise<SubteGeoJsonFeatureCollection> => {
    return fetchSubteGeoJson(
      SUBTE_STATIONS_API_BASE_URL,
      "stations",
      "No pudimos cargar las estaciones.",
    );
  };
