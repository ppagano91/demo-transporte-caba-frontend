import type { VehiclePosition, VehicleQueryParams } from "../types/vehicle";

const API_BASE_URL =
  import.meta.env.VITE_BACKEND_API_BASE ??
  "http://localhost:8000/api/vehicle-positions";
const API_SIMPLE_BASE_URL =
  import.meta.env.VITE_BACKEND_API_BASE_SIMPLE ??
  "http://localhost:8000/api/vehicle-positions-simple";

const toRecord = (value: unknown): Record<string, unknown> | undefined => {
  if (value && typeof value === "object") {
    return value as Record<string, unknown>;
  }
  return undefined;
};

const readProp = (source: unknown, ...keys: string[]): unknown => {
  const record = toRecord(source);
  if (!record) {
    return undefined;
  }
  for (const key of keys) {
    const value = record[key];
    if (value !== undefined && value !== null) {
      return value;
    }
  }
  return undefined;
};

const toStringSafe = (value: unknown): string | undefined => {
  if (typeof value === "string") {
    return value.trim() || undefined;
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

const hasValidCoordinates = (lat: number, lon: number): boolean => {
  return lat >= -90 && lat <= 90 && lon >= -180 && lon <= 180;
};

export const buildVehiclePositionsUrl = ({
  routeId,
}: VehicleQueryParams = {}): string => {
  const url = new URL(API_BASE_URL);

  const trimmedRouteId = routeId?.trim();
  if (trimmedRouteId) {
    url.searchParams.set("route_id", trimmedRouteId);
  }

  return url.toString();
};

export const parseVehiclePositionsResponse = (
  payload: unknown,
): VehiclePosition[] => {
  const root = toRecord(payload);
  const rawEntities = readProp(root, "_entity", "entity") || root;
  if (!Array.isArray(rawEntities)) {
    return [];
  }

  return rawEntities
    .map((entity, index): VehiclePosition | null => {
      const vehicleNode = readProp(entity, "_vehicle", "vehicle");
      const positionNode = readProp(vehicleNode, "_position", "position");
      const tripNode = readProp(vehicleNode, "_trip", "trip");
      const innerVehicleNode = readProp(vehicleNode, "_vehicle", "vehicle");

      const latitude = toNumberSafe(
        readProp(positionNode, "_latitude", "latitude"),
      );
      const longitude = toNumberSafe(
        readProp(positionNode, "_longitude", "longitude"),
      );

      if (
        latitude === undefined ||
        longitude === undefined ||
        !hasValidCoordinates(latitude, longitude)
      ) {
        return null;
      }

      const vehicleId = toStringSafe(readProp(innerVehicleNode, "_id", "id"));
      const tripId = toStringSafe(readProp(tripNode, "_trip_id", "trip_id"));
      const timestamp = toNumberSafe(
        readProp(vehicleNode, "_timestamp", "timestamp"),
      );

      return {
        id:
          vehicleId ?? `${tripId ?? "veh"}-${timestamp ?? Date.now()}-${index}`,
        vehicleId,
        label: toStringSafe(readProp(innerVehicleNode, "_label", "label")),
        licensePlate: toStringSafe(
          readProp(innerVehicleNode, "_license_plate", "license_plate"),
        ),
        routeId: toStringSafe(readProp(tripNode, "_route_id", "route_id")),
        tripId,
        directionId: toStringSafe(
          readProp(tripNode, "_direction_id", "direction_id"),
        ),
        stopId: toStringSafe(readProp(vehicleNode, "_stop_id", "stop_id")),
        timestamp,
        latitude,
        longitude,
        speed: toNumberSafe(readProp(positionNode, "_speed", "speed")),
        currentStatus: toStringSafe(
          readProp(vehicleNode, "_current_status", "current_status"),
        ),
        currentStopSequence: toNumberSafe(
          readProp(
            vehicleNode,
            "_current_stop_sequence",
            "current_stop_sequence",
          ),
        ),
      };
    })
    .filter((vehicle): vehicle is VehiclePosition => vehicle !== null);
};

export const fetchVehiclePositions = async (
  params: VehicleQueryParams = {},
): Promise<VehiclePosition[]> => {
  const url = buildVehiclePositionsUrl(params);
  const response = await fetch(url, { cache: "no-store" });

  if (!response.ok) {
    throw new Error(`HTTP ${response.status} - ${response.statusText}`);
  }

  const payload: unknown = await response.json();
  return parseVehiclePositionsResponse(payload);
};

export const buildVehiclePositionsSimpleUrl = ({
  routeId,
  agencyId,
}: VehicleQueryParams = {}): string => {
  const url = new URL(API_SIMPLE_BASE_URL);

  const trimmedRouteId = routeId?.trim();
  if (trimmedRouteId) {
    url.searchParams.set("route_id", trimmedRouteId);
  }

  const trimmedAgencyId = agencyId?.trim();
  if (trimmedAgencyId) {
    url.searchParams.set("agency_id", trimmedAgencyId);
  }

  return url.toString();
};

export const parseVehiclePositionsSimpleResponse = (
  payload: unknown,
): VehiclePosition[] => {
  if (!Array.isArray(payload)) {
    return [];
  }

  return payload
    .map((item, index): VehiclePosition | null => {
      const latitude = toNumberSafe(readProp(item, "latitude"));
      const longitude = toNumberSafe(readProp(item, "longitude"));

      if (
        latitude === undefined ||
        longitude === undefined ||
        !hasValidCoordinates(latitude, longitude)
      ) {
        return null;
      }

      const sourceId = toStringSafe(readProp(item, "id"));
      const routeId = toStringSafe(readProp(item, "route_id"));
      const agencyId = toStringSafe(readProp(item, "agency_id"));
      const timestamp = toNumberSafe(readProp(item, "timestamp"));

      return {
        id: sourceId ?? `${routeId ?? "route"}-${agencyId ?? "agency"}-${index}`,
        sourceId,
        routeId,
        agencyId,
        agencyName: toStringSafe(readProp(item, "agency_name")),
        route_short_name: toStringSafe(readProp(item, "route_short_name")),
        directionId: toStringSafe(readProp(item, "direction")),
        tipId: toStringSafe(readProp(item, "tip_id")),
        tripHeadsign: toStringSafe(readProp(item, "trip_headsign")),
        timestamp,
        latitude,
        longitude,
        speed: toNumberSafe(readProp(item, "speed")),
      };
    })
    .filter((vehicle): vehicle is VehiclePosition => vehicle !== null);
};

export const fetchVehiclePositionsSimple = async (
  params: VehicleQueryParams = {},
): Promise<VehiclePosition[]> => {
  const url = buildVehiclePositionsSimpleUrl(params);
  const response = await fetch(url, { cache: "no-store" });

  if (!response.ok) {
    throw new Error(`HTTP ${response.status} - ${response.statusText}`);
  }

  const payload: unknown = await response.json();
  return parseVehiclePositionsSimpleResponse(payload);
};
