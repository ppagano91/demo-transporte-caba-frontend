import { useCallback, useEffect, useRef, useState } from "react";
import { fetchSubteForecast } from "../services/subteApi";
import type { SubteForecastResponse } from "../types/subte";

interface UseSubteForecastParams {
  refreshIntervalMs: number;
  autoRefreshEnabled: boolean;
}

interface UseSubteForecastResult {
  data: SubteForecastResponse | null;
  loading: boolean;
  error: string | null;
  empty: boolean;
  isRefreshing: boolean;
  lastUpdated: Date | null;
  refreshNow: () => void;
}

export const useSubteForecast = ({
  refreshIntervalMs,
  autoRefreshEnabled,
}: UseSubteForecastParams): UseSubteForecastResult => {
  const [data, setData] = useState<SubteForecastResponse | null>(null);
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
      const nextData = await fetchSubteForecast();
      setData(nextData);
      setLastUpdated(new Date());
      hasLoadedRef.current = true;
    } catch (unknownError) {
      const message =
        unknownError instanceof Error
          ? unknownError.message
          : "No pudimos cargar las próximas llegadas.";
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

  useEffect(() => {
    if (!autoRefreshEnabled) {
      return;
    }

    const intervalId = window.setInterval(() => {
      void fetchData();
    }, refreshIntervalMs);

    return () => {
      window.clearInterval(intervalId);
    };
  }, [autoRefreshEnabled, fetchData, refreshIntervalMs]);

  return {
    data,
    loading,
    error,
    empty: !loading && !error && (data?.entities.length ?? 0) === 0,
    isRefreshing,
    lastUpdated,
    refreshNow: () => {
      void fetchData();
    },
  };
};
