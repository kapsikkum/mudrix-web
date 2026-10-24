import { useEffect, useState } from 'react';
import { useAtomValue } from 'jotai';
import { useTranslation } from 'react-i18next';
import { DotsThreeIcon, SmileyIcon } from '@phosphor-icons/react';
import { Tooltip } from '@/app/components/Tooltip';
import {
  elementCallActionsAtom,
  elementCallEffectiveViewAtom,
  elementCallEmbedAtom,
} from '@/app/store/atoms/elementCall';
import * as css from './CallControlBar.css';

/** Shown in the rail; the rest are behind "more". */
const QUICK_REACTIONS = ['👍', '👎', '👏', '🎉', '😄', '🥰', '👋', '🤘'];

// Element Call shows one reaction per person at a time, for 3 s, and drops any sent meanwhile.
// Waiting it out keeps a burst of clicks from flooding the room with events.
const REACTION_COOLDOWN_MS = 3000;

/** Reactions as a column up the right side of the call, opened from a button in the corner. */
export function CallReactionsRail() {
  const { t } = useTranslation();
  const actions = useAtomValue(elementCallActionsAtom);
  const embed = useAtomValue(elementCallEmbedAtom);
  const view = useAtomValue(elementCallEffectiveViewAtom);
  const [open, setOpen] = useState(false);
  const [all, setAll] = useState(false);
  const [cooling, setCooling] = useState(false);

  useEffect(() => {
    if (!cooling) return undefined;
    const timer = window.setTimeout(() => setCooling(false), REACTION_COOLDOWN_MS);
    return () => window.clearTimeout(timer);
  }, [cooling]);

  if (!actions || view === 'tile') return null;

  // Our Element Call fork lists every reaction it has; with the npm package "more" opens EC's own.
  const ecReactions = embed?.control.getReactions() ?? null;
  const shown = all && ecReactions ? ecReactions.map((r) => r.emoji) : QUICK_REACTIONS;

  const react = (emoji: string) => {
    if (cooling) return;
    setCooling(true);
    actions.openReactions(emoji);
  };

  return (
    <div className={css.reactionsRail}>
      {open && (
        <div
          className={all ? css.reactionsColumnAll : css.reactionsColumn}
          role="toolbar"
          aria-orientation="vertical"
          aria-label={t('voice.reactions')}
        >
          {shown.map((emoji) => (
            <button
              key={emoji}
              type="button"
              className={css.reactionBtn}
              onClick={() => react(emoji)}
              disabled={cooling}
              aria-label={emoji}
            >
              {emoji}
            </button>
          ))}
          {ecReactions && (
            <button
              type="button"
              className={css.reactionBtn}
              onClick={() => embed?.control.toggleRaisedHand()}
              aria-label={t('voice.raiseHand')}
            >
              ✋
            </button>
          )}
          <button
            type="button"
            className={css.reactionBtn}
            onClick={() => {
              if (ecReactions) {
                setAll((v) => !v);
                return;
              }
              actions.openReactions();
              setOpen(false);
            }}
            aria-label={t('voice.moreReactions')}
            aria-pressed={all}
          >
            <DotsThreeIcon size={18} weight="bold" />
          </button>
        </div>
      )}
      <Tooltip content={t('voice.reactions')}>
        <button
          type="button"
          className={open ? css.reactionsToggleOpen : css.reactionsToggle}
          onClick={() => {
            setOpen((v) => !v);
            setAll(false);
          }}
          aria-label={t('voice.reactions')}
          aria-expanded={open}
        >
          <SmileyIcon size={20} />
        </button>
      </Tooltip>
    </div>
  );
}
