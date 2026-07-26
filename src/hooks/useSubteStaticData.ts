import { useEffect, useState } from "react";
import { fetchSubteNetwork, fetchSubteStations } from "../services/subteApi";
import type { SubteGeoJsonFeatureCollection } from "../types/subte";

interface UseSubteStaticDataResult {
  network: SubteGeoJsonFeatureCollection | null;
  stations: SubteGeoJsonFeatureCollection | null;
  loading: boolean;
  networkError: string | null;
  stationsError: string | null;
}

export const useSubteStaticData = (): UseSubteStaticDataResult => {
  const [network, setNetwork] = useState<SubteGeoJsonFeatureCollection | null>(
    null,
  );
  const [stations, setStations] =
    useState<SubteGeoJsonFeatureCollection | null>(null);
  const [loading, setLoading] = useState(true);
  const [networkError, setNetworkError] = useState<string | null>(null);
  const [stationsError, setStationsError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      setLoading(true);

      const [networkResult, stationsResult] = await Promise.allSettled([
        fetchSubteNetwork(),
        fetchSubteStations(),
      ]);

      if (cancelled) {
        return;
      }

      if (networkResult.status === "fulfilled") {
        setNetwork(networkResult.value);
        setNetworkError(null);
      } else {
        setNetwork(null);
        setNetworkError(
          networkResult.reason instanceof Error
            ? networkResult.reason.message
            : "No se pudo cargar la red de subtes",
        );
      }

      if (stationsResult.status === "fulfilled") {
        setStations(stationsResult.value);
        setStationsError(null);
      } else {
        setStations(null);
        setStationsError(
          stationsResult.reason instanceof Error
            ? stationsResult.reason.message
            : "No se pudieron cargar las estaciones de subte",
        );
      }

      setLoading(false);
    };

    void load();

    return () => {
      cancelled = true;
    };
  }, []);

  return {
    network,
    stations,
    loading,
    networkError,
    stationsError,
  };
};
