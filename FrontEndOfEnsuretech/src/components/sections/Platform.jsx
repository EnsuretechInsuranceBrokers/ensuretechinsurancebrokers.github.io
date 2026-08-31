import React from "react";
import { Zap, RefreshCw, Building2, ShieldCheck, BarChart3, Cloud } from "lucide-react";
import Reveal from "../common/Reveal";
import { features } from "../../data/features";

const ICONS = { Zap, RefreshCw, Building2, ShieldCheck, BarChart3, Cloud };

export default function Platform() {
  return (
    <section className="et-section et-platform" id="platform">
      <Reveal className="et-section__head">
        <div className="et-eyebrow">The Ensuretech Platform</div>
        <h2 className="et-h2">One Operational Source of Truth</h2>
        <p className="et-sub">Validated data enters once and flows everywhere.</p>
      </Reveal>

      <div className="et-feature-grid">
        {features.map((f, i) => {
          const Icon = ICONS[f.icon];
          return (
            <Reveal delay={(i % 3) * 90} key={f.t}>
              <div className="et-feature-card">
                <div
                  className={`et-feature-card__icon${
                    f.success ? " et-feature-card__icon--success" : ""
                  }`}
                >
                  <Icon size={20} />
                </div>
                <h3>{f.t}</h3>
                <p>{f.d}</p>
              </div>
            </Reveal>
          );
        })}
      </div>
    </section>
  );
}
