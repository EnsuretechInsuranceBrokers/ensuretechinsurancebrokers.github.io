import React from "react";
import Reveal from "../common/Reveal";
import { metrics } from "../../data/metrics";

export default function Metrics() {
  return (
    <section className="et-section et-metrics">
      <div className="et-metrics__grid">
        {metrics.map((m, i) => (
          <Reveal delay={i * 80} key={m.label}>
            <div className="et-metric">
              <div className="et-metric__num">{m.big}</div>
              <div className="et-metric__label">{m.label}</div>
            </div>
          </Reveal>
        ))}
      </div>
    </section>
  );
}
