import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { fetchSemaforos } from "../services/semaforosApi";
import type { SemaforoItem, SemaforoMapItem } from "../types/semaforos";

interface UseSemaforosResult {
  semaforos: SemaforoMapItem[];
  loading: boolean;
  error: string | null;
  empty: boolean;
  isRefreshing: boolean;
  lastUpdated: Date | null;
  refreshNow: () => void;
}

const hasValidCoordinates = (latitude: number, longitude: number): boolean => {
  return latitude >= -90 && latitude <= 90 && longitude >= -180 && longitude <= 180;
};

const toMapItems = (items: SemaforoItem[]): SemaforoMapItem[] => {
  return items
    .map((item): SemaforoMapItem | null => {
      if (
        item.latitude === undefined ||
        item.longitude === undefined ||
        !hasValidCoordinates(item.latitude, item.longitude)
      ) {
        return null;
      }

      return {
        provider: item.provider,
        type: item.type,
        code: item.code,
        name: item.name,
        status: item.status,
        latitude: item.latitude,
        longitude: item.longitude,
      };
    })
    .filter((item): item is SemaforoMapItem => item !== null);
};

export const useSemaforos = (): UseSemaforosResult => {
  const [items, setItems] = useState<SemaforoItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

  const inFlightRef = useRef(false);
  const hasLoadedRef = useRef(false);

  const fetchData = useCallback(async () => {
    if (inFlightRef.current) {
      return;
    }

    inFlightRef.current = true;
    setError(null);

    if (hasLoadedRef.current) {
      setIsRefreshing(true);
    } else {
      setLoading(true);
    }

    try {
      const response = await fetchSemaforos();
      setItems(response.list);
      setLastUpdated(new Date());
      hasLoadedRef.current = true;
    } catch (unknownError) {
      const message =
        unknownError instanceof Error
          ? unknownError.message
          : "No se pudo consultar el endpoint de semaforos";
      setError(message);
    } finally {
      setLoading(false);
      setIsRefreshing(false);
      inFlightRef.current = false;
    }
  }, []);

  useEffect(() => {
    void fetchData();
  }, [fetchData]);

  const semaforos = useMemo(() => toMapItems(items), [items]);

  return {
    semaforos,
    loading,
    error,
    empty: !loading && !error && semaforos.length === 0,
    isRefreshing,
    lastUpdated,
    refreshNow: () => {
      void fetchData();
    },
  };
};
