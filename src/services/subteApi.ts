import type {
  SubteEntityForecast,
  SubteForecastResponse,
  SubteLineaForecast,
  SubteStationForecast,
} from "../types/subte";

const SUBTE_FORECAST_API_BASE_URL =
  import.meta.env.VITE_BACKEND_SUBTE_FORECAST_API_BASE ??
  "http://localhost:8000/api/subtes/forecast";

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
  const response = await fetch(SUBTE_FORECAST_API_BASE_URL, {
    cache: "no-store",
  });

  if (!response.ok) {
    throw new Error(`HTTP ${response.status} - ${response.statusText}`);
  }

  const payload: unknown = await response.json();
  return parseSubteForecastResponse(payload);
};
