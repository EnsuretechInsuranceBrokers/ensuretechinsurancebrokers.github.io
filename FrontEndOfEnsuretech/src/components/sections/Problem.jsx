import React from "react";
import Reveal from "../common/Reveal";
import { problems } from "../../data/problems";

export default function Problem() {
  return (
    <section className="et-section et-problem">
      <Reveal className="et-section__head">
        <div className="et-eyebrow">The Problem</div>
        <h2 className="et-h2">Why Insurance Operations Break</h2>
      </Reveal>

      <div className="et-problem__grid">
        {problems.map((c, i) => (
          <Reveal delay={i * 100} key={c.t}>
            <div className="et-problem-card">
              <div className="et-problem-card__index">0{i + 1}</div>
              <h3>{c.t}</h3>
              <p>{c.d}</p>
            </div>
          </Reveal>
        ))}
      </div>

      <Reveal className="et-quote-wrap" delay={150}>
        <blockquote className="et-quote">
          “The pain was not isolated. It was systemic.”
        </blockquote>
      </Reveal>
    </section>
  );
}
