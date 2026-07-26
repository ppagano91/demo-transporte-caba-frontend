import { useEffect, useMemo, useState } from "react";
import ColectivosPage from "./pages/ColectivosPage";
import EcobiciPage from "./pages/EcobiciPage";
import SemaforosPage from "./pages/SemaforosPage";
import SubteForecastPage from "./pages/SubteForecastPage";
import "./App.css";

type AppPage = "colectivos" | "subtes" | "ecobici" | "semaforos";

const PAGE_META: Record<AppPage, { title: string; description: string }> = {
  colectivos: {
    title: "Colectivos",
    description: "Visualizacion en tiempo real de posiciones de vehiculos.",
  },
  subtes: {
    title: "Red de Subtes",
    description: "Consultá recorridos, estaciones y próximas llegadas.",
  },
  ecobici: {
    title: "Ecobici",
    description: "Mapa y estado operativo de estaciones en tiempo real.",
  },
  semaforos: {
    title: "Semaforos",
    description: "Visualizacion simple de semaforos sobre el mapa de la Ciudad.",
  },
};

const detectPageFromPath = (path: string): AppPage => {
  if (path.startsWith("/subtes")) {
    return "subtes";
  }
  if (path.startsWith("/ecobici")) {
    return "ecobici";
  }
  if (path.startsWith("/semaforos")) {
    return "semaforos";
  }
  return "colectivos";
};

function App() {
  const [activePage, setActivePage] = useState<AppPage>(() =>
    detectPageFromPath(window.location.pathname),
  );

  useEffect(() => {
    const handleLocationChange = () => {
      setActivePage(detectPageFromPath(window.location.pathname));
    };

    window.addEventListener("popstate", handleLocationChange);
    return () => window.removeEventListener("popstate", handleLocationChange);
  }, []);

  const openPage = (page: AppPage) => {
    const nextPath =
      page === "subtes"
        ? "/subtes"
        : page === "ecobici"
          ? "/ecobici"
          : page === "semaforos"
            ? "/semaforos"
            : "/";
    if (window.location.pathname !== nextPath) {
      window.history.pushState({}, "", nextPath);
    }
    setActivePage(page);
  };

  const pageContent = useMemo(() => {
    if (activePage === "subtes") {
      return <SubteForecastPage />;
    }
    if (activePage === "ecobici") {
      return <EcobiciPage />;
    }
    if (activePage === "semaforos") {
      return <SemaforosPage />;
    }
    return <ColectivosPage />;
  }, [activePage]);

  return (
    <main className="app-shell">
      <header className="app-topbar">
        <div className="app-topbar-copy">
          {/* <p className="app-shell-kicker">Demo API Transporte GCBA</p> */}
          <div className="app-topbar-heading">
            <h1>{PAGE_META[activePage].title}</h1>
            <p>{PAGE_META[activePage].description}</p>
          </div>
        </div>

        <nav className="top-nav" aria-label="Secciones principales">
          <button
            className={activePage === "colectivos" ? "nav-button active" : "nav-button"}
            onClick={() => openPage("colectivos")}
          >
            Colectivos
          </button>
          <button
            className={activePage === "subtes" ? "nav-button active" : "nav-button"}
            onClick={() => openPage("subtes")}
          >
            Subtes
          </button>
          <button
            className={activePage === "ecobici" ? "nav-button active" : "nav-button"}
            onClick={() => openPage("ecobici")}
          >
            Ecobici
          </button>
          <button
            className={activePage === "semaforos" ? "nav-button active" : "nav-button"}
            onClick={() => openPage("semaforos")}
          >
            Semaforos
          </button>
        </nav>
      </header>

      <section className="app-content">{pageContent}</section>
    </main>
  );
}

export default App;
