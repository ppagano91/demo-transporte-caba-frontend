import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  fetchStationInformation,
  fetchStationStatus,
} from "../services/ecobiciApi";
import type {
  EcobiciStationMerged,
  StationInformationItem,
  StationStatusItem,
} from "../types/ecobici";

interface UseEcobiciStationsParams {
  refreshIntervalMs: number;
}

interface UseEcobiciStationsResult {
  stations: EcobiciStationMerged[];
  loading: boolean;
  error: string | null;
  empty: boolean;
  isRefreshing: boolean;
  lastUpdated: Date | null;
  refreshNow: () => void;
}

const hasValidCoordinates = (lat: number, lon: number): boolean => {
  return lat >= -90 && lat <= 90 && lon >= -180 && lon <= 180;
};

const mergeStations = (
  informationStations: StationInformationItem[],
  statusStations: StationStatusItem[],
): EcobiciStationMerged[] => {
  const statusByStationId = new Map<string, StationStatusItem>();

  for (const statusItem of statusStations) {
    const stationId = statusItem.station_id?.trim();
    if (!stationId) {
      continue;
    }
    statusByStationId.set(stationId, statusItem);
  }

  return informationStations
    .map((info): EcobiciStationMerged | null => {
      const stationId = info.station_id?.trim();
      if (!stationId) {
        return null;
      }
      if (
        info.lat === undefined ||
        info.lon === undefined ||
        !hasValidCoordinates(info.lat, info.lon)
      ) {
        return null;
      }

      const status = statusByStationId.get(stationId);
      const groups = info.groups ?? [];
      const rentalMethods = info.rental_methods ?? [];

      return {
        station_id: stationId,
        external_id: info.external_id,
        name: info.name,
        lat: info.lat,
        lon: info.lon,
        address: info.address,
        capacity: info.capacity,
        groups,
        short_name: info.short_name,
        rental_methods: rentalMethods,
        is_charging_station:
          status?.is_charging_station ?? info.is_charging_station,
        status: status?.status,
        num_bikes_available: status?.num_bikes_available,
        num_bikes_disabled: status?.num_bikes_disabled,
        mechanical: status?.num_bikes_available_types?.mechanical,
        ebike: status?.num_bikes_available_types?.ebike,
        num_docks_available: status?.num_docks_available,
        num_docks_disabled: status?.num_docks_disabled,
        last_reported: status?.last_reported,
        is_installed: status?.is_installed,
        is_renting: status?.is_renting,
        is_returning: status?.is_returning,
        hasStatus: status !== undefined,
      };
    })
    .filter((station): station is EcobiciStationMerged => station !== null);
};

export const useEcobiciStations = ({
  refreshIntervalMs,
}: UseEcobiciStationsParams): UseEcobiciStationsResult => {
  const [informationStations, setInformationStations] = useState<
    StationInformationItem[]
  >([]);
  const [statusStations, setStatusStations] = useState<StationStatusItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

  const inFlightRef = useRef(false);
  const infoLoadedRef = useRef(false);
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
      if (!infoLoadedRef.current) {
        const infoResponse = await fetchStationInformation();
        setInformationStations(infoResponse.data.stations);
        infoLoadedRef.current = true;
      }

      const statusResponse = await fetchStationStatus();
      setStatusStations(statusResponse.data.stations);
      setLastUpdated(new Date());
      hasLoadedRef.current = true;
    } catch (unknownError) {
      const message =
        unknownError instanceof Error
          ? unknownError.message
          : "No se pudo consultar los endpoints de Ecobici";
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
    const intervalId = window.setInterval(() => {
      void fetchData();
    }, refreshIntervalMs);

    return () => {
      window.clearInterval(intervalId);
    };
  }, [fetchData, refreshIntervalMs]);

  const stations = useMemo(
    () => mergeStations(informationStations, statusStations),
    [informationStations, statusStations],
  );

  return {
    stations,
    loading,
    error,
    empty: !loading && !error && stations.length === 0,
    isRefreshing,
    lastUpdated,
    refreshNow: () => {
      void fetchData();
    },
  };
};
