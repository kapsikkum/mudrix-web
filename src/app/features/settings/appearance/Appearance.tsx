import { useAtom } from 'jotai';
import { useTranslation } from 'react-i18next';
import {
  themeAtom,
  messageLayoutAtom,
  type ThemeName,
  type MessageLayout,
} from '@/app/store/atoms';
import { THEMES, DEFAULT_THEME } from '@/theme/themes.css';
import { THEME_TOKENS } from '@/theme/themeTokens';
import { useEffect } from 'react';
import * as css from './Appearance.css';
import * as layoutCss from '../Settings.css';

interface ThemeOption {
  name: ThemeName;
  label: string;
  sidebar: string;
  accent: string;
  accentMuted: string;
  bg: string;
  bubble: string;
  bubbleMine: string;
  inputBar: string;
  textLine: string;
}

const THEME_OPTIONS: ThemeOption[] = [
  {
    name: 'Carbon',
    label: 'Carbon',
    sidebar: THEME_TOKENS.Carbon.color.bgPrimary,
    accent: THEME_TOKENS.Carbon.color.accent,
    accentMuted: THEME_TOKENS.Carbon.color.textMuted,
    bg: THEME_TOKENS.Carbon.color.bgSecondary,
    bubble: THEME_TOKENS.Carbon.color.msgOtherBg,
    bubbleMine: THEME_TOKENS.Carbon.color.msgMineBg,
    inputBar: THEME_TOKENS.Carbon.color.bgTertiary,
    textLine: THEME_TOKENS.Carbon.color.textPrimary,
  },
  {
    name: 'Parrot',
    label: 'Parrot',
    sidebar: THEME_TOKENS.Parrot.color.bgPrimary,
    accent: THEME_TOKENS.Parrot.color.accent,
    accentMuted: THEME_TOKENS.Parrot.color.textMuted,
    bg: THEME_TOKENS.Parrot.color.bgSecondary,
    bubble: THEME_TOKENS.Parrot.color.msgOtherBg,
    bubbleMine: THEME_TOKENS.Parrot.color.msgMineBg,
    inputBar: THEME_TOKENS.Parrot.color.bgTertiary,
    textLine: THEME_TOKENS.Parrot.color.textPrimary,
  },
  {
    name: 'Ethereal',
    label: 'Ethereal',
    sidebar: THEME_TOKENS.Ethereal.color.bgPrimary,
    accent: THEME_TOKENS.Ethereal.color.accent,
    accentMuted: THEME_TOKENS.Ethereal.color.textSecondary,
    bg: THEME_TOKENS.Ethereal.color.bgSecondary,
    bubble: THEME_TOKENS.Ethereal.color.msgOtherBg,
    bubbleMine: THEME_TOKENS.Ethereal.color.msgMineBg,
    inputBar: THEME_TOKENS.Ethereal.color.bgInput,
    textLine: THEME_TOKENS.Ethereal.color.textPrimary,
  },
];

function ThemePreview({ opt }: { opt: ThemeOption }) {
  return (
    <div className={css.tpWindow}>
      {/* Sidebar */}
      <div className={css.tpSidebar} style={{ backgroundColor: opt.sidebar }}>
        <div className={css.tpSbItemActive} style={{ backgroundColor: opt.accent }} />
        <div className={css.tpSbItem} style={{ backgroundColor: opt.accentMuted }} />
        <div className={css.tpSbItem} style={{ backgroundColor: opt.accentMuted }} />
      </div>

      {/* Chat area */}
      <div className={css.tpChat} style={{ backgroundColor: opt.bg }}>
        <div className={css.tpMessages}>
          {/* Other person's message */}
          <div className={css.tpMsg}>
            <div className={css.tpAvatar} style={{ backgroundColor: opt.accent }} />
            <div className={css.tpBubble} style={{ backgroundColor: opt.bubble }}>
              <div className={css.tpLineWide} style={{ backgroundColor: opt.textLine }} />
              <div className={css.tpLineNarrow} style={{ backgroundColor: opt.textLine }} />
            </div>
          </div>
          {/* Own message */}
          <div className={css.tpMsg}>
            <div className={css.tpAvatar} style={{ backgroundColor: opt.accent }} />
            <div className={css.tpBubble} style={{ backgroundColor: opt.bubbleMine }}>
              <div className={css.tpLineMed} style={{ backgroundColor: opt.textLine }} />
            </div>
          </div>
        </div>
        {/* Input bar */}
        <div className={css.tpInputBar} style={{ backgroundColor: opt.inputBar }} />
      </div>
    </div>
  );
}

function ClassicLayoutPreview() {
  return (
    <div className={css.lpWindow}>
      {/* Message from other */}
      <div className={css.lpMsg}>
        <div className={css.lpAvatar} />
        <div className={css.lpBubble}>
          <div className={css.lpName} />
          <div className={css.lpLineWide} />
          <div className={css.lpLineNarrow} />
        </div>
      </div>
      {/* Own message */}
      <div className={css.lpMsg}>
        <div className={css.lpAvatar} />
        <div className={css.lpBubbleMine}>
          <div className={css.lpLineMed} style={{ opacity: 0.8 }} />
        </div>
      </div>
      {/* Another message */}
      <div className={css.lpMsg}>
        <div className={css.lpAvatar} />
        <div className={css.lpBubble}>
          <div className={css.lpName} />
          <div className={css.lpLineMed} />
        </div>
      </div>
    </div>
  );
}

function ModernLayoutPreview() {
  return (
    <div className={css.lpWindowModern}>
      {/* First message — shows avatar + name */}
      <div className={css.lpRow}>
        <div className={css.lpAvatar} />
        <div className={css.lpBody}>
          <div className={css.lpName} />
          <div className={css.lpLineWide} />
        </div>
      </div>
      {/* Grouped follow-up — avatar hidden */}
      <div className={css.lpRow}>
        <div className={css.lpAvatarHidden} />
        <div className={css.lpBody}>
          <div className={css.lpLineNarrow} />
        </div>
      </div>
      {/* New sender */}
      <div className={css.lpRow}>
        <div className={css.lpAvatarAlt} />
        <div className={css.lpBody}>
          <div className={css.lpNameAlt} />
          <div className={css.lpLineMed} />
        </div>
      </div>
    </div>
  );
}

export function Appearance() {
  const { t } = useTranslation();
  const [theme, setTheme] = useAtom(themeAtom);
  const [layout, setLayout] = useAtom(messageLayoutAtom);

  // Apply theme class immediately on change
  useEffect(() => {
    const themeClass = THEMES[theme] ?? THEMES[DEFAULT_THEME];
    Object.values(THEMES).forEach((cls) => document.documentElement.classList.remove(cls));
    document.documentElement.classList.add(themeClass);
  }, [theme]);

  return (
    <div>
      <h2 className={layoutCss.panelTitle}>{t('settings.appearance.title')}</h2>

      {/* ── Message Layout ── */}
      <div className={layoutCss.section}>
        <h3 className={layoutCss.sectionTitle}>{t('settings.appearance.messageLayout')}</h3>
        <div className={css.pickerRow}>
          {(['modern', 'classic'] as MessageLayout[]).map((l) => {
            const isActive = layout === l;
            return (
              <button
                type="button"
                key={l}
                onClick={() => setLayout(l)}
                className={isActive ? css.pickerBtnActive : css.pickerBtn}
              >
                {l === 'classic' ? <ClassicLayoutPreview /> : <ModernLayoutPreview />}
                <span className={isActive ? css.pickerLabelActive : css.pickerLabel}>
                  {l === 'classic'
                    ? t('settings.appearance.classic')
                    : t('settings.appearance.modern')}
                  {l === 'classic' && <span className={css.betaTag}>Beta</span>}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      <div className={layoutCss.divider} />

      {/* ── Theme ── */}
      <div className={layoutCss.section}>
        <h3 className={layoutCss.sectionTitle}>{t('settings.appearance.theme')}</h3>
        <div className={css.pickerRow}>
          {THEME_OPTIONS.map((opt) => {
            const isActive = theme === opt.name;
            return (
              <button
                type="button"
                key={opt.name}
                onClick={() => setTheme(opt.name)}
                className={isActive ? css.pickerBtnActive : css.pickerBtn}
              >
                <ThemePreview opt={opt} />
                <span className={isActive ? css.pickerLabelActive : css.pickerLabel}>
                  {opt.label}
                </span>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
