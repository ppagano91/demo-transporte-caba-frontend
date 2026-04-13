import SemaforosMapView from "../components/SemaforosMapView";
import { useSemaforos } from "../hooks/useSemaforos";
import type { SemaforoMapItem } from "../types/semaforos";

const formatLastUpdate = (value: Date | null): string => {
  if (!value) {
    return "-";
  }
  return new Intl.DateTimeFormat("es-AR", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).format(value);
};

const semaforoKey = (semaforo: SemaforoMapItem, index: number): string => {
  return semaforo.code ?? `${semaforo.name ?? "semaforo"}-${index}`;
};

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
      <header className="app-header">
        <h1>Semaforos</h1>
        <p>Visualizacion simple de semaforos sobre el mapa de la Ciudad.</p>
      </header>

      <section className="semaforos-toolbar">
        <div className="toolbar-controls">
          <button
            className="secondary"
            onClick={refreshNow}
            disabled={loading || isRefreshing}
          >
            Actualizar ahora
          </button>
        </div>

        <div className="toolbar-status">
          <span className="badge">Semaforos visibles: {semaforos.length}</span>
          <span
            className={`update-state ${isRefreshing ? "refreshing" : "idle"}`}
          >
            {isRefreshing ? "Actualizando..." : "Estable"}
          </span>
          <span className="last-updated">
            Ultima actualizacion: {formatLastUpdate(lastUpdated)}
          </span>
        </div>
      </section>

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
        <div className="semaforos-map-panel">
          <SemaforosMapView semaforos={semaforos} />
        </div>

        {/* <div className="semaforos-table-wrap">
          <table className="semaforos-table">
            <thead>
              <tr>
                <th>Name</th>
                <th>Status</th>
                <th>Type</th>
                <th>Provider</th>
              </tr>
            </thead>
            <tbody>
              {semaforos.map((semaforo, index) => (
                <tr key={semaforoKey(semaforo, index)}>
                  <td>{semaforo.name ?? "-"}</td>
                  <td>{semaforo.status ?? "-"}</td>
                  <td>{semaforo.type ?? "-"}</td>
                  <td>{semaforo.provider ?? "-"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div> */}
      </section>
    </section>
  );
}

export default SemaforosPage;
