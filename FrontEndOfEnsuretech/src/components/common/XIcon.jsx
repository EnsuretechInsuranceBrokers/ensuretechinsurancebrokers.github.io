import React from "react";

/**
 * Custom "X" (formerly Twitter) glyph — not part of lucide-react,
 * so it's hand-drawn as inline SVG.
 */
export default function XIcon({ size = 18 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor">
      <path d="M18.9 2H22l-7.6 8.7L23.3 22H16.9l-5-6.5L6.1 22H3l8.1-9.3L2.9 2h6.6l4.5 6ZM17.6 20h1.7L7.9 4H6.1Z" />
    </svg>
  );
}
