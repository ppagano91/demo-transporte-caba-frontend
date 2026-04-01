import type {
  StationInformationItem,
  StationInformationResponse,
  StationStatusItem,
  StationStatusResponse,
} from "../types/ecobici";

const STATION_INFORMATION_API_BASE_URL =
  import.meta.env.VITE_BACKEND_ECOBICI_STATION_INFORMATION_API_BASE ??
  "http://localhost:8000/api/ecobici/station-information";

const STATION_STATUS_API_BASE_URL =
  import.meta.env.VITE_BACKEND_ECOBICI_STATION_STATUS_API_BASE ??
  "http://localhost:8000/api/ecobici/station-status";

const toRecord = (value: unknown): Record<string, unknown> | undefined => {
  if (value && typeof value === "object") {
    return value as Record<string, unknown>;
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

const toBooleanSafe = (value: unknown): boolean | undefined => {
  if (typeof value === "boolean") {
    return value;
  }
  return undefined;
};

const toStringArraySafe = (value: unknown): string[] => {
  if (!Array.isArray(value)) {
    return [];
  }
  return value
    .map((item) => toStringSafe(item))
    .filter((item): item is string => item !== undefined);
};

const parseStationInformationItem = (value: unknown): StationInformationItem => {
  const station = toRecord(value);
  if (!station) {
    return {};
  }

  return {
    station_id: toStringSafe(station.station_id),
    external_id: toStringSafe(station.external_id),
    name: toStringSafe(station.name),
    lat: toNumberSafe(station.lat),
    lon: toNumberSafe(station.lon),
    address: toStringSafe(station.address),
    capacity: toNumberSafe(station.capacity),
    is_charging_station: toBooleanSafe(station.is_charging_station),
    rental_methods: toStringArraySafe(station.rental_methods),
    groups: toStringArraySafe(station.groups),
    short_name: toStringSafe(station.short_name),
  };
};

const parseStationStatusItem = (value: unknown): StationStatusItem => {
  const station = toRecord(value);
  if (!station) {
    return {};
  }
  const availableTypes = toRecord(station.num_bikes_available_types);

  return {
    station_id: toStringSafe(station.station_id),
    num_bikes_available: toNumberSafe(station.num_bikes_available),
    num_bikes_disabled: toNumberSafe(station.num_bikes_disabled),
    status: toStringSafe(station.status),
    num_bikes_available_types: {
      mechanical: toNumberSafe(availableTypes?.mechanical),
      ebike: toNumberSafe(availableTypes?.ebike),
    },
    num_docks_available: toNumberSafe(station.num_docks_available),
    num_docks_disabled: toNumberSafe(station.num_docks_disabled),
    last_reported: toNumberSafe(station.last_reported),
    is_installed: toNumberSafe(station.is_installed),
    is_renting: toNumberSafe(station.is_renting),
    is_returning: toNumberSafe(station.is_returning),
    is_charging_station: toBooleanSafe(station.is_charging_station),
  };
};

export const parseStationInformationResponse = (
  payload: unknown,
): StationInformationResponse => {
  const root = toRecord(payload);
  const data = toRecord(root?.data);
  const rawStations = Array.isArray(data?.stations) ? data?.stations : [];

  return {
    last_updated: toNumberSafe(root?.last_updated),
    ttl: toNumberSafe(root?.ttl),
    data: {
      stations: rawStations.map((item) => parseStationInformationItem(item)),
    },
  };
};

export const parseStationStatusResponse = (
  payload: unknown,
): StationStatusResponse => {
  const root = toRecord(payload);
  const data = toRecord(root?.data);
  const rawStations = Array.isArray(data?.stations) ? data?.stations : [];

  return {
    last_updated: toNumberSafe(root?.last_updated),
    ttl: toNumberSafe(root?.ttl),
    data: {
      stations: rawStations.map((item) => parseStationStatusItem(item)),
    },
  };
};

export const fetchStationInformation =
  async (): Promise<StationInformationResponse> => {
    const response = await fetch(STATION_INFORMATION_API_BASE_URL, {
      cache: "no-store",
    });
    if (!response.ok) {
      throw new Error(`HTTP ${response.status} - ${response.statusText}`);
    }
    const payload: unknown = await response.json();
    return parseStationInformationResponse(payload);
  };

export const fetchStationStatus = async (): Promise<StationStatusResponse> => {
  const response = await fetch(STATION_STATUS_API_BASE_URL, {
    cache: "no-store",
  });
  if (!response.ok) {
    throw new Error(`HTTP ${response.status} - ${response.statusText}`);
  }
  const payload: unknown = await response.json();
  return parseStationStatusResponse(payload);
};
