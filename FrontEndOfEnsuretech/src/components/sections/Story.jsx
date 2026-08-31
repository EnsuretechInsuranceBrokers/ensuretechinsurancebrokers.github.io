import React from "react";
import Reveal from "../common/Reveal";
import { timeline } from "../../data/timeline";

export default function Story() {
  return (
    <section className="et-section et-story" id="story">
      <div className="et-story__grid">
        <Reveal className="et-story__left">
          <ol className="et-timeline">
            {timeline.map((step, i, arr) => (
              <li key={step} className="et-timeline__item">
                <div className="et-timeline__dot" />
                <div className="et-timeline__text">{step}</div>
                {i < arr.length - 1 && (
                  <div className="et-timeline__connector">
                    <div className="et-timeline__pulse" />
                  </div>
                )}
              </li>
            ))}
          </ol>
        </Reveal>

        <Reveal className="et-story__right" delay={120}>
          <div className="et-eyebrow">Our Story</div>
          <h2 className="et-h2">Born From Production Pain</h2>
          <p className="et-body-lg">
            Ensuretech was born from frustration—the kind that only comes
            from watching systems fail while people lose hours of their
            lives.
          </p>
          <p className="et-body-lg">
            We realized every stakeholder was solving the same problem
            independently.
          </p>
          <p className="et-body-lg">
            Instead of building another portal, we built the infrastructure
            layer everyone could share.
          </p>
        </Reveal>
      </div>
    </section>
  );
}
