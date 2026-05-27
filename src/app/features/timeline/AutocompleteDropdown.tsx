import { useTranslation } from 'react-i18next';
import type { MatrixClient } from 'matrix-js-sdk';
import { CaretUpIcon, CaretDownIcon } from '@phosphor-icons/react';
import { Avatar } from '@/app/components/Avatar';
import type { AutocompleteState, Suggestion } from './useAutocomplete';
import * as css from './AutocompleteDropdown.css';

interface Props {
  state: AutocompleteState;
  client: MatrixClient;
  onSelect: (suggestion: Suggestion) => void;
}

export function AutocompleteDropdown({ state, client, onSelect }: Props) {
  const { t } = useTranslation();
  if (!state.open || state.suggestions.length === 0) return null;

  const headerLabel = state.mode === 'emoji' ? t('common.emoji') : t('common.members');

  return (
    <div className={css.dropdown}>
      <div className={css.header}>{headerLabel}</div>

      {state.suggestions.map((suggestion, i) => {
        const isSelected = i === state.selectedIndex;
        const itemClass = isSelected ? css.itemSelected : css.item;

        if (suggestion.kind === 'emoji') {
          return (
            <div
              key={suggestion.id}
              className={itemClass}
              // mousedown avoids losing textarea focus before click fires
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
}
