import React from "react";
import "./App.css";

import Navbar from "./components/layout/Navbar";
import Footer from "./components/layout/Footer";

import Hero from "./components/sections/Hero";
import Problem from "./components/sections/Problem";
import Story from "./components/sections/Story";
import Platform from "./components/sections/Platform";
import Architecture from "./components/sections/Architecture";
import Metrics from "./components/sections/Metrics";
import Team from "./components/sections/Team";
import Vision from "./components/sections/Vision";
import CTA from "./components/sections/CTA";

/* ---------------------------------------------------------------
   ENSURETECH — Insurance Onboarding Infrastructure
   Design system:
   - Display: Space Grotesk (technical, geometric — infra feel)
   - Body: Inter
   - Mono/label: JetBrains Mono (eyebrows, stats, connectors)
   - Signature element: the "data pulse" — a traveling glow that
     runs along dashed connector lines everywhere a diagram or
     divider appears, making the brief's own thesis ("data enters
     once, validated everywhere") literally visible on the page.
------------------------------------------------------------------ */

export default function App() {
  return (
    <div className="et-root">
      <Navbar />
      <Hero />
      <Problem />
      <Story />
      <Platform />
      <Architecture />
      <Metrics />
      <Team />
      <Vision />
      <CTA />
      <Footer />
    </div>
  );
}
