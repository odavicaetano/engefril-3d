/** Acesso tipado aos tokens de identidade (src/design/design-tokens.json), usados pelo site, PDFs e planilhas. */
import tokens from './design-tokens.json';

export type ColorToken = keyof typeof tokens.color;
export const TOKENS = tokens;
export const color = (k: ColorToken): string => tokens.color[k].value;
export const rgb = (k: ColorToken): [number, number, number] => {
  const h = color(k);
  return [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)];
};
/** ARGB para planilhas (ExcelJS). */
export const argb = (k: ColorToken): string => 'FF' + color(k).slice(1).toUpperCase();

/** Aplica os tokens como variáveis CSS da interface. */
export function applyCssTokens(root: HTMLElement = document.documentElement) {
  const map: Record<string, ColorToken> = {
    '--brand': 'brand-primary', '--brand-grey': 'brand-grey', '--navy': 'ui-dark', '--ink': 'ui-graphite', '--bg': 'ui-light',
    '--accent': 'ui-accent', '--muted': 'ui-muted', '--line': 'ui-line', '--warn': 'state-warning', '--err': 'state-error', '--ok': 'state-ok',
  };
  for (const [v, k] of Object.entries(map)) root.style.setProperty(v, color(k));
  root.style.setProperty('--font', tokens.typography.web);
}

/** Nome de arquivo padronizado: ENGEFRIL3D_<projeto>_<tipo>_<revisão>_<AAAAMMDD>.<ext> */
export function standardFileName(project: string, kind: string, revision: string, ext: string, date = new Date()) {
  const slug = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^\w-]+/g, '_').replace(/_+/g, '_').replace(/^_|_$/g, '');
  const d = `${date.getFullYear()}${String(date.getMonth() + 1).padStart(2, '0')}${String(date.getDate()).padStart(2, '0')}`;
  return `ENGEFRIL3D_${slug(project).slice(0, 48)}_${slug(kind)}_${slug(revision || 'R0')}_${d}.${ext}`;
}
