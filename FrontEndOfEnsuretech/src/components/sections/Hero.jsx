import React from "react";
import { ArrowRight, CheckCircle2, Rocket } from "lucide-react";
import Reveal from "../common/Reveal";
import Button from "../common/Button";
import NetworkDiagram from "../diagrams/NetworkDiagram";

export default function Hero() {
  return (
    <section className="et-hero">
      <div className="et-hero__grid">
        <div className="et-hero__left">
          <Reveal>
            <div className="et-badge">
              <Rocket size={14} />
              Insurance Onboarding Infrastructure
            </div>
          </Reveal>

          <Reveal delay={80}>
            <h1 className="et-hero__title">
              Insurance Onboarding
              <br />
              Without the Chaos
            </h1>
          </Reveal>

          <Reveal delay={140}>
            <div className="et-hero__thesis">
              <span>Data enters once.</span>
              <span className="et-grad-text">Validated everywhere.</span>
              <span>Reconciled never.</span>
            </div>
          </Reveal>

          <Reveal delay={200}>
            <p className="et-hero__copy">
              Ensuretech is the operational source of truth for insurance
              onboarding. We eliminate spreadsheet chaos, automate
              validation, and connect brokers, TPAs, insurers, employers,
              and HR teams on a single platform.
            </p>
          </Reveal>

          <Reveal delay={260}>
            <div className="et-hero__ctas">
              <Button variant="primary">
                Start Demo <ArrowRight size={16} />
              </Button>
              <Button variant="ghost">Learn More</Button>
            </div>
          </Reveal>

          <Reveal delay={320}>
            <ul className="et-trust">
              <li>
                <CheckCircle2 size={14} /> Event Driven
              </li>
              <li>
                <CheckCircle2 size={14} /> Microservices
              </li>
              <li>
                <CheckCircle2 size={14} /> Enterprise Security
              </li>
              <li>
                <CheckCircle2 size={14} /> High Availability
              </li>
            </ul>
          </Reveal>
        </div>

        <div className="et-hero__right">
          <NetworkDiagram />
          <div className="et-float-cards">
            <div className="et-glass-card et-float-cards__c1">
              <div className="et-glass-card__num">1.2M+</div>
              <div className="et-glass-card__label">Records Processed</div>
            </div>
            <div className="et-glass-card et-float-cards__c2">
              <div className="et-glass-card__num">99.9%</div>
              <div className="et-glass-card__label">Platform Uptime</div>
            </div>
            <div className="et-glass-card et-float-cards__c3">
              <div className="et-glass-card__num">85%</div>
              <div className="et-glass-card__label">
                Reduction in Reconciliation Time
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
