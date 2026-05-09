import { useEffect, useRef } from 'react';
import { useAtom } from 'jotai';
import EmojiPickerReact, { Theme, EmojiStyle } from 'emoji-picker-react';
import type { EmojiClickData } from 'emoji-picker-react';
import { emojiPickerAtom } from '@/app/store/atoms';
import * as css from './EmojiPicker.css';

const PICKER_WIDTH = 350;
const PICKER_HEIGHT = 450;

export function EmojiPicker() {
  const [picker, setPicker] = useAtom(emojiPickerAtom);
  const wrapRef = useRef<HTMLDivElement>(null);

  // Close on outside click / Escape
  useEffect(() => {
    if (!picker) return;
    const handleMouseDown = (e: MouseEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) {
        setPicker(null);
      }
    };
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setPicker(null);
    };
    document.addEventListener('mousedown', handleMouseDown);
    document.addEventListener('keydown', handleKey);
    return () => {
      document.removeEventListener('mousedown', handleMouseDown);
      document.removeEventListener('keydown', handleKey);
    };
  }, [picker, setPicker]);

  if (!picker) return null;

  // Clamp position so picker stays inside the viewport
  const x = Math.min(picker.x, window.innerWidth - PICKER_WIDTH - 8);
  const y = picker.y + PICKER_HEIGHT > window.innerHeight ? picker.y - PICKER_HEIGHT : picker.y;

  const handlePick = (emojiData: EmojiClickData) => {
    picker.onPick(emojiData.emoji);
    setPicker(null);
  };

  return (
    <div ref={wrapRef} className={css.pickerWrap} style={{ left: x, top: y }}>
      <EmojiPickerReact
        onEmojiClick={handlePick}
        theme={Theme.DARK}
        emojiStyle={EmojiStyle.NATIVE}
        width={PICKER_WIDTH}
        height={PICKER_HEIGHT}
        searchPlaceholder="Search emoji…"
        lazyLoadEmojis
      />
    </div>
  );
}
