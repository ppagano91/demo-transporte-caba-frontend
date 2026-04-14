import type { ReactNode } from "react";

interface SectionOverviewMetric {
  label: string;
  value: ReactNode;
  tone?: "default" | "accent";
}

interface SectionOverviewProps {
  kicker?: string;
  title: string;
  description?: string;
  actions?: ReactNode;
  metrics: SectionOverviewMetric[];
  isRefreshing: boolean;
  lastUpdated: Date | null;
}

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

function SectionOverview({
  kicker,
  title,
  description,
  actions,
  metrics,
  isRefreshing,
  lastUpdated,
}: SectionOverviewProps) {
  return (
    <section className="section-overview">
      <div className="section-overview-top">
        <div className="section-overview-copy">
          {kicker ? <p className="section-kicker">{kicker}</p> : null}
          <div>
            <h2>{title}</h2>
            {description ? (
              <p className="section-overview-description">{description}</p>
            ) : null}
          </div>
        </div>

        {actions ? <div className="section-overview-actions">{actions}</div> : null}
      </div>

      <div className="section-overview-bottom">
        <div className="section-overview-metrics">
          {metrics.map((metric, index) => (
            <div
              key={`${metric.label}-${index}`}
              className={`section-overview-metric ${metric.tone === "accent" ? "accent" : ""}`}
            >
              <span className="section-overview-label">{metric.label}</span>
              <strong className="section-overview-value">{metric.value}</strong>
            </div>
          ))}
        </div>

        <div className="section-overview-meta">
          <span className={`update-state ${isRefreshing ? "refreshing" : "idle"}`}>
            {isRefreshing ? "Actualizando..." : "Estable"}
          </span>
          <span className="last-updated">
            Ultima actualizacion: {formatLastUpdate(lastUpdated)}
          </span>
        </div>
      </div>
    </section>
  );
}

export default SectionOverview;
