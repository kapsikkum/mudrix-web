import { useEffect, useState } from 'react';
import { useAtomValue } from 'jotai';
import { useTranslation } from 'react-i18next';
import { HandIcon, SmileyIcon } from '@phosphor-icons/react';
import { Tooltip } from '@/app/components/Tooltip';
import { callActionsAtom, callSessionAtom } from '@/app/store/atoms/call';
import { useCallView } from './useCallView';
import { useCallSnapshot } from './stage/useCallSnapshot';
import * as css from './CallControlBar.css';

const REACTIONS = ['👍', '👎', '👏', '🎉', '😄', '🥰', '👋', '🤘'];

// A reaction shows on a tile for a few seconds. Waiting it out keeps a burst of clicks from
// flooding the call with messages.
const REACTION_COOLDOWN_MS = 3000;

/** Reactions as a column up the right side of the call, opened from a button in the corner. */
export function CallReactionsRail() {
  const { t } = useTranslation();
  const actions = useAtomValue(callActionsAtom);
  const session = useAtomValue(callSessionAtom);
  const snapshot = useCallSnapshot();
  const view = useCallView();
  const [open, setOpen] = useState(false);
  const [cooling, setCooling] = useState(false);

  useEffect(() => {
    if (!cooling) return undefined;
    const timer = window.setTimeout(() => setCooling(false), REACTION_COOLDOWN_MS);
    return () => window.clearTimeout(timer);
  }, [cooling]);

  if (!actions || !session || view === 'tile') return null;

  const handRaised = !!snapshot?.participants.find((p) => p.isLocal)?.handRaised;
  const handLabel = handRaised ? t('call.lowerHand') : t('call.raiseHand');

  const react = (emoji: string) => {
    if (cooling) return;
    setCooling(true);
    actions.openReactions(emoji);
  };

  return (
    <div className={css.reactionsRail}>
      {open && (
        <div
          className={css.reactionsColumn}
          role="toolbar"
          aria-orientation="vertical"
          aria-label={t('voice.reactions')}
        >
          {REACTIONS.map((emoji) => (
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
          <button
            type="button"
            className={css.reactionBtn}
            onClick={() => void session.setHandRaised(!handRaised)}
            aria-label={handLabel}
            aria-pressed={handRaised}
            title={handLabel}
          >
            <HandIcon size={18} weight={handRaised ? 'fill' : 'regular'} />
          </button>
        </div>
      )}
      <Tooltip content={t('voice.reactions')}>
        <button
          type="button"
          className={open ? css.reactionsToggleOpen : css.reactionsToggle}
          onClick={() => setOpen((v) => !v)}
          aria-label={t('voice.reactions')}
          aria-expanded={open}
        >
          <SmileyIcon size={20} />
        </button>
      </Tooltip>
    </div>
  );
}
