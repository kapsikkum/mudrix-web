import { forwardRef, useId, useState } from 'react';
import { EyeIcon, EyeSlashIcon } from '@phosphor-icons/react';
import { useTranslation } from 'react-i18next';
import { IconButton } from '@/app/components/Button';
import * as css from './Input.css';

interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  helperText?: string;
  error?: string;
  showPasswordToggle?: boolean;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(function Input(
  { label: labelText, helperText, error, className, id, type, showPasswordToggle, ...rest },
  ref
) {
  const { t } = useTranslation();
  const generatedId = useId();
  const inputId = id ?? generatedId;
  const isPassword = type === 'password' && showPasswordToggle;
  const [visible, setVisible] = useState(false);
  const resolvedType = isPassword ? (visible ? 'text' : 'password') : type;
  return (
    <div
      className={[css.wrap, isPassword ? css.wrapWithToggle : undefined].filter(Boolean).join(' ')}
    >
      {labelText && (
        <label htmlFor={inputId} className={css.label}>
          {labelText}
        </label>
      )}
      <div className={css.inputWrap}>
        <input
          ref={ref}
          id={inputId}
          type={resolvedType}
          className={[css.input, isPassword ? css.inputWithToggle : undefined, className]
            .filter(Boolean)
            .join(' ')}
          {...rest}
        />
        {isPassword && (
          <IconButton
            type="button"
            size="sm"
            className={css.passwordToggle}
            onClick={() => setVisible((v) => !v)}
            aria-label={visible ? t('common.hide') : t('common.show')}
            tabIndex={-1}
          >
            {visible ? <EyeSlashIcon size={16} /> : <EyeIcon size={16} />}
          </IconButton>
        )}
      </div>
      {error && <span className={css.errorText}>{error}</span>}
      {helperText && !error && <span className={css.helperText}>{helperText}</span>}
    </div>
  );
});

interface TextareaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: string;
  helperText?: string;
  error?: string;
}

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(function Textarea(
  { label: labelText, helperText, error, className, id, ...rest },
  ref
) {
  const generatedId = useId();
  const inputId = id ?? generatedId;
  return (
    <div className={css.wrap}>
      {labelText && (
        <label htmlFor={inputId} className={css.label}>
          {labelText}
        </label>
      )}
      <textarea
        ref={ref}
        id={inputId}
        className={[css.textarea, className].filter(Boolean).join(' ')}
        {...rest}
      />
      {error && <span className={css.errorText}>{error}</span>}
      {helperText && !error && <span className={css.helperText}>{helperText}</span>}
    </div>
  );
});
