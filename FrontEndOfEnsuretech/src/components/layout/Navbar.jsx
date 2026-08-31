import React, { useEffect, useState } from "react";
import Logo from "../common/Logo";
import Button from "../common/Button";

export default function Navbar() {
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 24);
    window.addEventListener("scroll", onScroll);
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <header className={`et-nav ${scrolled ? "et-nav--scrolled" : ""}`}>
      <div className="et-nav__inner">
        <Logo />
        <nav className="et-nav__links">
          <a href="#platform">Platform</a>
          <a href="#architecture">Architecture</a>
          <a href="#story">Story</a>
          <a href="#contributors">Team</a>
        </nav>
        <Button variant="primary" size="sm">
          Start Demo
        </Button>
      </div>
    </header>
  );
}
