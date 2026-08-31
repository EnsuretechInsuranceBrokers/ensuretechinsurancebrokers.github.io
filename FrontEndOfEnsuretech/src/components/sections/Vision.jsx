import React from "react";
import Reveal from "../common/Reveal";
import VisionField from "../diagrams/VisionField";

export default function Vision() {
  return (
    <section className="et-vision">
      <VisionField />
      <Reveal className="et-vision__inner">
        <p className="et-vision__quote">
          “A world where insurance onboarding becomes invisible
          infrastructure.”
        </p>
      </Reveal>
    </section>
  );
}
