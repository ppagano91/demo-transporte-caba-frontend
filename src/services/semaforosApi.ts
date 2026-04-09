import type { SemaforoItem, SemaforosResponse } from "../types/semaforos";

const SEMAFOROS_API_BASE_URL =
  import.meta.env.VITE_BACKEND_SEMAFOROS_API_BASE ??
  "http://localhost:8000/api/transito/semaforos";

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

const parseSemaforoItem = (value: unknown): SemaforoItem => {
  const item = toRecord(value);
  if (!item) {
    return {};
  }

  return {
    provider: toStringSafe(item.provider),
    type: toStringSafe(item.type),
    code: toStringSafe(item.code),
    name: toStringSafe(item.name),
    status: toStringSafe(item.status),
    latitude: toNumberSafe(item.latitude),
    longitude: toNumberSafe(item.longitude),
  };
};

export const parseSemaforosResponse = (payload: unknown): SemaforosResponse => {
  const root = toRecord(payload);
  const rawItems = Array.isArray(root?.list) ? root.list : [];

  return {
    list: rawItems.map((item) => parseSemaforoItem(item)),
  };
};

export const fetchSemaforos = async (): Promise<SemaforosResponse> => {
  const response = await fetch(SEMAFOROS_API_BASE_URL, {
    cache: "no-store",
  });
  if (!response.ok) {
    throw new Error(`HTTP ${response.status} - ${response.statusText}`);
  }
  const payload: unknown = await response.json();
  return parseSemaforosResponse(payload);
};
