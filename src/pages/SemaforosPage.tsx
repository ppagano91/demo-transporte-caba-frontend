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
      <SectionOverview
        kicker="Operacion"
        title="Estado de semaforos"
        description="Se mantiene el mapa como foco principal, con el mismo patron visual de actualizacion y resumen que el resto de las secciones."
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

      {error && <div className="state-banner-static error">Error: {error}</div>}
      {!error && loading && (
        <div className="state-banner-static loading">Cargando semaforos...</div>
      )}
      {!error && !loading && empty && (
        <div className="state-banner-static empty">
          Sin semaforos con coordenadas validas para mostrar.
        </div>
      )}

      <section className="semaforos-content">
        <article className="semaforos-map-card">
          <div className="ecobici-section-header">
            <div>
              <p className="section-kicker">Vista principal</p>
              <h2>Mapa de semaforos</h2>
              <p className="ecobici-section-copy">
                El mapa se presenta dentro de una tarjeta consistente con el resto
                de la aplicacion para mejorar jerarquia y lectura visual.
              </p>
            </div>
            <span className="badge">{semaforos.length} visibles</span>
          </div>

          <div className="semaforos-map-panel">
            <SemaforosMapView semaforos={semaforos} />
          </div>
        </article>
      </section>
    </section>
  );
}

export default SemaforosPage;
