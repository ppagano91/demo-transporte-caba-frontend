import { useCallback, useEffect, useRef, useState } from 'react'
import { fetchVehiclePositionsSimple } from '../services/transportApi'
import type { VehiclePosition } from '../types/vehicle'

interface UseVehiclePositionsParams {
  routeId?: string
  agencyId?: string
  enabled: boolean
  refreshIntervalMs: number
}

interface UseVehiclePositionsResult {
  vehicles: VehiclePosition[]
  loading: boolean
  error: string | null
  empty: boolean
  lastUpdated: Date | null
  isRefreshing: boolean
  refreshNow: () => void
}

export const useVehiclePositions = ({
  routeId,
  agencyId,
  enabled,
  refreshIntervalMs,
}: UseVehiclePositionsParams): UseVehiclePositionsResult => {
  const [vehicles, setVehicles] = useState<VehiclePosition[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null)
  const [isRefreshing, setIsRefreshing] = useState(false)

  const inFlightRef = useRef(false)
  const hasLoadedRef = useRef(false)

  const fetchData = useCallback(async () => {
    if (!enabled) {
      return
    }

    if (inFlightRef.current) {
      return
    }

    inFlightRef.current = true
    setError(null)

    if (hasLoadedRef.current) {
      setIsRefreshing(true)
    } else {
      setLoading(true)
    }

    try {
      const nextVehicles = await fetchVehiclePositionsSimple({ routeId, agencyId })
      setVehicles(nextVehicles)
      setLastUpdated(new Date())
      hasLoadedRef.current = true
    } catch (unknownError) {
      const message =
        unknownError instanceof Error
          ? unknownError.message
          : 'No se pudo consultar el endpoint'
      setError(message)
    } finally {
      setLoading(false)
      setIsRefreshing(false)
      inFlightRef.current = false
    }
  }, [agencyId, enabled, routeId])

  useEffect(() => {
    if (!enabled) {
      setVehicles([])
      setLoading(false)
      setError(null)
      setIsRefreshing(false)
      setLastUpdated(null)
      hasLoadedRef.current = false
      return
    }

    void fetchData()
  }, [enabled, fetchData])

  useEffect(() => {
    if (!enabled) {
      return
    }

    const intervalId = window.setInterval(() => {
      void fetchData()
    }, refreshIntervalMs)

    return () => {
      window.clearInterval(intervalId)
    }
  }, [enabled, fetchData, refreshIntervalMs])

  return {
    vehicles,
    loading,
    error,
    empty: !loading && !error && vehicles.length === 0,
    lastUpdated,
    isRefreshing,
    refreshNow: () => {
      void fetchData()
    },
  }
}
