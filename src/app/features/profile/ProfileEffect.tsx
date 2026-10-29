import { useEffect, useMemo, useRef, useState } from 'react';
import { useAtomValue } from 'jotai';
import { profileEffectsAtom } from '@/app/store/atoms';
import { useMediaQuery } from '@/app/hooks/useMediaQuery';
import { getMatrixClientOrNull } from '@/client/clientHolder';
import { useMediaBlobUrl } from '@/app/components/Avatar/useMediaBlobUrl';
import { type BuiltinProfileEffectId, type ProfileEffectId } from '@/util/profileCosmetics';
import { lookupEffectIntro } from '@/app/hooks/useUserPacks';
import { apngDurationMs } from '@/util/apng';
import { useRestartingSrc } from './useRestartingSrc';
import * as css from './ProfileCard.css';

/** Hard ceiling on simultaneous particles, whatever the effect asks for. */
const MAX_PARTICLES = 28;

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  size: number;
  rot: number;
  vr: number;
  phase: number;
  /** Seconds lived (used by twinkling sparkles). */
  age: number;
  life: number;
  /** Optional per-particle fill colour (multicolour effects). */
  tint?: string;
  /** Optional per-particle shape selector (e.g. spark point count, 0 = pixel critter). */
  shape?: number;
}

interface EffectSpec {
  count: number;
  color: string;
  stroke?: string;
  draw: (ctx: CanvasRenderingContext2D, size: number, p: Particle) => void;
  spawn: (w: number, h: number, initial: boolean) => Omit<Particle, 'phase' | 'age'>;
}

const rand = (min: number, max: number) => min + Math.random() * (max - min);
const pick = <T,>(items: readonly T[]): T => items[Math.floor(Math.random() * items.length)];

function starPath(ctx: CanvasRenderingContext2D, r: number) {
  ctx.beginPath();
  for (let i = 0; i < 10; i += 1) {
    const rad = i % 2 === 0 ? r : r * 0.45;
    const a = (-90 + i * 36) * (Math.PI / 180);
    if (i === 0) ctx.moveTo(rad * Math.cos(a), rad * Math.sin(a));
    else ctx.lineTo(rad * Math.cos(a), rad * Math.sin(a));
  }
  ctx.closePath();
}

function heartPath(ctx: CanvasRenderingContext2D, r: number) {
  ctx.beginPath();
  ctx.moveTo(0, r * 0.9);
  ctx.bezierCurveTo(-r * 1.4, -r * 0.1, -r * 0.7, -r * 1.1, 0, -r * 0.35);
  ctx.bezierCurveTo(r * 0.7, -r * 1.1, r * 1.4, -r * 0.1, 0, r * 0.9);
  ctx.closePath();
}

function sparklePath(ctx: CanvasRenderingContext2D, r: number) {
  const k = r * 0.14;
  ctx.beginPath();
  ctx.moveTo(0, -r);
  ctx.quadraticCurveTo(k, -k, r, 0);
  ctx.quadraticCurveTo(k, k, 0, r);
  ctx.quadraticCurveTo(-k, k, -r, 0);
  ctx.quadraticCurveTo(-k, -k, 0, -r);
  ctx.closePath();
}

/** Rounded multi-point asterisk: `points` soft spikes around a centre. */
function asteriskPath(ctx: CanvasRenderingContext2D, r: number, points: number) {
  const inner = r * 0.32;
  const step = (Math.PI * 2) / points;
  ctx.beginPath();
  for (let k = 0; k < points; k += 1) {
    const a = -Math.PI / 2 + k * step;
    if (k === 0) ctx.moveTo(r * Math.cos(a), r * Math.sin(a));
    const mid = a + step / 2;
    const next = a + step;
    ctx.quadraticCurveTo(
      inner * Math.cos(mid),
      inner * Math.sin(mid),
      r * Math.cos(next),
      r * Math.sin(next)
    );
  }
  ctx.closePath();
}

/** Leaf outline pointing up: pointed tip at -r and stem at +r. */
function leafPath(ctx: CanvasRenderingContext2D, r: number) {
  ctx.beginPath();
  ctx.moveTo(0, -r);
  ctx.bezierCurveTo(r * 0.8, -r * 0.6, r * 0.8, r * 0.5, 0, r);
  ctx.bezierCurveTo(-r * 0.8, r * 0.5, -r * 0.8, -r * 0.6, 0, -r);
  ctx.closePath();
}

/** Irregular wobbly blob centred on the origin; `phase` varies the wobble per particle. */
function mudBlobPath(ctx: CanvasRenderingContext2D, r: number, phase: number) {
  const n = 9;
  const pts: [number, number][] = [];
  for (let i = 0; i < n; i += 1) {
    const t = (i / n) * Math.PI * 2;
    const rr = r * (1 + 0.18 * Math.sin(3 * t + phase) + 0.1 * Math.sin(5 * t + phase * 1.7));
    pts.push([rr * Math.cos(t), rr * Math.sin(t)]);
  }
  const mid = (a: [number, number], b: [number, number]): [number, number] => [
    (a[0] + b[0]) / 2,
    (a[1] + b[1]) / 2,
  ];
  const start = mid(pts[n - 1], pts[0]);
  ctx.beginPath();
  ctx.moveTo(start[0], start[1]);
  for (let i = 0; i < n; i += 1) {
    const m = mid(pts[i], pts[(i + 1) % n]);
    ctx.quadraticCurveTo(pts[i][0], pts[i][1], m[0], m[1]);
  }
  ctx.closePath();
}

/**
 * Creeping hands: one pale hand silhouette (fingers up, origin at the palm centre, about 22 units
 * below and 14 above). Built once and reused for every particle.
 */
const CREEP_HAND: Path2D | null =
  typeof Path2D === 'undefined'
    ? null
    : new Path2D(
        'M-9,0 L-9,16 Q-9,22 -4,22 L4,22 Q9,22 9,16 L9,0 Z' +
          ' M-8.6,0 L-8.6,-11.4 A1.6,1.6 0 0 1 -5.4,-11.4 L-5.4,0 Z' +
          ' M-4.1,0 L-4.1,-14.3 A1.7,1.7 0 0 1 -0.7,-14.3 L-0.7,0 Z' +
          ' M0.75,0 L0.75,-13.35 A1.65,1.65 0 0 1 4.05,-13.35 L4.05,0 Z' +
          ' M4.95,0 L4.95,-9.55 A1.45,1.45 0 0 1 7.85,-9.55 L7.85,0 Z' +
          ' M-8,12 L-13.2,4.5 A1.8,1.8 0 0 1 -10.6,1.5 L-6,8 Z'
      );
/** Particle shape marker for a drifting mist wisp (hands use shape undefined). */
const MIST_SHAPE = 9;
const CREEP_HAND_H = 40;
const easeOutCubic = (x: number) => 1 - (1 - x) ** 3;

const CONFETTI_COLORS = ['#f87171', '#fbbf24', '#34d399', '#60a5fa', '#a78bfa', '#f472b6'];
const LEAF_COLORS = ['#e0792b', '#c2410c', '#b45309', '#a16207', '#9a3412'];

const EFFECTS: Record<BuiltinProfileEffectId, EffectSpec> = {
  'falling-stars': {
    count: 18,
    color: '#fcd34d',
    stroke: 'rgba(180,120,0,0.55)',
    draw: (ctx, s) => {
      starPath(ctx, s);
      ctx.fill();
      ctx.stroke();
    },
    spawn: (w, h, initial) => ({
      x: rand(0, w),
      y: initial ? rand(0, h) : rand(-30, -8),
      vx: rand(-18, -6),
      vy: rand(35, 75),
      size: rand(4, 8),
      rot: rand(0, Math.PI * 2),
      vr: rand(-2, 2),
      life: Infinity,
    }),
  },
  hearts: {
    count: 14,
    color: '#f472b6',
    stroke: 'rgba(157,23,77,0.45)',
    draw: (ctx, s) => {
      heartPath(ctx, s);
      ctx.fill();
      ctx.stroke();
    },
    spawn: (w, h, initial) => ({
      x: rand(0, w),
      y: initial ? rand(0, h) : h + rand(8, 30),
      vx: rand(-6, 6),
      vy: -rand(18, 42),
      size: rand(4, 7),
      rot: rand(-0.4, 0.4),
      vr: rand(-0.4, 0.4),
      life: Infinity,
    }),
  },
  snow: {
    count: 28,
    color: '#ffffff',
    stroke: 'rgba(100,130,170,0.5)',
    draw: (ctx, s) => {
      ctx.beginPath();
      ctx.arc(0, 0, s, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
    },
    spawn: (w, h, initial) => ({
      x: rand(0, w),
      y: initial ? rand(0, h) : rand(-20, -4),
      vx: rand(-6, 6),
      vy: rand(14, 34),
      size: rand(2.5, 5),
      rot: 0,
      vr: 0,
      life: Infinity,
    }),
  },
  sparkles: {
    count: 20,
    color: '#fef08a',
    stroke: 'rgba(234,179,8,0.6)',
    draw: (ctx, s) => {
      sparklePath(ctx, s);
      ctx.fill();
      ctx.stroke();
    },
    spawn: (w, h) => {
      const life = rand(1.2, 2.4);
      return {
        x: rand(8, Math.max(8, w - 8)),
        y: rand(8, Math.max(8, h - 8)),
        vx: rand(-2, 2),
        vy: rand(-4, -1),
        size: rand(5, 10),
        rot: rand(0, Math.PI),
        vr: rand(-0.5, 0.5),
        life,
      };
    },
  },
  'claude-sparks': {
    count: 16,
    color: '#D97757',
    stroke: 'rgba(150,60,35,0.5)',
    draw: (ctx, s, p) => {
      if (p.shape === 0) {
        // Tiny blocky critter: body, ears, legs, and two darker eyes.
        const u = s * 0.4;
        ctx.fillStyle = '#D97757';
        ctx.fillRect(-2 * u, -2 * u, 4 * u, 3 * u);
        ctx.fillRect(-2 * u, -3 * u, u, u);
        ctx.fillRect(u, -3 * u, u, u);
        ctx.fillRect(-2 * u, u, u, 2 * u);
        ctx.fillRect(u, u, u, 2 * u);
        ctx.fillStyle = 'rgba(90,35,20,0.9)';
        ctx.fillRect(-1.2 * u, -1.2 * u, 0.5 * u, 0.8 * u);
        ctx.fillRect(0.7 * u, -1.2 * u, 0.5 * u, 0.8 * u);
        return;
      }
      // Twinkle: gently pulse the spark's size as it ages.
      const tw = 0.75 + 0.25 * Math.sin(p.age * 3 + p.phase);
      asteriskPath(ctx, s * tw, p.shape ?? 4);
      ctx.fillStyle = '#D97757';
      ctx.fill();
      ctx.stroke();
    },
    spawn: (w, h, initial) => {
      const critter = Math.random() < 0.18;
      return {
        x: rand(8, Math.max(8, w - 8)),
        y: initial ? rand(0, h) : h + rand(8, 24),
        vx: rand(-4, 4),
        vy: critter ? -rand(9, 14) : -rand(8, 16),
        size: critter ? rand(4, 5.5) : rand(4, 7),
        rot: critter ? 0 : rand(0, Math.PI * 2),
        vr: critter ? 0 : rand(-0.8, 0.8),
        life: critter ? Infinity : rand(3, 5),
        shape: critter ? 0 : pick([4, 6, 8]),
      };
    },
  },
  bubbles: {
    count: 14,
    color: 'rgba(186,230,253,0.28)',
    stroke: 'rgba(56,189,248,0.55)',
    draw: (ctx, s) => {
      ctx.beginPath();
      ctx.arc(0, 0, s, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(186,230,253,0.28)';
      ctx.fill();
      ctx.strokeStyle = 'rgba(56,189,248,0.55)';
      ctx.stroke();
      // Specular highlight in the upper-left.
      ctx.beginPath();
      ctx.arc(-s * 0.35, -s * 0.35, s * 0.28, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(255,255,255,0.85)';
      ctx.fill();
    },
    spawn: (w, h, initial) => ({
      x: rand(0, w),
      y: initial ? rand(0, h) : h + rand(8, 30),
      vx: rand(-4, 4),
      vy: -rand(14, 28),
      size: rand(4, 9),
      rot: 0,
      vr: 0,
      life: Infinity,
    }),
  },
  confetti: {
    count: 22,
    color: '#fbbf24',
    draw: (ctx, s, p) => {
      // Flip the piece over as it tumbles by squashing its height.
      const flip = Math.cos(p.age * 4 + p.phase);
      ctx.fillStyle = p.tint ?? '#fbbf24';
      ctx.scale(1, Math.max(0.15, Math.abs(flip)));
      ctx.fillRect(-s, -s * 0.5, s * 2, s);
    },
    spawn: (w, h, initial) => ({
      x: rand(0, w),
      y: initial ? rand(0, h) : rand(-30, -8),
      vx: rand(-12, 12),
      vy: rand(40, 70),
      size: rand(3.5, 5.5),
      rot: rand(0, Math.PI * 2),
      vr: rand(-6, 6),
      life: Infinity,
      tint: pick(CONFETTI_COLORS),
    }),
  },
  fireflies: {
    count: 16,
    color: '#ecfccb',
    draw: (ctx, s, p) => {
      const pulse = 0.8 + 0.2 * Math.sin(p.age * 5 + p.phase);
      ctx.beginPath();
      ctx.arc(0, 0, s * 3.2 * pulse, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(190,242,100,0.22)';
      ctx.fill();
      ctx.beginPath();
      ctx.arc(0, 0, s * pulse, 0, Math.PI * 2);
      ctx.fillStyle = '#ecfccb';
      ctx.fill();
    },
    spawn: (w, h) => ({
      x: rand(0, w),
      y: rand(0, h),
      vx: rand(-7, 7),
      vy: rand(-7, 7),
      size: rand(1.8, 2.8),
      rot: 0,
      vr: 0,
      life: rand(3, 6),
    }),
  },
  'autumn-leaves': {
    count: 14,
    color: '#c2410c',
    stroke: 'rgba(90,40,10,0.45)',
    draw: (ctx, s, p) => {
      leafPath(ctx, s);
      ctx.fillStyle = p.tint ?? '#c2410c';
      ctx.fill();
      ctx.strokeStyle = 'rgba(90,40,10,0.45)';
      ctx.stroke();
      // Midrib.
      ctx.beginPath();
      ctx.moveTo(0, -s * 0.85);
      ctx.lineTo(0, s * 0.85);
      ctx.strokeStyle = 'rgba(60,25,5,0.45)';
      ctx.stroke();
    },
    spawn: (w, h, initial) => ({
      x: rand(0, w),
      y: initial ? rand(0, h) : rand(-30, -8),
      vx: rand(-8, 8),
      vy: rand(20, 34),
      size: rand(5, 8),
      rot: rand(0, Math.PI * 2),
      vr: rand(-1.5, 1.5),
      life: Infinity,
      tint: pick(LEAF_COLORS),
    }),
  },
  'mud-splatter': {
    count: 16,
    color: '#5b3a1e',
    stroke: '#3e2611',
    draw: (ctx, s, p) => {
      if (p.shape === 2) {
        // Tiny flying speck.
        ctx.beginPath();
        ctx.arc(0, 0, s, 0, Math.PI * 2);
        ctx.fillStyle = '#5b3a1e';
        ctx.fill();
        return;
      }
      const isDrip = p.shape === 1;
      if (isDrip) {
        // Drips stretch longer the further they have fallen.
        ctx.scale(0.85, 1 + Math.min(p.age * 0.9, 1.4));
      }
      mudBlobPath(ctx, s, p.phase);
      ctx.fillStyle = '#5b3a1e';
      ctx.fill();
      ctx.strokeStyle = '#3e2611';
      ctx.stroke();
      // Wet highlight.
      ctx.beginPath();
      ctx.arc(-s * 0.3, -s * 0.3, s * 0.18, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(170,125,80,0.6)';
      ctx.fill();
    },
    spawn: (w, h, initial) => {
      const roll = Math.random();
      const shape = roll < 0.18 ? 2 : roll < 0.45 ? 1 : 0;
      const speck = shape === 2;
      const drip = shape === 1;
      return {
        x: rand(0, w),
        y: initial ? rand(0, h) : rand(-30, -8),
        vx: rand(-5, 5),
        vy: speck ? rand(60, 90) : drip ? rand(30, 45) : rand(22, 38),
        size: speck ? rand(1, 1.8) : drip ? rand(4, 6) : rand(5, 9),
        rot: drip || speck ? 0 : rand(0, Math.PI * 2),
        vr: drip || speck ? 0 : rand(-0.3, 0.3),
        life: Infinity,
        shape,
      };
    },
  },
  'creeping-hands': {
    count: 8,
    color: '#c4bdaf',
    stroke: 'rgba(40,40,36,0.8)',
    draw: (ctx, s, p) => {
      if (p.shape === MIST_SHAPE) {
        // Faint drifting mist: two soft overlapping ellipses.
        ctx.beginPath();
        ctx.ellipse(0, 0, s * 1.9, s * 0.5, 0, 0, Math.PI * 2);
        ctx.fillStyle = 'rgba(205,214,204,0.1)';
        ctx.fill();
        ctx.beginPath();
        ctx.ellipse(s * 0.5, -s * 0.2, s * 1.1, s * 0.34, 0, 0, Math.PI * 2);
        ctx.fill();
        return;
      }
      if (!CREEP_HAND) return;
      const t = Math.min(1, p.age / p.life);
      // Hidden for the last part of each cycle, so hands show up now and then rather than constantly.
      if (t <= 0 || t > 0.72) return;
      // Rise slowly from below the edge, hold, then sink back.
      const up = easeOutCubic(Math.min(1, t / 0.3));
      const down = Math.max(0, (t - 0.5) / 0.22);
      const k = s / 4.5;
      const offset = (1 - up + Math.min(1, down)) * CREEP_HAND_H * k;
      // Slow grasp: the fingers close and open.
      const grip = 0.5 - 0.5 * Math.cos(p.age * 1.3 + p.phase);
      ctx.translate(0, offset);
      ctx.scale(k, k * (1 - 0.14 * grip));
      ctx.fillStyle = '#c4bdaf';
      ctx.fill(CREEP_HAND);
      ctx.lineWidth = 0.5;
      ctx.strokeStyle = 'rgba(40,40,36,0.8)';
      ctx.stroke(CREEP_HAND);
    },
    spawn: (w, h, initial) => {
      if (Math.random() < 0.4) {
        // Mist wisp: drifts slowly across the lower half.
        return {
          x: initial ? rand(0, w) : -30,
          y: rand(h * 0.3, h * 0.95),
          vx: rand(6, 12),
          vy: rand(-3, -1),
          size: rand(22, 34),
          rot: 0,
          vr: 0,
          life: Infinity,
          shape: MIST_SHAPE,
        };
      }
      return {
        x: rand(12, Math.max(12, w - 12)),
        y: h - 6,
        vx: 0,
        vy: 0,
        size: rand(7, 9),
        rot: rand(-0.12, 0.12),
        vr: 0,
        life: rand(9, 13),
      };
    },
  },
};

function BuiltinParticleEffect({
  effect,
  enabled,
  reducedMotion,
}: {
  effect: BuiltinProfileEffectId;
  enabled: boolean;
  reducedMotion: boolean;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const active = enabled && !reducedMotion;

  useEffect(() => {
    if (!active) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const spec = EFFECTS[effect];
    if (!spec) return;

    let width = 0;
    let height = 0;
    let dpr = 1;
    let particles: Particle[] = [];
    let raf = 0;
    let last = 0;

    const make = (initial: boolean): Particle => {
      const base = spec.spawn(width, height, initial);
      return {
        ...base,
        phase: Math.random() * Math.PI * 2,
        age: initial ? rand(0, base.life === Infinity ? 2 : base.life) : 0,
      };
    };

    const resize = () => {
      const rect = canvas.getBoundingClientRect();
      dpr = Math.min(window.devicePixelRatio || 1, 2);
      width = rect.width;
      height = rect.height;
      canvas.width = Math.round(width * dpr);
      canvas.height = Math.round(height * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

      const target = Math.min(spec.count, MAX_PARTICLES);
      particles = Array.from({ length: target }, () => make(true));
    };

    const frame = (now: number) => {
      const dt = Math.min((now - last) / 1000, 0.05);
      last = now;

      ctx.clearRect(0, 0, width, height);
      ctx.fillStyle = spec.color;
      if (spec.stroke) ctx.strokeStyle = spec.stroke;
      ctx.lineWidth = 1;

      for (let i = 0; i < particles.length; i += 1) {
        const p = particles[i];
        p.age += dt;
        p.x += (p.vx + Math.sin(now / 1000 + p.phase) * 6) * dt;
        p.y += p.vy * dt;
        p.rot += p.vr * dt;
        const out =
          p.y > height + 40 || p.y < -40 || p.x < -40 || p.x > width + 40 || p.age > p.life;
        if (out) {
          particles[i] = make(false);
        } else {
          let alpha = 0.9;
          if (Number.isFinite(p.life)) alpha = Math.sin((p.age / p.life) * Math.PI) * 0.95;
          ctx.save();
          ctx.globalAlpha = Math.max(0, alpha);
          ctx.translate(p.x, p.y);
          ctx.rotate(p.rot);
          spec.draw(ctx, p.size, p);
          ctx.restore();
        }
      }
      raf = requestAnimationFrame(frame);
    };

    const start = () => {
      if (raf) return;
      last = performance.now();
      raf = requestAnimationFrame(frame);
    };
    const stop = () => {
      if (raf) cancelAnimationFrame(raf);
      raf = 0;
    };
    const onVisibility = () => (document.hidden ? stop() : start());

    resize();
    const observer = new ResizeObserver(resize);
    observer.observe(canvas);
    document.addEventListener('visibilitychange', onVisibility);
    if (!document.hidden) start();

    return () => {
      stop();
      observer.disconnect();
      document.removeEventListener('visibilitychange', onVisibility);
    };
  }, [active, effect]);

  if (!active) return null;
  return <canvas ref={canvasRef} className={css.effectCanvas} aria-hidden="true" />;
}

/** How long one pass of the animation behind a blob URL lasts; null until it has been read. */
function useAnimationDuration(src: string | undefined): number | null {
  const [read, setRead] = useState<{ from: string; ms: number } | null>(null);
  useEffect(() => {
    if (!src) return undefined;
    let cancelled = false;
    fetch(src)
      .then((r) => r.arrayBuffer())
      .then((buf) => {
        if (!cancelled) setRead({ from: src, ms: apngDurationMs(buf) ?? 0 });
      })
      .catch(() => {
        if (!cancelled) setRead({ from: src, ms: 0 });
      });
    return () => {
      cancelled = true;
    };
  }, [src]);
  return src && read?.from === src ? read.ms : null;
}

/** How long to wait for an intro before showing the loop on its own. */
const INTRO_GIVE_UP_MS = 4000;

function MxcProfileEffect({
  mxcUrl,
  enabled,
  reducedMotion,
}: {
  mxcUrl: string;
  enabled: boolean;
  reducedMotion: boolean;
}) {
  const client = getMatrixClientOrNull();
  // When reduced motion is requested, ask for a thumbnail: the homeserver returns a
  // non-animated still frame (MSC2705 `animated=false`) instead of the full animation.
  const { src: loopShared } = useMediaBlobUrl(
    client,
    mxcUrl,
    reducedMotion ? { width: 256, height: 256 } : {}
  );
  // Each image gets its own copy, so it always starts from its first frame even when the same one
  // is already playing somewhere else on screen.
  const loopSrc = useRestartingSrc(loopShared);

  // Some effects open with an intro that plays once (a burst of hands, say) before settling into the
  // loop. It is a separate image named by the pack, so it is skipped for reduced motion and whenever
  // it cannot be had.
  const introMxc = useMemo(
    () => (client && !reducedMotion ? lookupEffectIntro(client, mxcUrl) : null),
    [client, mxcUrl, reducedMotion]
  );
  const { src: introShared } = useMediaBlobUrl(client, introMxc);
  const introSrc = useRestartingSrc(introShared);
  const introMs = useAnimationDuration(introShared);
  const [introDone, setIntroDone] = useState(false);
  const [gaveUp, setGaveUp] = useState(false);

  const waitingForIntro = !!introMxc && !gaveUp && !(introSrc && introMs !== null);
  const playingIntro = !!introMxc && !gaveUp && !waitingForIntro && !!introMs && !introDone;

  useEffect(() => {
    if (!waitingForIntro) return undefined;
    const timer = setTimeout(() => setGaveUp(true), INTRO_GIVE_UP_MS);
    return () => clearTimeout(timer);
  }, [waitingForIntro]);

  useEffect(() => {
    if (!playingIntro || !introMs) return undefined;
    const timer = setTimeout(() => setIntroDone(true), introMs);
    return () => clearTimeout(timer);
  }, [playingIntro, introMs]);

  const src = playingIntro ? introSrc : waitingForIntro ? undefined : loopSrc;
  if (!src || !enabled) return null;
  return (
    <div className={css.profileEffectContainer} aria-hidden="true">
      {/* The key makes the loop a new image when the intro ends, so it starts from its first frame. */}
      <img
        key={playingIntro ? 'intro' : 'loop'}
        className={css.profileEffectLayer}
        src={src}
        alt=""
        draggable={false}
      />
    </div>
  );
}

export function ProfileEffect({ effect }: { effect: ProfileEffectId }) {
  const enabled = useAtomValue(profileEffectsAtom);
  const reducedMotion = useMediaQuery('(prefers-reduced-motion: reduce)');

  if (effect.startsWith('mxc://')) {
    return (
      <MxcProfileEffect
        key={effect}
        mxcUrl={effect}
        enabled={enabled}
        reducedMotion={reducedMotion}
      />
    );
  }

  if ((effect as string) in EFFECTS) {
    return (
      <BuiltinParticleEffect
        effect={effect as BuiltinProfileEffectId}
        enabled={enabled}
        reducedMotion={reducedMotion}
      />
    );
  }

  // parseProfileEffect only ever allows a builtin id or an mxc:// URL through, so every valid
  // value is handled by one of the branches above.
  return null;
}
