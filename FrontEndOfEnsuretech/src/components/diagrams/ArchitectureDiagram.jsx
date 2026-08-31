import React from "react";
import ArchConnector from "./ArchConnector";

export default function ArchitectureDiagram() {
  const services = [
    "Enrollment Service",
    "Policy Service",
    "Member Service",
    "Notification Service",
    "Analytics Service",
  ];

  const stages = ["Broker Portal", "Validation Engine", "Event Bus"];
  const after = ["Data Warehouse", "TPA + Insurer Integrations"];

  return (
    <div className="et-arch-diagram">
      {stages.map((s) => (
        <React.Fragment key={s}>
          <div className="et-arch-node">{s}</div>
          <ArchConnector />
        </React.Fragment>
      ))}

      <div className="et-arch-layer">
        <div className="et-arch-layer__label">Microservices Layer</div>
        <div className="et-arch-layer__grid">
          {services.map((s) => (
            <div className="et-arch-node et-arch-node--sm" key={s}>
              {s}
            </div>
          ))}
        </div>
      </div>

      {after.map((s) => (
        <React.Fragment key={s}>
          <ArchConnector />
          <div className="et-arch-node">{s}</div>
        </React.Fragment>
      ))}
    </div>
  );
}
