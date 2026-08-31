import React from "react";

/**
 * A single dashed connector with a traveling "data pulse" dot —
 * used to link stages in the ArchitectureDiagram.
 */
export default function ArchConnector() {
  return (
    <div className="et-arch-connector">
      <svg viewBox="0 0 4 40" preserveAspectRatio="none">
        <line x1="2" y1="0" x2="2" y2="40" className="et-arch-connector__line" />
        <circle cx="2" cy="0" r="1.6" className="et-arch-connector__pulse">
          <animateMotion dur="1.6s" repeatCount="indefinite" path="M0,0 L0,40" />
        </circle>
      </svg>
    </div>
  );
}
