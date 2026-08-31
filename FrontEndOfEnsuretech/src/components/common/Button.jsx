import React from "react";

/**
 * Shared pill button. `variant` maps to the et-btn--* modifier classes
 * defined in styles/global.css (primary | ghost | dark | outline).
 * `size` optionally adds the --sm modifier (used in the nav bar).
 */
export default function Button({
  variant = "primary",
  size,
  children,
  className = "",
  ...rest
}) {
  const classes = [
    "et-btn",
    `et-btn--${variant}`,
    size ? `et-btn--${size}` : "",
    className,
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <button className={classes} {...rest}>
      {children}
    </button>
  );
}
