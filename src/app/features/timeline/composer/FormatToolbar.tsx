import { useTranslation } from 'react-i18next';
import {
  TextBIcon,
  TextItalicIcon,
  TextStrikethroughIcon,
  CodeIcon,
  QuotesIcon,
  LinkIcon,
} from '@phosphor-icons/react';
import { MODIFIER_KEY } from '@/app/util/platform';
import * as css from '../Composer.css';

export type FormatType = 'bold' | 'italic' | 'strike' | 'code' | 'quote' | 'link';

interface FormatToolbarProps {
  top: number;
  left: number;
  onFormat: (fmt: FormatType, e: React.MouseEvent) => void;
}

export function FormatToolbar({ top, left, onFormat }: FormatToolbarProps) {
  const { t } = useTranslation();

  const buttons: { fmt: FormatType; icon: React.ReactNode; title: string }[] = [
    {
      fmt: 'bold',
      icon: <TextBIcon size={14} />,
      title: t('composer.formatting.bold', { mod: MODIFIER_KEY }),
    },
    {
      fmt: 'italic',
      icon: <TextItalicIcon size={14} />,
      title: t('composer.formatting.italic', { mod: MODIFIER_KEY }),
    },
    {
      fmt: 'strike',
      icon: <TextStrikethroughIcon size={14} />,
      title: t('composer.formatting.strikethrough'),
    },
    { fmt: 'code', icon: <CodeIcon size={14} />, title: t('composer.formatting.code') },
    { fmt: 'quote', icon: <QuotesIcon size={14} />, title: t('composer.formatting.quote') },
    { fmt: 'link', icon: <LinkIcon size={14} />, title: t('composer.formatting.link') },
  ];

  return (
    <div className={css.floatingToolbar} style={{ top, left }}>
      {buttons.map(({ fmt, icon, title }) => (
        <button
          key={fmt}
          className={css.fmtBtn}
          title={title}
          onMouseDown={(e) => onFormat(fmt, e)}
        >
          {icon}
        </button>
      ))}
    </div>
  );
}
