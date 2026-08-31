import Reveal from "../common/Reveal";
import XIcon from "../common/XIcon";
import { team } from "../../data/team";

function GitHubIcon({ size = 16 }) {
return ( <svg
   width={size}
   height={size}
   viewBox="0 0 24 24"
   fill="currentColor"
   aria-hidden="true"
 > <path d="M12 2C6.48 2 2 6.58 2 12.23c0 4.52 2.87 8.35 6.84 9.7.5.1.68-.22.68-.49 0-.24-.01-1.04-.01-1.88-2.78.62-3.37-1.2-3.37-1.2-.45-1.18-1.11-1.49-1.11-1.49-.91-.64.07-.63.07-.63 1 .07 1.53 1.06 1.53 1.06.9 1.56 2.35 1.11 2.92.85.09-.67.35-1.11.64-1.37-2.22-.26-4.56-1.14-4.56-5.07 0-1.12.39-2.03 1.03-2.75-.1-.26-.45-1.3.1-2.71 0 0 .84-.28 2.75 1.05A9.3 9.3 0 0 1 12 6.45c.85 0 1.71.12 2.51.35 1.91-1.33 2.75-1.05 2.75-1.05.55 1.41.2 2.45.1 2.71.64.72 1.03 1.63 1.03 2.75 0 3.94-2.35 4.81-4.58 5.06.36.32.68.95.68 1.92 0 1.39-.01 2.51-.01 2.85 0 .27.18.59.69.49A10.24 10.24 0 0 0 22 12.23C22 6.58 17.52 2 12 2Z" /> </svg>
);
}

function LinkedInIcon({ size = 16 }) {
return ( <svg
   width={size}
   height={size}
   viewBox="0 0 24 24"
   fill="currentColor"
   aria-hidden="true"
 > <path d="M6.94 8.5A2.25 2.25 0 1 0 6.94 4a2.25 2.25 0 0 0 0 4.5ZM5 9.75h3.88V20H5V9.75ZM11.31 9.75H15v1.4h.05c.51-.97 1.78-1.99 3.66-1.99C22.63 9.16 23 11.75 23 15.12V20h-3.88v-4.33c0-1.03-.02-2.36-1.4-2.36-1.4 0-1.62 1.13-1.62 2.29V20h-3.88V9.75Z" /> </svg>
);
}

export default function Team() {
return ( <section className="et-section et-contributors" id="contributors"> <Reveal className="et-section__head"> <div className="et-eyebrow">The Team</div>


    <h2 className="et-h2">Meet The Builders</h2>
  </Reveal>

  <div className="et-team-grid">
    {team.map((p, i) => (
      <Reveal delay={i * 100} key={p.name}>
        <div className="et-team-card">
          <div className="et-team-card__photo">
            <span>{p.initials}</span>
          </div>

          <h3>{p.name}</h3>

          <div className="et-team-card__role">
            {p.role}
          </div>

          <p>{p.bio}</p>

          <div className="et-team-card__socials">
            <a href="#" aria-label="GitHub">
              <GitHubIcon size={16} />
            </a>

            <a href="#" aria-label="LinkedIn">
              <LinkedInIcon size={16} />
            </a>

            <a href="#" aria-label="X">
              <XIcon size={16} />
            </a>
          </div>
        </div>
      </Reveal>
    ))}
  </div>
</section>


);
}
