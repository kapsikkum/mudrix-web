import { useEffect, useRef, useState } from 'react';
import { volumeRange } from './stage/CallStage.css';
import * as css from './VolumeSlider.css';

const THUMB = 14;

export function VolumeSlider({
  value,
  max = 1,
  label,
  disabled,
  onChange,
}: {
  value: number;
  max?: number;
  label: string;
  disabled?: boolean;
  onChange: (value: number) => void;
}) {
  const [dragging, setDragging] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);
  const percent = Math.round(value * 100);
  const ratio = Math.min(Math.max(value / max, 0), 1);

  useEffect(() => {
    if (!dragging) return;
    const stop = () => setDragging(false);
    // The slider may be in the call's window of its own, which is another window.
    const win = wrapRef.current?.ownerDocument.defaultView ?? window;
    win.addEventListener('pointerup', stop);
    win.addEventListener('pointercancel', stop);
    win.addEventListener('blur', stop);
    return () => {
      win.removeEventListener('pointerup', stop);
      win.removeEventListener('pointercancel', stop);
      win.removeEventListener('blur', stop);
    };
  }, [dragging]);

  return (
    <div ref={wrapRef} className={css.wrap}>
      <input
        type="range"
        className={volumeRange}
        style={{ '--volume': `${ratio * 100}%` } as React.CSSProperties}
        min={0}
        max={Math.round(max * 100)}
        step={1}
        value={percent}
        disabled={disabled}
        aria-label={label}
        aria-valuetext={`${percent}%`}
        onPointerDown={() => setDragging(true)}
        onChange={(e) => onChange(Number(e.target.value) / 100)}
        onDoubleClick={() => onChange(1)}
      />
      {dragging && (
        <span
          className={css.bubble}
          style={{ left: `calc(${THUMB / 2}px + (100% - ${THUMB}px) * ${ratio})` }}
          aria-hidden
        >
          {percent}%
        </span>
      )}
    </div>
  );
}
