import { useEffect, useMemo, useState } from "react";
import ColectivosPage from "./pages/ColectivosPage";
import EcobiciPage from "./pages/EcobiciPage";
import SubteForecastPage from "./pages/SubteForecastPage";
import "./App.css";

type AppPage = "colectivos" | "subtes" | "ecobici";

const detectPageFromPath = (path: string): AppPage => {
  if (path.startsWith("/subtes")) {
    return "subtes";
  }
  if (path.startsWith("/ecobici")) {
    return "ecobici";
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
      page === "subtes" ? "/subtes" : page === "ecobici" ? "/ecobici" : "/";
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
    return <ColectivosPage />;
  }, [activePage]);

  return (
    <main className="app-shell">
      <nav className="top-nav">
        <button
          className={activePage === "colectivos" ? "" : "secondary"}
          onClick={() => openPage("colectivos")}
        >
          Colectivos
        </button>
        <button
          className={activePage === "subtes" ? "" : "secondary"}
          onClick={() => openPage("subtes")}
        >
          Subtes GTFS
        </button>
        <button
          className={activePage === "ecobici" ? "" : "secondary"}
          onClick={() => openPage("ecobici")}
        >
          Ecobici
        </button>
      </nav>
      {pageContent}
    </main>
  );
}

export default App;
