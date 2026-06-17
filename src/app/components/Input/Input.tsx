import { forwardRef, useId } from 'react';
import * as css from './Input.css';

interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  helperText?: string;
  error?: string;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(function Input(
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
      <input
        ref={ref}
        id={inputId}
        className={[css.input, className].filter(Boolean).join(' ')}
        {...rest}
      />
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
