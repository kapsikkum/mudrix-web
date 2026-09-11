import * as css from './LogoLoader.css';

export function LogoLoader() {
  return (
    <svg
      className={css.svg}
      viewBox="0 0 400 400"
      xmlns="http://www.w3.org/2000/svg"
      aria-label="WizardChat Logo"
    >
      <g transform="translate(0, 40)" stroke="none">
        {/* Polygon order matches logo.svg */}
        {/* p0 — left-bottom */}
        <polygon className={css.p0} points="0,280 100,320 200,270 100,230" />
        {/* p1 — bottom */}
        <polygon className={css.p1} points="100,320 300,320 200,270" />
        {/* p2 — right-bottom */}
        <polygon className={css.p2} points="400,280 300,320 200,270 300,230" />
        {/* p3 — left-middle */}
        <polygon className={css.p3} points="100,230 200,270 230,80 200,70" />
        {/* p4 — right-middle */}
        <polygon className={css.p4} points="200,270 300,230 260,75 230,80" />
        {/* p5 — top */}
        <polygon className={css.p5} points="200,70 230,80 260,75 300,0" />
      </g>
    </svg>
  );
}
