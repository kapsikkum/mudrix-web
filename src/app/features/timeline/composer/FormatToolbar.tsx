import { useTranslation } from 'react-i18next';
import {
  TextBIcon,
  TextItalicIcon,
  TextStrikethroughIcon,
  CodeIcon,
  QuotesIcon,
  LinkIcon,
} from '@phosphor-icons/react';
import { Tooltip } from '@/app/components/Tooltip';
import { MODIFIER_KEY } from '@/app/util/platform';
import * as css from '../Composer.css';

export type FormatType = 'bold' | 'italic' | 'strike' | 'code' | 'quote' | 'link';

interface FormatToolbarProps {
  top: number;
  left: number;
  activeFormats: FormatType[];
  onFormat: (fmt: FormatType, e: React.MouseEvent) => void;
}

export function FormatToolbar({ top, left, activeFormats, onFormat }: FormatToolbarProps) {
  const { t } = useTranslation();

  const buttons: { fmt: FormatType; icon: React.ReactNode; label: string }[] = [
    {
      fmt: 'bold',
      icon: <TextBIcon size={14} />,
      label: t('composer.formatting.bold', { mod: MODIFIER_KEY }),
    },
    {
      fmt: 'italic',
      icon: <TextItalicIcon size={14} />,
      label: t('composer.formatting.italic', { mod: MODIFIER_KEY }),
    },
    {
      fmt: 'strike',
      icon: <TextStrikethroughIcon size={14} />,
      label: t('composer.formatting.strikethrough'),
    },
    { fmt: 'code', icon: <CodeIcon size={14} />, label: t('composer.formatting.code') },
    { fmt: 'quote', icon: <QuotesIcon size={14} />, label: t('composer.formatting.quote') },
    { fmt: 'link', icon: <LinkIcon size={14} />, label: t('composer.formatting.link') },
  ];

  return (
    <div className={css.floatingToolbar} style={{ top, left }}>
      {buttons.map(({ fmt, icon, label }) => (
        <Tooltip placement="top" content={label} key={fmt}>
          <button
            type="button"
            className={activeFormats.includes(fmt) ? css.fmtBtnActive : css.fmtBtn}
            aria-label={label}
            onMouseDown={(e) => onFormat(fmt, e)}
          >
            {icon}
          </button>
        </Tooltip>
      ))}
    </div>
  );
}
