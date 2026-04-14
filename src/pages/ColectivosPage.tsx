import { useState } from "react";
import MapView from "../components/MapView";
import SectionOverview from "../components/SectionOverview";
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
  const activeFilterLabel = hasActiveFilter
    ? [
        appliedRouteId ? `route_id=${appliedRouteId}` : null,
        appliedAgencyId ? `agency_id=${appliedAgencyId}` : null,
      ]
        .filter(Boolean)
        .join(" • ")
    : "Sin filtros";

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
    <section className="colectivos-page">
      <section className="page-split-layout">
        <div className="page-split-sidebar">
          <SectionOverview
            kicker="Operacion"
            title="Monitoreo de colectivos"
            // description="El resumen operativo, el estado de actualizacion y los controles viven en un panel lateral para despejar la entrada del mapa."
            actions={
              <>
                <button
                  className="secondary"
                  onClick={refreshNow}
                  disabled={loading || !hasActiveFilter}
                >
                  Actualizar ahora
                </button>

                <select
                  value={refreshIntervalMs}
                  onChange={(event) =>
                    setRefreshIntervalMs(Number(event.target.value))
                  }
                >
                  <option value={5000}>5s</option>
                  <option value={10000}>10s</option>
                  <option value={30000}>30s</option>
                  <option value={60000}>1m</option>
                </select>
              </>
            }
            metrics={[
              { label: "Vehiculos visibles", value: vehicles.length },
              {
                label: "Filtro aplicado",
                value: activeFilterLabel,
                tone: hasActiveFilter ? "accent" : "default",
              },
              { label: "Color marcador", value: markerColor.toUpperCase() },
            ]}
            isRefreshing={isRefreshing}
            lastUpdated={lastUpdated}
          />

          <Toolbar
            routeIdInput={draftRouteId}
            onRouteIdInputChange={setDraftRouteId}
            agencyIdInput={draftAgencyId}
            onAgencyIdInputChange={setDraftAgencyId}
            markerColor={markerColor}
            onMarkerColorChange={setMarkerColor}
            onApplyFilter={handleApplyFilter}
            onClearFilter={handleClearFilter}
            hasActiveFilter={hasActiveFilter}
            canSearch={canSearch}
            loading={loading}
          />

          {error && (
            <div className="state-banner-static error">Error: {error}</div>
          )}
          {!error && loading && (
            <div className="state-banner-static loading">
              Cargando posiciones...
            </div>
          )}
          {!error && !loading && !hasActiveFilter && (
            <div className="state-banner-static empty">
              Ingresa route_id o agency_id para buscar vehiculos.
            </div>
          )}
          {!error && !loading && hasActiveFilter && empty && (
            <div className="state-banner-static empty">
              Sin resultados para los filtros actuales.
            </div>
          )}
        </div>

        <div className="page-split-main">
          <article className="map-feature-card">
            <div className="map-feature-header">
              <div className="map-feature-heading">
                <p className="section-kicker">Vista principal</p>
                <h2>Mapa de vehiculos</h2>
                <p className="map-feature-copy">
                  El mapa queda como foco principal desde el primer vistazo para
                  facilitar la exploracion del servicio.
                </p>
              </div>
              <div className="map-feature-badges">
                <span className="badge">{vehicles.length} visibles</span>
                <span className={`badge ${hasActiveFilter ? "filtered" : ""}`}>
                  {hasActiveFilter ? "Filtros activos" : "Sin filtros"}
                </span>
              </div>
            </div>

            <section className="map-panel">
              <MapView
                vehicles={vehicles}
                markerBackgroundColor={markerColor}
              />
            </section>
          </article>
        </div>
      </section>
    </section>
  );
}

export default ColectivosPage;
