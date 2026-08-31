import React from "react";
import Reveal from "../common/Reveal";
import ArchitectureDiagram from "../diagrams/ArchitectureDiagram";

const TAGS = ["Event-Driven", "Resilient", "Fault Tolerant", "Scalable"];

export default function Architecture() {
  return (
    <section className="et-section et-arch" id="architecture">
      <Reveal className="et-section__head">
        <div className="et-eyebrow">System Design</div>
        <h2 className="et-h2">Platform Architecture</h2>
      </Reveal>
      <Reveal delay={100}>
        <ArchitectureDiagram />
      </Reveal>
      <Reveal delay={200} className="et-arch__tags">
        {TAGS.map((t, i) => (
          <span key={t}>
            {t}
            {i < TAGS.length - 1 && <em>•</em>}
          </span>
        ))}
      </Reveal>
    </section>
  );
}
