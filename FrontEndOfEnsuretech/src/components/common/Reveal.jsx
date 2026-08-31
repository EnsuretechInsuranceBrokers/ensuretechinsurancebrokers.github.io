import React from "react";
import { useReveal } from "../../hooks/useReveal";

/**
 * Wraps children in a scroll-triggered fade/slide reveal.
 * Pass `delay` (ms) to stagger multiple Reveal instances.
 */
export default function Reveal({ children, delay = 0, className = "" }) {
  const [ref, visible] = useReveal();
  return (
    <div
      ref={ref}
      className={`et-reveal ${visible ? "et-reveal--in" : ""} ${className}`}
      style={{ transitionDelay: `${delay}ms` }}
    >
      {children}
    </div>
  );
}
