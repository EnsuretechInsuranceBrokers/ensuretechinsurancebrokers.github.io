import React from "react";
import Reveal from "../common/Reveal";
import Button from "../common/Button";

export default function CTA() {
  return (
    <section className="et-cta">
      <Reveal className="et-cta__inner">
        <h2>Ready to Transform Insurance Operations?</h2>
        <p>Join the next generation of insurance onboarding infrastructure.</p>
        <div className="et-cta__btns">
          <Button variant="dark">Request Demo</Button>
          <Button variant="outline">Contact Us</Button>
        </div>
      </Reveal>
    </section>
  );
}
