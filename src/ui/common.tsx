import { useEffect, useState, type ReactNode } from 'react';
import { ORIGIN_LABEL, type Origin } from '../data/sources';
import { GLOSSARY } from '../data/glossary';

export const fmt = (v: number, d = 1) => (Number.isFinite(v) ? v.toLocaleString('pt-BR', { minimumFractionDigits: d, maximumFractionDigits: d }) : '—');
export const fmt0 = (v: number) => fmt(v, 0);
export const brl = (v: number) => (Number.isFinite(v) ? v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 }) : '—');
/** Arredonda para 2 algarismos significativos: evita falsa precisão em estimativas. */
export const sig = (v: number, s = 2) => { if (!Number.isFinite(v) || v === 0) return v; const k = Math.pow(10, s - Math.ceil(Math.log10(Math.abs(v)))); return Math.round(v * k) / k; };

export function Num({ label, value, onChange, unit, min, max, step = 1, hint, tag }: { label: ReactNode; value: number; onChange: (v: number) => void; unit?: string; min?: number; max?: number; step?: number; hint?: string; tag?: string }) {
  const [txt, setTxt] = useState(String(value));
  useEffect(() => { if (Number(txt.replace(',', '.')) !== value) setTxt(String(value)); }, [value]); // eslint-disable-line react-hooks/exhaustive-deps
  const bad = (() => { const v = Number(txt.replace(',', '.')); return !Number.isFinite(v) || (min !== undefined && v < min) || (max !== undefined && v > max); })();
  return (
    <label className="field" title={hint}>
      <span>{label}</span>
      <div className="unit-in">
        <input inputMode="decimal" value={txt} aria-invalid={bad} style={bad ? { borderColor: 'var(--err)' } : undefined}
          onChange={(e) => {
            setTxt(e.target.value);
            const v = Number(e.target.value.replace(',', '.'));
            if (e.target.value.trim() !== '' && Number.isFinite(v) && (min === undefined || v >= min) && (max === undefined || v <= max)) onChange(v);
          }}
          onBlur={() => setTxt(String(value))} step={step} data-tag={tag} />
        {unit && <em>{unit}</em>}
      </div>
      {bad && <small style={{ color: 'var(--err)' }}>Valor fora da faixa {min ?? '−∞'} a {max ?? '∞'}</small>}
    </label>
  );
}

export function Slider({ label, value, onChange, min, max, step = 1, unit = '', format }: { label: ReactNode; value: number; onChange: (v: number) => void; min: number; max: number; step?: number; unit?: string; format?: (v: number) => string }) {
  return (
    <label className="slider">
      <span>{label}</span>
      <b>{format ? format(value) : `${fmt(value, step < 1 ? (step < 0.1 ? 2 : 1) : 0)} ${unit}`}</b>
      <input type="range" min={min} max={max} step={step} value={value} onChange={(e) => onChange(Number(e.target.value))} />
    </label>
  );
}

export function Select<T extends string>({ label, value, onChange, options }: { label: ReactNode; value: T; onChange: (v: T) => void; options: { value: T; label: string }[] }) {
  return (
    <label className="field">
      <span>{label}</span>
      <select value={value} onChange={(e) => onChange(e.target.value as T)}>
        {options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
      </select>
    </label>
  );
}

export function Check({ label, checked, onChange }: { label: ReactNode; checked: boolean; onChange: (v: boolean) => void }) {
  return <label className="check"><input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} />{label}</label>;
}

export function Seg<T extends string>({ value, options, onChange }: { value: T; options: { value: T; label: string }[]; onChange: (v: T) => void }) {
  return <div className="seg" role="radiogroup">{options.map((o) => <button key={o.value} role="radio" aria-checked={o.value === value} className={o.value === value ? 'on' : ''} onClick={() => onChange(o.value)}>{o.label}</button>)}</div>;
}

export const OriginChip = ({ o }: { o: Origin }) => <span className={`chip o-${o}`}>{ORIGIN_LABEL[o]}</span>;

export function Term({ id, children }: { id: keyof typeof GLOSSARY | string; children?: ReactNode }) {
  const g = GLOSSARY[id];
  if (!g) return <>{children}</>;
  return (
    <span className="term" tabIndex={0}>{children ?? g.term}
      <span className="term-pop" role="tooltip"><b>{g.term}</b><br />{g.def}{g.ex && <><br /><i>Ex.: {g.ex}</i></>}</span>
    </span>
  );
}

export function Card({ title, children, icon, right }: { title?: ReactNode; children: ReactNode; icon?: ReactNode; right?: ReactNode }) {
  return <div className="card">{title && <h3>{icon}{title}<span className="spacer" />{right}</h3>}{children}</div>;
}
