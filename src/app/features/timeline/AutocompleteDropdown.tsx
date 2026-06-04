import { useTranslation } from 'react-i18next';
import { createPortal } from 'react-dom';
import { useState, useEffect, useCallback, useRef } from 'react';
import type { RefObject } from 'react';
import type { MatrixClient } from 'matrix-js-sdk';
import { CaretUpIcon, CaretDownIcon } from '@phosphor-icons/react';
import { Avatar } from '@/app/components/Avatar';
import type { AutocompleteState, Suggestion } from './useAutocomplete';
import * as css from './AutocompleteDropdown.css';

interface Props {
  state: AutocompleteState;
  client: MatrixClient;
  onSelect: (suggestion: Suggestion) => void;
  anchorRef: RefObject<HTMLDivElement | null>;
}

export function AutocompleteDropdown({ state, client, onSelect, anchorRef }: Props) {
  const { t } = useTranslation();
  const [posStyle, setPosStyle] = useState<React.CSSProperties>({});
  const suggestionsRef = useRef<HTMLDivElement | null>(null);

  const updatePosition = useCallback(() => {
    const el = anchorRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    setPosStyle({
      position: 'fixed',
      left: rect.left,
      width: rect.width,
      bottom: window.innerHeight - rect.top + 4,
    });
  }, [anchorRef]);

  useEffect(() => {
    if (!state.open) return;
    updatePosition();
    window.addEventListener('resize', updatePosition);
    return () => window.removeEventListener('resize', updatePosition);
  }, [state.open, updatePosition]);

  useEffect(() => {
    if (!state.open) return;
    const container = suggestionsRef.current;
    if (!container) return;
    const el = container.children[state.selectedIndex] as HTMLElement | undefined;
    el?.scrollIntoView({ block: 'nearest' });
  }, [state.open, state.selectedIndex]);

  if (!state.open || state.suggestions.length === 0) return null;

  const headerLabel =
    state.mode === 'emoji'
      ? t('common.emoji')
      : state.mode === 'command'
        ? t('common.commands')
        : t('common.members');

  const dropdown = (
    <div className={css.dropdown} style={posStyle}>
      <div className={css.header}>{headerLabel}</div>

      <div ref={suggestionsRef} className={css.suggestionsList}>
        {state.suggestions.map((suggestion, i) => {
          const isSelected = i === state.selectedIndex;
          const itemClass = isSelected ? css.itemSelected : css.item;

          if (suggestion.kind === 'emoji') {
            return (
              <div
                key={suggestion.id}
                className={itemClass}
                onMouseDown={(e) => {
                  e.preventDefault();
                  onSelect(suggestion);
                }}
              >
                <span className={css.emojiChar}>{suggestion.char}</span>
                <span className={css.emojiName}>:{suggestion.id}:</span>
              </div>
            );
          }

          if (suggestion.kind === 'command') {
            return (
              <div
                key={suggestion.command}
                className={itemClass}
                onMouseDown={(e) => {
                  e.preventDefault();
                  onSelect(suggestion);
                }}
              >
                <span className={css.emojiName}>/{suggestion.command}</span>
                <span className={css.mentionId}>{suggestion.description(t)}</span>
              </div>
            );
          }

          // mention
          return (
            <div
              key={suggestion.userId}
              className={itemClass}
              onMouseDown={(e) => {
                e.preventDefault();
                onSelect(suggestion);
              }}
            >
              <Avatar
                name={suggestion.displayName}
                mxcUrl={suggestion.avatarMxc}
                client={client}
                size="sm"
              />
              <span className={css.mentionName}>{suggestion.displayName}</span>
              <span className={css.mentionId}>{suggestion.userId}</span>
            </div>
          );
        })}
      </div>

      <div className={css.hint}>
        <span className={css.hintKey}>
          <kbd className={css.kbd}>
            <CaretUpIcon size={12} />
          </kbd>
          <kbd className={css.kbd}>
            <CaretDownIcon size={12} />
          </kbd>{' '}
          {t('common.navigate')}
        </span>
        <span className={css.hintKey}>
          <kbd className={css.kbd}>Tab</kbd> or <kbd className={css.kbd}>Enter</kbd>{' '}
          {t('common.select')}
        </span>
        <span className={css.hintKey}>
          <kbd className={css.kbd}>Esc</kbd> {t('common.dismiss')}
        </span>
      </div>
    </div>
  );

  return createPortal(dropdown, document.body);
}
