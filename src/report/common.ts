/** Utilitários compartilhados pelos relatórios PDF (comercial e técnico). */
import type { jsPDF } from 'jspdf';
import { rgb } from '../design/tokens';

export type RGB = [number, number, number];
export const BLUE: RGB = rgb('brand-primary');
export const GREY_BRAND: RGB = rgb('brand-grey');
export const NAVY: RGB = rgb('ui-dark');
export const GREY: RGB = rgb('ui-muted');
export const INK: RGB = rgb('ui-graphite');
export const LIGHT: RGB = rgb('ui-light');
export const LINE: RGB = rgb('ui-line');
export const PAL: RGB[] = [[0, 105, 174], [228, 87, 46], [240, 162, 2], [31, 157, 85], [107, 91, 210], [70, 179, 230], [156, 154, 160], [194, 124, 0], [72, 72, 72]];

/** A fonte padrão do PDF (Helvetica, WinAnsi) não cobre letras gregas nem subscritos: substitui por equivalentes. */
export const clean = (s: string) => s
  .replace(/₃/g, '3').replace(/₂/g, '2').replace(/≈/g, '~').replace(/−/g, '-').replace(/→/g, '->').replace(/λ/g, 'lambda')
  .replace(/Δ/g, 'd').replace(/η/g, 'eta').replace(/θ/g, 'theta').replace(/ρ/g, 'rho').replace(/√/g, 'raiz').replace(/≥/g, '>=').replace(/≤/g, '<=')
  .replace(/±/g, '+/-').replace(/∓/g, '-/+').replace(/[“”]/g, '"').replace(/[‘’]/g, "'").replace(/✓/g, 'OK');

export const n = (v: number, d = 0) => (Number.isFinite(v) ? v.toLocaleString('pt-BR', { minimumFractionDigits: d, maximumFractionDigits: d }) : '-');
export const brl = (v: number) => (Number.isFinite(v) ? v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 }) : '-');
export const hex = (h: string): RGB => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)];

/** Símbolo do floco de neve desenhado em vetor (mesmos vértices do favicon), com o canto superior esquerdo em (x, y). */
const POLYS: [number, number][][] = [
  [[74, 5], [129, 37], [129, 100], [74, 69]], [[165, 36], [220, 5], [220, 68], [165, 100]], [[3, 130], [57, 100], [109, 130], [56, 161]],
  [[185, 130], [239, 100], [290, 131], [238, 161]], [[74, 192], [129, 160], [129, 227], [74, 259]], [[165, 160], [220, 192], [220, 259], [165, 227]],
];
export function drawLogo(doc: jsPDF, x: number, y: number, size: number) {
  const k = size / 290;
  POLYS.forEach((poly, i) => {
    doc.setFillColor(...(i === 5 ? BLUE : GREY_BRAND));
    const [x0, y0] = poly[0];
    const deltas = poly.slice(1).map((pt, j) => [(pt[0] - poly[j][0]) * k, (pt[1] - poly[j][1]) * k]);
    doc.lines(deltas, x + x0 * k, y + y0 * k, [1, 1], 'F', true);
  });
}

/** Escalas normalizadas usuais (ABNT NBR 8196): escolhe a maior que cabe na área disponível. */
export const SCALES = [20, 25, 50, 75, 100, 125, 150, 200, 250, 300, 400, 500, 750, 1000, 1250, 1500, 2000];
export function chooseScale(extentM: [number, number], availMm: [number, number]): number {
  for (const s of SCALES) if ((extentM[0] * 1000) / s <= availMm[0] && (extentM[1] * 1000) / s <= availMm[1]) return s;
  return SCALES[SCALES.length - 1];
}

/** Nome de arquivo seguro: remove acentos e caracteres especiais. */
export const slug = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^\w-]+/g, '_').replace(/_+/g, '_').replace(/^_|_$/g, '');

