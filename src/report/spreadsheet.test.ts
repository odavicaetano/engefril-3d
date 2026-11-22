import { describe, expect, it } from 'vitest';
import ExcelJS from 'exceljs';
import { buildWorkbook, buildCsv, SHEET_NAMES } from './spreadsheet';
import { DEMOS, projectFor, makeDoor } from '../data/scenarios';
import { evaluate } from '../engine/analysis';
import type { Project } from '../engine/types';

/** Avaliador mínimo das fórmulas usadas (referências, intervalos, SUM, MAX, MIN, IF, aritmética). */
function evaluator(wb: ExcelJS.Workbook, overrides: Record<string, number> = {}) {
  const cache = new Map<string, number>();
  const colNum = (c: string) => c.split('').reduce((a, ch) => a * 26 + ch.charCodeAt(0) - 64, 0);
  const get = (sheet: string, addr: string): number => {
    const key = `${sheet}!${addr.replace(/\$/g, '')}`;
    if (key in overrides) return overrides[key];
    if (cache.has(key)) return cache.get(key)!;
    const v = wb.getWorksheet(sheet)!.getCell(addr.replace(/\$/g, '')).value as any;
    let out: number;
    if (v && typeof v === 'object' && 'formula' in v) out = run(sheet, v.formula);
    else out = typeof v === 'number' ? v : 0;
    cache.set(key, out);
    return out;
  };
  const range = (sheet: string, a: string, b: string) => {
    const [, ca, ra] = a.match(/([A-Z]+)(\d+)/)!, [, cb, rb] = b.match(/([A-Z]+)(\d+)/)!;
    const vals: number[] = [];
    for (let c = colNum(ca); c <= colNum(cb); c++) for (let r = +ra; r <= +rb; r++) vals.push(get(sheet, String.fromCharCode(64 + c) + r));
    return vals;
  };
  const run = (sheet: string, f: string): number => {
    let js = f
      .replace(/SUM\(([A-Z]+\d+):([A-Z]+\d+)\)/g, (_, a, b) => `__sum(__range(${JSON.stringify(sheet)},"${a}","${b}"))`)
      .replace(/(?:'([^']+)'|([A-Za-zÀ-ú]+))!\$?([A-Z]+)\$?(\d+)/g, (_, q, s, c, r) => `__ref(${JSON.stringify(q ?? s)},"${c}${r}")`)
      .replace(/(?<![A-Za-z_"])([A-Z]{1,2})(\d+)(?![\d"])/g, (_, c, r) => `__ref(${JSON.stringify(sheet)},"${c}${r}")`)
      .replace(/\bIF\(/g, '__if(').replace(/\bMAX\(/g, 'Math.max(').replace(/\bMIN\(/g, 'Math.min(');
    // eslint-disable-next-line no-new-func
    return new Function('__ref', '__range', '__sum', '__if', `return (${js});`)(get, range, (a: number[]) => a.reduce((x, y) => x + y, 0), (c: boolean, a: number, b: number) => (c ? a : b));
  };
  return { get, run };
}

const close = (a: number, b: number, tol = 1e-6) => expect(Math.abs(a - b)).toBeLessThanOrEqual(tol * Math.max(1, Math.abs(b)));

const cases: [string, () => Project][] = [
  ...DEMOS.map((d) => [d.id, d.build] as [string, () => Project]),
  ['sem portas', () => { const p = projectFor('resfriamento'); p.doors = []; return p; }],
  ['muitas portas e 3 câmaras', () => { const p = projectFor('cd'); p.room.count = 3; p.doors.push(makeDoor({ wall: 'fundo', count: 2 })); return p; }],
  ['água gelada com chiller', () => { const p = projectFor('agua-gelada'); p.process.strategy = 'chiller'; return p; }],
];

describe('Planilha XLSX', () => {
  for (const [name, mk] of cases) {
    it(`fórmulas reproduzem o motor (mesmos números do PDF): ${name}`, async () => {
      const p = mk();
      const { wb, out } = buildWorkbook(ExcelJS, p, { revision: 'R1', date: new Date(2026, 10, 22) });
      expect(wb.worksheets.map((w) => w.name)).toEqual([...SHEET_NAMES]);
      const ev = evaluate(p);
      const E = evaluator(wb);
      const c = (ref: string) => E.get('Cálculos', ref);
      close(c(out.total), ev.loads.nominal.totalKWhDay);
      close(c(out.req), ev.loads.nominal.requiredKW);
      close(c(out.day), ev.energy.kWhDay);
      close(c(out.year), ev.energy.kWhYear);
      close(c(out.cost), ev.energy.costYear);
      // o arquivo é válido: grava e relê
      const buf = await wb.xlsx.writeBuffer();
      const back = new ExcelJS.Workbook();
      await back.xlsx.load(buf as ArrayBuffer);
      expect(back.worksheets.length).toBe(SHEET_NAMES.length);
    });
  }
  it('entradas editáveis propagam: tarifa e fator de segurança', () => {
    const p = DEMOS[0].build();
    const { wb, out, inputs } = buildWorkbook(ExcelJS, p);
    const ev = evaluate(p);
    const tariffCell = inputs.tariff.replace(/^Entradas!/, '').replace(/\$/g, '');
    const sfCell = inputs.sf.replace(/^Entradas!/, '').replace(/\$/g, '');
    const E = evaluator(wb, { [`Entradas!${tariffCell}`]: p.finance.tariff * 2, [`Entradas!${sfCell}`]: 0 });
    close(E.get('Cálculos', out.cost), ev.energy.costYear * 2);
    close(E.get('Cálculos', out.req), ev.loads.nominal.requiredKW / (1 + p.system.safetyFactor));
  });
  it('estrutura: cabeçalho congelado, filtros, validação e estilos de entrada', () => {
    const { wb, inputs } = buildWorkbook(ExcelJS, DEMOS[1].build());
    const ent = wb.getWorksheet('Entradas')!;
    expect(ent.views[0]).toMatchObject({ state: 'frozen', ySplit: 4 });
    expect(ent.autoFilter).toBeTruthy();
    const cell = ent.getCell(inputs.tariff.replace(/^Entradas!/, '').replace(/\$/g, ''));
    expect(cell.dataValidation?.type).toBe('decimal');
    expect((cell.fill as any)?.fgColor?.argb).toBe('FFFFF6D6');
    expect(ent.getRow(cell.row).getCell(4).value).toBe('Entrada'); // tipo indicado por texto, não só por cor
    const sobre = wb.getWorksheet('Sobre')!;
    const text = sobre.getSheetValues().flat().join(' ');
    expect(text).toContain('Estudo preliminar');
    expect(text).toContain('sem vínculo');
  });
  it('CSV UTF-8 com BOM, separador ; e decimal com vírgula', () => {
    const p = DEMOS[0].build();
    const csv = buildCsv(p);
    expect(csv.charCodeAt(0)).toBe(0xfeff);
    const ev = evaluate(p);
    expect(csv).toContain(`Capacidade frigorífica requerida;${ev.loads.nominal.requiredKW.toFixed(2).replace('.', ',')};kW`);
    expect(csv).toContain('Câmara'.normalize() === 'Câmara' ? 'Transmissão' : 'x');
  });
});
