/**
 * Kit de componentes PDF A4 compartilhados pelos relatórios da família ENGEFRIL 3D.
 * Componentes: PDFHeader, PDFFooter, Cover, SectionTitle, TechnicalTable, Disclaimer e primitivas de
 * TechnicalDrawing (moldura, legenda/carimbo, cotas, escala gráfica). As cores e a tipografia vêm de
 * src/design/design-tokens.json. Ver docs/GUIA_EXPORTACAO.md para replicar em outros projetos.
 */
import { jsPDF } from 'jspdf';
import { BLUE, NAVY, GREY, INK, LIGHT, LINE, PAL, clean, drawLogo, type RGB } from './common';
import { TOKENS } from '../design/tokens';

export type PageKind = 'capa' | 'texto' | 'desenho';
export type Orientation = 'auto' | 'retrato' | 'paisagem';
export interface Col { h: string; w: number; a?: 'l' | 'r' | 'c' }
export interface DocInfo {
  title: string; // título longo (capa, metadados)
  shortTitle: string; // título abreviado (cabeçalho)
  subject: string;
  code: string; revision: string; date: string;
  project: string; client?: string;
  classification: string; // ex.: "Estudo preliminar"
  disclaimer: string;
  keywords?: string;
}
export const MARGINS = TOKENS.document.marginsMm;

export class PdfComposer {
  readonly doc: jsPDF;
  readonly kinds: PageKind[] = [];
  readonly toc: { title: string; page: number; level: number }[] = [];
  readonly sheetTitles: Record<number, { title: string; scale: string }> = {};
  y = 0;
  W = 0; H = 0;
  readonly ML = MARGINS.text.left; readonly MR = MARGINS.text.right;
  private orientationMode: Orientation;

  constructor(readonly info: DocInfo, opts: { orientation: Orientation; compress?: boolean; first?: PageKind }) {
    this.orientationMode = opts.orientation;
    const first = opts.first ?? 'capa';
    this.doc = new jsPDF({ unit: 'mm', format: 'a4', orientation: this.orient(first), compress: opts.compress ?? true });
    this.kinds.push(first);
    this.syncSize();
    this.doc.setProperties({ title: info.title, subject: info.subject, author: 'ENGEFRIL 3D (protótipo demonstrativo)', creator: 'ENGEFRIL 3D', keywords: info.keywords ?? 'refrigeração industrial, amônia, R717, pré-dimensionamento' });
    this.doc.setLanguage('pt-BR');
    (this.doc as any).viewerPreferences?.({ DisplayDocTitle: true });
    if (first === 'texto') { this.PDFHeader(); this.y = MARGINS.text.top; }
  }

  orient = (k: PageKind): 'portrait' | 'landscape' => (this.orientationMode === 'auto' ? (k === 'desenho' ? 'landscape' : 'portrait') : this.orientationMode === 'paisagem' ? 'landscape' : 'portrait');
  private syncSize() { this.W = this.doc.internal.pageSize.getWidth(); this.H = this.doc.internal.pageSize.getHeight(); }
  cw = () => this.W - this.ML - this.MR;
  bottom = () => this.H - MARGINS.text.bottom;
  page = () => this.doc.getNumberOfPages();

  newPage = (k: PageKind) => {
    this.doc.addPage('a4', this.orient(k));
    this.kinds.push(k);
    this.syncSize();
    if (k === 'texto') { this.PDFHeader(); this.y = MARGINS.text.top; }
  };
  need = (h: number) => { if (this.y + h > this.bottom()) this.newPage('texto'); };

  // ---------------- tipografia
  font = (size: number, style: 'normal' | 'bold' | 'italic' = 'normal', color: RGB = INK, face = 'helvetica') => { this.doc.setFont(face, style); this.doc.setFontSize(size); this.doc.setTextColor(...color); };
  lh = (size: number) => size * 0.42;

  /** PDFHeader: faixa discreta com símbolo, título abreviado e identificação (somente páginas de texto). */
  PDFHeader = () => {
    const { doc, W, ML, MR, info } = this;
    doc.setFillColor(...NAVY); doc.rect(0, 0, W, 14, 'F');
    doc.setFillColor(...BLUE); doc.rect(0, 14, W, 0.8, 'F');
    drawLogo(doc, ML, 3, 8);
    this.font(9.5, 'bold', [255, 255, 255]); doc.text('ENGEFRIL 3D', ML + 11, 7.2);
    this.font(7.5, 'normal', [255, 255, 255]); doc.text(clean(info.shortTitle), ML + 11, 11);
    doc.text(clean(`${info.code} · ${info.revision} · ${info.date}`), W - MR, 9, { align: 'right' });
  };
  /** PDFFooter: aviso curto, versão, data e numeração (páginas de texto e capa). */
  PDFFooter = (i: number, total: number) => {
    const { doc, W, H, ML, MR, info } = this;
    this.line(0.2, LINE); doc.line(ML, H - 13, W - MR, H - 13);
    this.font(6.8, 'normal', GREY);
    doc.text(doc.splitTextToSize(clean(`${info.classification}. Gerado por protótipo demonstrativo inspirado na Engefril, sem vínculo oficial; não é projeto executivo.`), W - ML - MR - 50), ML, H - 9.5);
    doc.text(clean(`${info.revision} · ${info.date} · ${i} / ${total}`), W - MR, H - 9.5, { align: 'right' });
  };

  /** SectionTitle: título numerado de seção (inicia página nova) e subtítulo. */
  SectionTitle = (title: string) => {
    this.newPage('texto');
    this.toc.push({ title, page: this.page(), level: 1 });
    this.font(13.5, 'bold', BLUE); this.doc.text(clean(title), this.ML, this.y);
    this.doc.setDrawColor(...BLUE); this.doc.setLineWidth(0.4); this.doc.line(this.ML, this.y + 1.8, this.W - this.MR, this.y + 1.8);
    this.y += 8.5;
  };
  SubTitle = (title: string, toc = true) => { this.need(14); if (toc) this.toc.push({ title, page: this.page(), level: 2 }); this.font(10.5, 'bold', NAVY); this.doc.text(clean(title), this.ML, this.y); this.y += 5.5; };
  para = (t: string, size = 9.2, color: RGB = INK, style: 'normal' | 'italic' | 'bold' = 'normal') => {
    this.font(size, style, color);
    for (const line of this.doc.splitTextToSize(clean(t), this.cw())) { this.need(this.lh(size) + 0.6); this.doc.text(line, this.ML, this.y); this.y += this.lh(size) + 0.6; }
    this.y += 1.6;
  };
  note = (t: string) => this.para(t, 7.8, GREY, 'italic');
  bullets = (items: string[], size = 9) => {
    for (const it of items) {
      this.font(size);
      const lines = this.doc.splitTextToSize(clean(it), this.cw() - 5) as string[];
      this.need(lines.length * (this.lh(size) + 0.5));
      this.doc.setFillColor(...BLUE); this.doc.circle(this.ML + 1.2, this.y - 1.1, 0.6, 'F');
      this.font(size);
      lines.forEach((ln) => { this.doc.text(ln, this.ML + 4, this.y); this.y += this.lh(size) + 0.5; });
      this.y += 0.8;
    }
    this.y += 1;
  };
  /** Bloco de fórmulas em fonte monoespaçada, com fundo. */
  formula = (lines: string[]) => {
    const { doc } = this;
    this.font(8.6, 'normal', INK, 'courier');
    const wrapped = lines.flatMap((x) => doc.splitTextToSize(clean(x), this.cw() - 6) as string[]);
    const hgt = wrapped.length * 3.9 + 3.5;
    this.need(hgt + 1);
    doc.setFillColor(...LIGHT); doc.setDrawColor(...LINE); doc.setLineWidth(0.2); doc.rect(this.ML, this.y - 3, this.cw(), hgt, 'FD');
    doc.setFillColor(...BLUE); doc.rect(this.ML, this.y - 3, 0.9, hgt, 'F');
    this.font(8.6, 'normal', INK, 'courier');
    wrapped.forEach((ln, i) => doc.text(ln, this.ML + 3.5, this.y + 0.6 + i * 3.9));
    this.y += hgt + 2;
  };
  /** TechnicalTable: cabeçalho azul repetido a cada página, corpo alternado, alinhamento por coluna e linha de total. */
  TechnicalTable = (cols: Col[], rows: string[][], o: { size?: number; total?: boolean } = {}) => {
    const { doc } = this;
    const size = o.size ?? 8.2;
    const tw = this.cw(), ML = this.ML;
    const sum = cols.reduce((a, c) => a + c.w, 0);
    const ws = cols.map((c) => (c.w / sum) * tw);
    const pad = 1.4, lhh = this.lh(size) + 0.35;
    const alignX = (x: number, w: number, a?: string) => (a === 'r' ? x + w - pad : a === 'c' ? x + w / 2 : x + pad);
    const al = (a?: string) => (a === 'r' ? 'right' : a === 'c' ? 'center' : 'left') as 'right' | 'center' | 'left';
    const head = () => {
      this.font(size, 'bold', [255, 255, 255]);
      const hl = cols.map((c, i) => doc.splitTextToSize(clean(c.h), ws[i] - 2 * pad) as string[]);
      const hh = Math.max(...hl.map((x) => x.length)) * lhh + 2.6;
      this.need(hh + lhh + 3);
      this.font(size, 'bold', [255, 255, 255]);
      doc.setFillColor(...NAVY); doc.rect(ML, this.y - 3.6, tw, hh, 'F');
      let x = ML;
      hl.forEach((ls, i) => { ls.forEach((t, j) => doc.text(t, alignX(x, ws[i], cols[i].a), this.y + j * lhh, { align: al(cols[i].a) })); x += ws[i]; });
      this.y += hh;
    };
    head();
    rows.forEach((r, ri) => {
      const isTotal = o.total && ri === rows.length - 1;
      this.font(size, isTotal ? 'bold' : 'normal');
      const ls = r.map((c, i) => doc.splitTextToSize(clean(c ?? ''), ws[i] - 2 * pad) as string[]);
      const rh = Math.max(...ls.map((x) => x.length)) * lhh + 2.2;
      if (this.y + rh > this.bottom()) { this.newPage('texto'); head(); this.font(size, isTotal ? 'bold' : 'normal'); }
      if (isTotal) { doc.setFillColor(227, 240, 250); doc.rect(ML, this.y - 3.4, tw, rh, 'F'); }
      else if (ri % 2 === 0) { doc.setFillColor(...LIGHT); doc.rect(ML, this.y - 3.4, tw, rh, 'F'); }
      let x = ML;
      ls.forEach((cell, i) => { cell.forEach((t, j) => doc.text(t, alignX(x, ws[i], cols[i].a), this.y + j * lhh, { align: al(cols[i].a) })); x += ws[i]; });
      doc.setDrawColor(...LINE); doc.setLineWidth(0.15); doc.line(ML, this.y - 3.4 + rh, ML + tw, this.y - 3.4 + rh);
      this.y += rh;
    });
    this.y += 3.5;
  };
  kv = (rows: [string, string][]) => this.TechnicalTable([{ h: 'Item', w: 38 }, { h: 'Valor', w: 62 }], rows);
  /** Disclaimer: caixa de aviso (pré-dimensionamento orientativo) no fluxo ou em posição fixa. */
  Disclaimer = (text: string, at?: { x: number; y: number; w: number }) => {
    const { doc } = this;
    const w = at?.w ?? this.cw();
    this.font(8, 'bold', [120, 76, 0]);
    const dl = doc.splitTextToSize(clean(text), w - 6) as string[];
    const h = dl.length * 3.8 + 4;
    if (!at) this.need(h + 2);
    const x = at?.x ?? this.ML, yy = at?.y ?? this.y - 3;
    doc.setFillColor(253, 246, 232); doc.setDrawColor(194, 124, 0); doc.setLineWidth(0.3); doc.rect(x, yy, w, h, 'FD');
    this.font(8, 'bold', [120, 76, 0]); doc.text(dl, x + 3, yy + 4.5);
    if (!at) this.y += h + 3;
  };
  /** Gráfico de barras horizontal vetorial. */
  barChart = (title: string, rows: { label: string; v: number; txt: string }[]) => {
    this.SubTitle(title);
    const max = Math.max(...rows.map((r) => r.v), 1e-9);
    const lw = 52, bw = this.cw() - lw - 46;
    rows.forEach((r, i) => {
      this.need(6);
      this.font(8.2); this.doc.text(clean(r.label), this.ML, this.y);
      this.doc.setFillColor(238, 241, 244); this.doc.rect(this.ML + lw, this.y - 3, bw, 3.6, 'F');
      this.doc.setFillColor(...PAL[i % PAL.length]); this.doc.rect(this.ML + lw, this.y - 3, Math.max(0.3, (bw * r.v) / max), 3.6, 'F');
      this.font(7.8, 'normal', GREY); this.doc.text(clean(r.txt), this.W - this.MR, this.y, { align: 'right' });
      this.y += 5.6;
    });
    this.y += 2;
  };

  /** Cover: faixa escura com símbolo, título, projeto, classificação e quadro de identificação. */
  Cover = (rows: [string, string][], image?: string | null) => {
    const { doc, W, H, ML, MR, info } = this;
    doc.setFillColor(...NAVY); doc.rect(0, 0, W, H * 0.36, 'F');
    doc.setFillColor(...BLUE); doc.rect(0, H * 0.36, W, 1.5, 'F');
    drawLogo(doc, ML, 18, 22);
    this.font(12, 'bold', [255, 255, 255]); doc.text('ENGEFRIL 3D', ML + 27, 27);
    this.font(8.5, 'normal', [170, 200, 225]); doc.text(clean('Plataforma de refrigeração industrial · protótipo demonstrativo'), ML + 27, 32);
    this.font(8, 'bold', [255, 210, 140]); doc.text(clean(info.classification.toUpperCase()), W - MR, 27, { align: 'right' });
    this.font(22, 'bold', [255, 255, 255]);
    doc.text(doc.splitTextToSize(clean(info.title.split(':')[0]), W - 2 * ML), ML, H * 0.36 - 34);
    this.font(12, 'normal', [170, 200, 225]);
    doc.text(doc.splitTextToSize(clean(info.project + (info.client ? ` · Cliente: ${info.client}` : '')), W - 2 * ML), ML, H * 0.36 - 16);
    this.y = H * 0.36 + 12;
    this.kv(rows);
    if (image) {
      try {
        const pr = doc.getImageProperties(image);
        const iw = Math.min(this.cw(), (this.bottom() - this.y - 30) * (pr.width / pr.height));
        const ih = iw * (pr.height / pr.width);
        if (ih > 30) { doc.addImage(image, 'PNG', ML, this.y, iw, ih, undefined, 'FAST'); this.y += ih + 3; this.font(7, 'italic', GREY); doc.text(clean('Perspectiva ilustrativa do modelo 3D (não é desenho técnico).'), ML, this.y); this.y += 5; }
      } catch { /* imagem opcional */ }
    }
    this.Disclaimer(info.disclaimer, { x: ML, y: H - 34, w: W - ML - MR });
  };

  // ---------------- primitivas de desenho técnico
  line = (w: number, c: RGB = INK) => { this.doc.setLineWidth(w); this.doc.setDrawColor(...c); };
  dash = (on: boolean) => this.doc.setLineDashPattern(on ? [1.6, 1.0] : [], 0);
  /** Moldura da folha de desenho (margens da ABNT NBR 10068 para A4). */
  frame = () => {
    const m = MARGINS.drawing;
    const fx = m.left, fy = m.top, fw = this.W - m.left - m.right, fh = this.H - m.top - m.bottom;
    this.doc.setDrawColor(...NAVY); this.doc.setLineWidth(0.5); this.doc.rect(fx, fy, fw, fh);
    return { fx, fy, fw, fh };
  };
  /** Área útil do desenho (acima da legenda). */
  drawingArea = () => { const { fx, fy, fw, fh } = this.frame(); return { x: fx + 6, y: fy + 12, w: fw - 12, h: fh - 12 - 34 }; };
  sheetHead = (title: string, scale: string) => {
    this.toc.push({ title: '   ' + title, page: this.page(), level: 2 });
    this.sheetTitles[this.page()] = { title, scale };
    this.font(11, 'bold', NAVY); this.doc.text(clean(title), MARGINS.drawing.left + 6, 15);
  };
  arrow = (x: number, y0: number, dx: number, dy: number, s = 1.6) => {
    const L0 = Math.hypot(dx, dy) || 1, ux = dx / L0, uy = dy / L0;
    this.doc.setFillColor(...INK);
    this.doc.triangle(x, y0, x - ux * s - uy * s * 0.35, y0 - uy * s + ux * s * 0.35, x - ux * s + uy * s * 0.35, y0 - uy * s - ux * s * 0.35, 'F');
  };
  /** Cota horizontal (ABNT NBR 10126): texto entre as setas ou em segundo nível, com chamada. */
  dimH = (x1: number, x2: number, ye: number, yd: number, txt: string) => {
    const { doc } = this;
    if (Math.abs(x2 - x1) < 0.8) return;
    this.line(0.13, GREY); this.dash(false);
    doc.line(x1, ye, x1, yd + Math.sign(yd - ye) * 1.2); doc.line(x2, ye, x2, yd + Math.sign(yd - ye) * 1.2);
    doc.line(x1, yd, x2, yd);
    this.arrow(x1, yd, x1 - x2, 0, 1.4); this.arrow(x2, yd, x2 - x1, 0, 1.4);
    this.font(6.4, 'normal', INK);
    const tw = doc.getTextWidth(txt);
    if (tw + 1 < Math.abs(x2 - x1)) doc.text(txt, (x1 + x2) / 2, yd - 0.8, { align: 'center' });
    else {
      const up = Math.sign(yd - ye) < 0 ? -1 : 1;
      const ty = yd + (up < 0 ? -3.6 : 4.2);
      doc.line((x1 + x2) / 2, yd, (x1 + x2) / 2, ty + (up < 0 ? 0.8 : -2.6));
      doc.setFillColor(255, 255, 255); doc.rect((x1 + x2) / 2 - tw / 2 - 0.4, ty - 2.3, tw + 0.8, 2.8, 'F');
      doc.text(txt, (x1 + x2) / 2, ty, { align: 'center' });
    }
  };
  dimV = (y1: number, y2: number, xe: number, xd: number, txt: string) => {
    const { doc } = this;
    if (Math.abs(y2 - y1) < 0.8) return;
    this.line(0.13, GREY); this.dash(false);
    doc.line(xe, y1, xd + Math.sign(xd - xe) * 1.2, y1); doc.line(xe, y2, xd + Math.sign(xd - xe) * 1.2, y2);
    doc.line(xd, y1, xd, y2);
    this.arrow(xd, y1, 0, y1 - y2, 1.4); this.arrow(xd, y2, 0, y2 - y1, 1.4);
    this.font(6.4, 'normal', INK);
    const tw = doc.getTextWidth(txt);
    if (tw + 1 < Math.abs(y2 - y1)) doc.text(txt, xd - 0.8, (y1 + y2) / 2, { angle: 90, align: 'center' });
    else doc.text(txt, xd + Math.sign(xd - xe) * 1.2, (y1 + y2) / 2 + 1, { align: Math.sign(xd - xe) > 0 ? 'left' : 'right' });
  };
  /** Escala gráfica em metros. k = mm de papel por metro. */
  scaleBar = (x: number, y0: number, k: number, scale: number) => {
    const { doc } = this;
    const unit = [1, 2, 5, 10, 20, 50].find((s) => s * k >= 8) ?? 50;
    this.line(0.2); this.dash(false);
    for (let i = 0; i < 4; i++) { doc.setFillColor(...(i % 2 ? [255, 255, 255] as RGB : INK)); doc.rect(x + i * unit * k, y0, unit * k, 1.4, 'FD'); }
    this.font(6, 'normal', INK);
    for (let i = 0; i <= 4; i++) doc.text(`${i * unit}`, x + i * unit * k, y0 + 4, { align: 'center' });
    doc.text(`m   ESC. 1:${scale}`, x + 4 * unit * k + 3, y0 + 1.6);
  };
  /** Legenda (carimbo) da folha de desenho: projeto, conteúdo, escala, data, revisão e folha. */
  titleBlock = (i: number, total: number, drawingIndex: number, drawingCount: number) => {
    const { doc, W, H, info } = this;
    const sh = this.sheetTitles[i] ?? { title: '', scale: '' };
    const bw = Math.min(178, W - 32), bh = 30, bx = W - MARGINS.drawing.right - bw, by = H - MARGINS.drawing.bottom - bh;
    doc.setFillColor(255, 255, 255); this.line(0.4, NAVY); this.dash(false); doc.rect(bx, by, bw, bh, 'FD');
    doc.line(bx, by + 9, bx + bw, by + 9); doc.line(bx + 30, by, bx + 30, by + 9); doc.line(bx, by + 18, bx + bw, by + 18);
    const cx = [bx, bx + bw * 0.36, bx + bw * 0.56, bx + bw * 0.76];
    cx.slice(1).forEach((x) => doc.line(x, by + 18, x, by + bh));
    drawLogo(doc, bx + 2, by + 1.4, 6);
    this.font(6.2, 'bold', NAVY); doc.text('ENGEFRIL 3D', bx + 9.5, by + 4.2); this.font(4.8, 'normal', GREY); doc.text(clean('protótipo demonstrativo'), bx + 9.5, by + 7.2);
    this.font(5, 'normal', GREY); doc.text(clean(info.client ? 'PROJETO / CLIENTE' : 'PROJETO'), bx + 32, by + 3);
    this.font(7, 'bold', INK); doc.text(clean(info.project + (info.client ? ` · ${info.client}` : '')), bx + 32, by + 7.2, { maxWidth: bw - 34 });
    this.font(5, 'normal', GREY); doc.text(clean('FOLHA / CONTEÚDO'), bx + 2, by + 12); this.font(7.2, 'bold', NAVY); doc.text(clean(sh.title), bx + 2, by + 16.2, { maxWidth: bw - 4 });
    const cells: [string, string][] = [['ESCALA', sh.scale], ['DATA', info.date], ['REVISÃO', info.revision], ['FOLHA', `${drawingIndex}/${drawingCount} · pág. ${i}/${total}`]];
    cells.forEach(([a, b], j) => { this.font(5, 'normal', GREY); doc.text(clean(a), cx[j] + 1.5, by + 21.5); this.font(6.8, 'bold', INK); doc.text(clean(b), cx[j] + 1.5, by + 26); });
    this.font(4.6, 'bold', [160, 60, 40]);
    doc.text(clean(`${info.classification.toUpperCase()}: NÃO É PROJETO EXECUTIVO. SEM RESPONSÁVEL TÉCNICO / ART.`), bx + bw, by - 1.5, { align: 'right' });
  };

  /**
   * Finaliza o documento: rodapés, legendas das folhas de desenho, sumário (se houver página reservada)
   * e marcadores de navegação (bookmarks) a partir das seções registradas.
   */
  finalize = (tocPage?: number) => {
    const { doc } = this;
    const total = doc.getNumberOfPages();
    const drawingPages = this.kinds.map((k, i) => (k === 'desenho' ? i + 1 : 0)).filter(Boolean);
    for (let i = 1; i <= total; i++) {
      doc.setPage(i); this.syncSize();
      const k = this.kinds[i - 1];
      if (k === 'desenho') this.titleBlock(i, total, drawingPages.indexOf(i) + 1, drawingPages.length);
      else if (k === 'texto') this.PDFFooter(i, total);
      else { this.font(6.8, 'normal', GREY); doc.text(`${i} / ${total}`, this.W - this.MR, this.H - 6, { align: 'right' }); }
    }
    if (tocPage) {
      doc.setPage(tocPage); this.syncSize();
      let ty = 26;
      this.font(14, 'bold', BLUE); doc.text(clean('Sumário'), this.ML, ty); this.line(0.4, BLUE); doc.line(this.ML, ty + 1.8, this.W - this.MR, ty + 1.8); ty += 10;
      for (const t of this.toc) {
        if (ty > this.H - 22) break;
        this.font(t.level === 1 ? 10 : 8.8, t.level === 1 ? 'bold' : 'normal', t.level === 1 ? NAVY : INK);
        const label = clean(t.title.trim());
        const x0 = this.ML + (t.level === 1 ? 0 : 6);
        doc.text(label, x0, ty);
        const lw2 = doc.getTextWidth(label);
        this.line(0.1, LINE); doc.setLineDashPattern([0.4, 0.8], 0); doc.line(x0 + lw2 + 2, ty - 0.6, this.W - this.MR - 10, ty - 0.6); doc.setLineDashPattern([], 0);
        doc.text(String(t.page), this.W - this.MR, ty, { align: 'right' });
        doc.link(this.ML, ty - 4, this.W - this.ML - this.MR, 5, { pageNumber: t.page });
        ty += t.level === 1 ? 6.4 : 5;
      }
    }
    // marcadores (outline) para navegação em documentos longos
    const outline = (doc as any).outline;
    if (outline?.add) {
      let parent: unknown = null;
      for (const t of this.toc) {
        if (t.level === 1) parent = outline.add(null, clean(t.title.trim()), { pageNumber: t.page });
        else outline.add(parent, clean(t.title.trim()), { pageNumber: t.page });
      }
    }
    return doc;
  };
}
