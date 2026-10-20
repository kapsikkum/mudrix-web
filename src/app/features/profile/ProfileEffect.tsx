import { useEffect, useRef } from 'react';
import { useAtomValue } from 'jotai';
import { profileEffectsAtom } from '@/app/store/atoms';
import { useMediaQuery } from '@/app/hooks/useMediaQuery';
import { getMatrixClientOrNull } from '@/client/clientHolder';
import { useMediaBlobUrl } from '@/app/components/Avatar/useMediaBlobUrl';
import { type BuiltinProfileEffectId, type ProfileEffectId } from '@/util/profileCosmetics';
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
}

interface EffectSpec {
  count: number;
  color: string;
  stroke?: string;
  draw: (ctx: CanvasRenderingContext2D, size: number) => void;
  spawn: (w: number, h: number, initial: boolean) => Omit<Particle, 'phase' | 'age'>;
}

const rand = (min: number, max: number) => min + Math.random() * (max - min);

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
          spec.draw(ctx, p.size);
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
  const { src } = useMediaBlobUrl(client, mxcUrl, reducedMotion ? { width: 256, height: 256 } : {});
  if (!src || !enabled) return null;
  return (
    <div className={css.profileEffectContainer} aria-hidden="true">
      <img className={css.profileEffectLayer} src={src} alt="" draggable={false} />
    </div>
  );
}

export function ProfileEffect({ effect }: { effect: ProfileEffectId }) {
  const enabled = useAtomValue(profileEffectsAtom);
  const reducedMotion = useMediaQuery('(prefers-reduced-motion: reduce)');

  if (effect.startsWith('mxc://')) {
    return <MxcProfileEffect mxcUrl={effect} enabled={enabled} reducedMotion={reducedMotion} />;
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
