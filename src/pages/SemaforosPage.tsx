import SemaforosMapView from "../components/SemaforosMapView";
import SectionOverview from "../components/SectionOverview";
import { useSemaforos } from "../hooks/useSemaforos";

function SemaforosPage() {
  const {
    semaforos,
    loading,
    error,
    empty,
    isRefreshing,
    lastUpdated,
    refreshNow,
  } = useSemaforos();

  return (
    <section className="semaforos-page">
      <section className="page-split-layout">
        <div className="page-split-sidebar">
          <SectionOverview
            kicker="Operacion"
            title="Estado de semaforos"
            // description="El resumen, las metricas y la accion de refresco quedan en un panel lateral para liberar la primera visualizacion del mapa."
            actions={
              <button
                className="secondary"
                onClick={refreshNow}
                disabled={loading || isRefreshing}
              >
                Actualizar ahora
              </button>
            }
            metrics={[{ label: "Semaforos visibles", value: semaforos.length }]}
            isRefreshing={isRefreshing}
            lastUpdated={lastUpdated}
          />

          {error && (
            <div className="state-banner-static error">Error: {error}</div>
          )}
          {!error && loading && (
            <div className="state-banner-static loading">
              Cargando semaforos...
            </div>
          )}
          {!error && !loading && empty && (
            <div className="state-banner-static empty">
              Sin semaforos con coordenadas validas para mostrar.
            </div>
          )}
        </div>

        <div className="page-split-main">
          <article className="map-feature-card semaforos-map-card">
            <div className="map-feature-header">
              <div className="map-feature-heading">
                <p className="section-kicker">Vista principal</p>
                <h2>Mapa de semaforos</h2>
                <p className="map-feature-copy">
                  El estado georreferenciado gana protagonismo con una
                  superficie amplia y estable para navegacion.
                </p>
              </div>
              <div className="map-feature-badges">
                <span className="badge">{semaforos.length} visibles</span>
              </div>
            </div>

            <div className="semaforos-map-panel">
              <SemaforosMapView semaforos={semaforos} />
            </div>
          </article>
        </div>
      </section>
    </section>
  );
}

export default SemaforosPage;
