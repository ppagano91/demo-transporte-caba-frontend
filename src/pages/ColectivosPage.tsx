import { useState } from "react";
import MapView from "../components/MapView";
import Toolbar from "../components/Toolbar";
import { useVehiclePositions } from "../hooks/useVehiclePositions";

function ColectivosPage() {
  const [draftRouteId, setDraftRouteId] = useState("");
  const [draftAgencyId, setDraftAgencyId] = useState("");
  const [appliedRouteId, setAppliedRouteId] = useState("");
  const [appliedAgencyId, setAppliedAgencyId] = useState("");
  const [markerColor, setMarkerColor] = useState("rgb(30, 20, 240)");
  const [refreshIntervalMs, setRefreshIntervalMs] = useState(30000);
  const canSearch =
    draftRouteId.trim().length > 0 || draftAgencyId.trim().length > 0;
  const hasActiveFilter =
    appliedRouteId.trim().length > 0 || appliedAgencyId.trim().length > 0;

  const {
    vehicles,
    loading,
    error,
    empty,
    lastUpdated,
    isRefreshing,
    refreshNow,
  } = useVehiclePositions({
    routeId: appliedRouteId,
    agencyId: appliedAgencyId,
    enabled: hasActiveFilter,
    refreshIntervalMs,
  });

  const handleApplyFilter = () => {
    if (!canSearch) {
      return;
    }
    setAppliedRouteId(draftRouteId.trim());
    setAppliedAgencyId(draftAgencyId.trim());
  };

  const handleClearFilter = () => {
    setDraftRouteId("");
    setDraftAgencyId("");
    setAppliedRouteId("");
    setAppliedAgencyId("");
  };

  return (
    <>
      <header className="app-header">
        <h1>Demo Visor Colectivos GCBA</h1>
        <p>Visualizacion en tiempo real de posiciones de vehiculos.</p>
      </header>

      <Toolbar
        routeIdInput={draftRouteId}
        onRouteIdInputChange={setDraftRouteId}
        agencyIdInput={draftAgencyId}
        onAgencyIdInputChange={setDraftAgencyId}
        markerColor={markerColor}
        onMarkerColorChange={setMarkerColor}
        onApplyFilter={handleApplyFilter}
        onClearFilter={handleClearFilter}
        onRefreshNow={refreshNow}
        refreshIntervalMs={refreshIntervalMs}
        onRefreshIntervalChange={setRefreshIntervalMs}
        lastUpdated={lastUpdated}
        totalVehicles={vehicles.length}
        hasActiveFilter={hasActiveFilter}
        appliedRouteId={appliedRouteId}
        appliedAgencyId={appliedAgencyId}
        canSearch={canSearch}
        loading={loading}
        isRefreshing={isRefreshing}
      />

      <section className="map-panel">
        {error && <div className="state-banner error">Error: {error}</div>}
        {!error && loading && (
          <div className="state-banner loading">Cargando posiciones...</div>
        )}
        {!error && !loading && !hasActiveFilter && (
          <div className="state-banner empty">
            Ingresa route_id o agency_id para buscar vehiculos.
          </div>
        )}
        {!error && !loading && hasActiveFilter && empty && (
          <div className="state-banner empty">
            Sin resultados para los filtros actuales.
          </div>
        )}
        <MapView vehicles={vehicles} markerBackgroundColor={markerColor} />
      </section>
    </>
  );
}

export default ColectivosPage;
