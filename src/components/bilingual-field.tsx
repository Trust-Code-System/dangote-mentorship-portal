import * as React from 'react';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { TranslateToggle } from '@/components/translate-toggle';
import { cn } from '@/lib/utils';

// Bilingual compose/read controls. Language chips are omitted; saved content
// keeps its on-demand translation action and original language metadata.

type Lang = 'EN' | 'FR';

interface BilingualFieldProps {
  id: string;
  name: string;
  label: string;
  as?: 'textarea' | 'input';
  defaultValue?: string;
  /** Controlled value. Pass with `onChange` for forms that autosave a draft. */
  value?: string;
  onChange?: (value: string) => void;
  placeholder?: string;
  required?: boolean;
  helperText?: string;
  rows?: number;
  className?: string;
}

export function BilingualField({
  id,
  name,
  label,
  as = 'textarea',
  defaultValue,
  value,
  onChange,
  placeholder,
  required,
  helperText,
  rows,
  className,
}: BilingualFieldProps) {
  // Controlled when an onChange handler is supplied (autosaving forms); else the
  // field stays uncontrolled with a defaultValue (server-action forms).
  const controlled = onChange
    ? { value: value ?? '', onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => onChange(e.target.value) }
    : { defaultValue };

  return (
    <div className={cn('space-y-1.5', className)}>
      <Label htmlFor={id}>
        {label}
        {required && <span className="ml-0.5 text-risk">*</span>}
      </Label>
      {as === 'input' ? (
        <Input id={id} name={name} placeholder={placeholder} required={required} {...controlled} />
      ) : (
        <Textarea id={id} name={name} placeholder={placeholder} required={required} rows={rows} {...controlled} />
      )}
      {helperText && <p className="text-micro text-ink-3">{helperText}</p>}
    </div>
  );
}

interface BilingualContentProps {
  entityType: string;
  entityId: string;
  text: string;
  sourceLang: Lang;
  className?: string;
}

export function BilingualContent({
  entityType,
  entityId,
  text,
  sourceLang,
  className,
}: BilingualContentProps) {
  return (
    <div className={cn('space-y-1', className)}>
      <TranslateToggle
        entityType={entityType}
        entityId={entityId}
        text={text}
        sourceLang={sourceLang}
        className="text-body text-ink"
      />
    </div>
  );
}
