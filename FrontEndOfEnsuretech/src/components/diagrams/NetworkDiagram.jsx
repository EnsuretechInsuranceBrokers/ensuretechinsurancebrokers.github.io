import React from "react";

/**
 * Hero visual: Brokers / TPAs / Insurers / Employers converge on the
 * Validation Engine, with a data pulse animating along each path.
 */
export default function NetworkDiagram() {
  const nodes = [
    { id: "broker", label: "Brokers", x: 60, y: 60 },
    { id: "tpa", label: "TPAs", x: 340, y: 40 },
    { id: "insurer", label: "Insurers", x: 60, y: 260 },
    { id: "employer", label: "Employers", x: 340, y: 280 },
  ];
  const center = { x: 200, y: 160 };

  return (
    <svg
      className="et-network"
      viewBox="0 0 400 320"
      xmlns="http://www.w3.org/2000/svg"
    >
      <defs>
        <radialGradient id="etCoreGlow" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="#FFC24C" stopOpacity="0.45" />
          <stop offset="100%" stopColor="#FFC24C" stopOpacity="0" />
        </radialGradient>
        <linearGradient id="etLineGrad" x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%" stopColor="#0052FF" />
          <stop offset="100%" stopColor="#FFC24C" />
        </linearGradient>
      </defs>

      {nodes.map((n) => (
        <g key={n.id}>
          <line
            x1={n.x}
            y1={n.y}
            x2={center.x}
            y2={center.y}
            className="et-network__path"
          />
          <circle cx={n.x} cy={n.y} r="3.2" className="et-network__pulse">
            <animateMotion
              dur="2.4s"
              repeatCount="indefinite"
              path={`M${n.x},${n.y} L${center.x},${center.y}`}
            />
          </circle>
        </g>
      ))}

      <circle cx={center.x} cy={center.y} r="46" fill="url(#etCoreGlow)" />
      <circle cx={center.x} cy={center.y} r="30" className="et-network__core" />
      <text
        x={center.x}
        y={center.y - 2}
        textAnchor="middle"
        className="et-network__coretext"
      >
        Validation
      </text>
      <text
        x={center.x}
        y={center.y + 12}
        textAnchor="middle"
        className="et-network__coretext"
      >
        Engine
      </text>

      {nodes.map((n) => (
        <g key={`label-${n.id}`}>
          <circle cx={n.x} cy={n.y} r="22" className="et-network__node" />
          <text
            x={n.x}
            y={n.y + 4}
            textAnchor="middle"
            className="et-network__nodetext"
          >
            {n.label}
          </text>
        </g>
      ))}
    </svg>
  );
}
