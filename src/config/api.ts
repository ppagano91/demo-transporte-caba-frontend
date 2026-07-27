/**
 * Base path centralizado para el backend.
 *
 * Desarrollo: VITE_API_BASE_URL=/api (proxy de Vite → 127.0.0.1:8000)
 * Producción: VITE_API_BASE_URL=https://api.ejemplo.com/api (u otro origen público)
 */
const DEFAULT_API_BASE_URL = "/api";

const trimTrailingSlashes = (value: string): string =>
  value.replace(/\/+$/, "");

const trimLeadingSlashes = (value: string): string =>
  value.replace(/^\/+/, "");

const resolveApiBaseUrl = (): string => {
  const raw = (
    import.meta.env.VITE_API_BASE_URL as string | undefined
  )?.trim();
  if (!raw) {
    return DEFAULT_API_BASE_URL;
  }
  return trimTrailingSlashes(raw) || DEFAULT_API_BASE_URL;
};

/** Base URL o path del API (sin barra final). */
export const API_BASE_URL = resolveApiBaseUrl();

/**
 * Construye una URL de API sin barras duplicadas.
 * Acepta base relativa (`/api`) o absoluta (`https://host/api`).
 */
export const buildApiUrl = (
  path: string,
  query?: Record<string, string | undefined | null>,
): string => {
  const normalizedPath = trimLeadingSlashes(path.trim());
  const base = API_BASE_URL;

  let url: string;
  if (/^https?:\/\//i.test(base)) {
    url = normalizedPath
      ? `${trimTrailingSlashes(base)}/${normalizedPath}`
      : trimTrailingSlashes(base);
  } else {
    const basePath = base.startsWith("/") ? base : `/${base}`;
    url = normalizedPath
      ? `${trimTrailingSlashes(basePath)}/${normalizedPath}`
      : trimTrailingSlashes(basePath) || "/";
  }

  if (!query) {
    return url;
  }

  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(query)) {
    if (value === undefined || value === null) {
      continue;
    }
    const trimmed = value.trim();
    if (trimmed) {
      params.set(key, trimmed);
    }
  }

  const qs = params.toString();
  return qs ? `${url}?${qs}` : url;
};

/** Mensaje amigable a partir de un fallo de red/HTTP (sin detalles técnicos). */
export const toUserFacingFetchError = (
  error: unknown,
  fallbackMessage: string,
): string => {
  if (import.meta.env.DEV && error instanceof Error && error.message) {
    // Log interno para desarrollo; la UI solo ve el mensaje amigable.
    console.warn("[api]", fallbackMessage, error.message);
  }
  return fallbackMessage;
};
