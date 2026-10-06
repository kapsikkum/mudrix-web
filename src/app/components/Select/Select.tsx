import { CaretDownIcon } from '@phosphor-icons/react';
import { Popover } from '@/app/components/Popover';
import { Tooltip } from '@/app/components/Tooltip';
import { useFieldLabelId } from '@/app/components/Field';
import { useSelectMenu } from './useSelectMenu';
import type { SelectOption, SelectSize } from './Select.types';
import * as css from './Select.css';

interface SelectProps<T extends string = string> {
  value: T;
  onChange: (value: T) => void;
  options: readonly SelectOption<T>[];
  icon?: React.ReactNode;
  size?: SelectSize;
  surface?: 'field' | 'pill';
  disabled?: boolean;
  active?: boolean;
  label?: string;
  id?: string;
  className?: string;
  tabIndex?: number;
  'aria-label'?: string;
}

export function Select<T extends string = string>({
  value,
  onChange,
  options,
  icon,
  size = 'md',
  surface = 'field',
  disabled,
  active,
  label,
  id,
  className,
  tabIndex,
  'aria-label': ariaLabel,
}: SelectProps<T>) {
  const fieldLabelId = useFieldLabelId();
  const menu = useSelectMenu({ options, disabled, onChange });
  const compact = size === 'sm';
  const selected = options.find((o) => o.value === value);

  const accessibleName = ariaLabel ?? label;
  const labelledBy = accessibleName ? undefined : fieldLabelId;

  const surfaceClass = compact
    ? css.triggerSm
    : surface === 'pill'
      ? css.triggerPill
      : css.triggerMd;

  const trigger = (
    // eslint-disable-next-line jsx-a11y/aria-activedescendant-has-tabindex
    <button
      ref={menu.triggerRef}
      id={id}
      type="button"
      role="combobox"
      aria-haspopup="listbox"
      aria-expanded={menu.open}
      aria-controls={menu.listId}
      aria-activedescendant={menu.open ? menu.activeId : undefined}
      aria-label={accessibleName}
      aria-labelledby={labelledBy}
      disabled={disabled}
      tabIndex={tabIndex ?? 0}
      onClick={menu.toggle}
      onKeyDown={menu.handleKeyDown}
      className={[
        css.trigger,
        surfaceClass,
        active ? css.triggerActive : undefined,
        disabled ? css.triggerDisabled : undefined,
        className,
      ]
        .filter(Boolean)
        .join(' ')}
    >
      {icon && <span className={css.icon}>{icon}</span>}
      {compact ? null : (
        <>
          <span className={css.value}>{selected?.label ?? ''}</span>
          <span className={css.caret}>
            <CaretDownIcon size={14} />
          </span>
        </>
      )}
    </button>
  );

  const listbox = (
    <Popover
      open={menu.open}
      onClose={() => menu.closeMenu()}
      anchorRef={menu.triggerRef}
      placement="bottom-start"
      role="listbox"
      id={menu.listId}
      labelledBy={labelledBy}
      matchAnchorWidth={!compact}
      contentWidth={compact}
      dense
      popoverRef={menu.listRef}
    >
      {options.map((option, index) => {
        const selected = option.value === value;
        const highlighted = index === menu.activeIndex;
        return (
          <div
            key={option.value}
            id={`${menu.listId}-option-${index}`}
            role="option"
            aria-selected={selected}
            aria-disabled={option.disabled || undefined}
            data-index={index}
            tabIndex={-1}
            className={[
              css.option,
              highlighted ? css.optionHighlight : undefined,
              selected && !highlighted ? css.optionSelected : undefined,
            ]
              .filter(Boolean)
              .join(' ')}
            onClick={() => menu.select(index)}
            onMouseEnter={() => menu.setHighlight(index)}
          >
            {option.label}
          </div>
        );
      })}
    </Popover>
  );

  if (compact && label) {
    return (
      <>
        <Tooltip content={label}>
          <span className={css.tooltipAnchor}>{trigger}</span>
        </Tooltip>
        {listbox}
      </>
    );
  }

  return (
    <>
      {trigger}
      {listbox}
    </>
  );
}
