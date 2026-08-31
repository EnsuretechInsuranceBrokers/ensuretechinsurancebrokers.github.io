import React from "react";

/**
 * Ambient floating-particle background used behind the Vision quote.
 */
export default function VisionField() {
  const dots = Array.from({ length: 18 }, (_, i) => ({
    id: i,
    top: (i * 37) % 100,
    left: (i * 53) % 100,
    dur: 6 + (i % 5),
    delay: (i % 6) * 0.6,
  }));

  return (
    <div className="et-vision__field" aria-hidden="true">
      {dots.map((d) => (
        <span
          key={d.id}
          className="et-vision__dot"
          style={{
            top: `${d.top}%`,
            left: `${d.left}%`,
            animationDuration: `${d.dur}s`,
            animationDelay: `${d.delay}s`,
          }}
        />
      ))}
    </div>
  );
}
