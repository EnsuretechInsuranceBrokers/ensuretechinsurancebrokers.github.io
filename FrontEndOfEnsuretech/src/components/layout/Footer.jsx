import React from "react";
import Logo from "../common/Logo";

export default function Footer() {
  return (
    <footer className="et-footer">
      <div className="et-footer__top">
        <div className="et-footer__brand">
          <Logo />
          <p>Operational Infrastructure for Insurance</p>
        </div>

        <div className="et-footer__col">
          <h4>Product</h4>
          <a href="#">Platform</a>
          <a href="#">Architecture</a>
          <a href="#">Security</a>
          <a href="#">Integrations</a>
        </div>
        <div className="et-footer__col">
          <h4>Company</h4>
          <a href="#">About</a>
          <a href="#">Contributors</a>
          <a href="#">Careers</a>
        </div>
        <div className="et-footer__col">
          <h4>Resources</h4>
          <a href="#">Documentation</a>
          <a href="#">API Reference</a>
          <a href="#">Blog</a>
        </div>
        <div className="et-footer__col">
          <h4>Contact</h4>
          <a href="mailto:hello@ensuretech.ai">hello@ensuretech.ai</a>
          <a href="#">LinkedIn</a>
          <a href="#">GitHub</a>
        </div>
      </div>
      <div className="et-footer__bottom">
        © 2026 Ensuretech. All Rights Reserved.
      </div>
    </footer>
  );
}
