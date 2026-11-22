/**
 * Exportação de planilhas (XLSX e CSV) com o mesmo motor de cálculo e a mesma identidade do PDF.
 * Abas: Sobre, Resumo, Entradas, Cálculos, Equipamentos, Cenários, Fontes e Premissas.
 * Entradas editáveis, fórmulas e resultados do motor são distinguidos por estilo E por uma coluna "Tipo"
 * (não apenas por cor). As fórmulas de Cálculos referenciam a aba Entradas e podem ser auditadas no Excel.
 */
import type ExcelJSNS from 'exceljs';
import type { Project } from '../engine/types';
import { evaluate, compare, compareArchitectures, QUALITY_INFO, type Evaluation } from '../engine/analysis';
import { LOAD_LABEL, type LoadKey } from '../engine/loads';
import { ARCHITECTURES } from '../engine/cycle';
import { SOURCES } from '../data/sources';
import { DOOR_TYPES, DOOR_PROTECTION, insulationById } from '../data/materials';
import { productById } from '../data/products';
import { equipmentSchedule } from './specs';
import { argb, TOKENS } from '../design/tokens';

export const SHEET_NAMES = ['Sobre', 'Resumo', 'Entradas', 'Cálculos', 'Equipamentos', 'Cenários', 'Fontes e Premissas'] as const;
type Kind = 'Entrada' | 'Fórmula' | 'Resultado do motor' | 'Referência' | 'Informação';

/** SpreadsheetTheme: estilos compartilhados derivados dos tokens de identidade. */
export const SpreadsheetTheme = {
  font: TOKENS.typography.spreadsheet,
  header: { fill: argb('ui-dark'), font: 'FFFFFFFF' },
  zebra: argb('ui-light'),
  input: argb('ui-input'),
  formula: argb('ui-accent'),
  title: argb('brand-primary'),
  border: argb('ui-line'),
  numFmt: { int: '#,##0', d1: '#,##0.0', d2: '#,##0.00', d3: '#,##0.000', pct: '0.0%', brl: '"R$" #,##0.00', date: 'dd/mm/yyyy' },
};

type ExcelJSModule = typeof ExcelJSNS;
export interface SheetOptions { revision?: string; client?: string; date?: Date; compare?: Project | null }

/** Monta a pasta de trabalho. Recebe o módulo ExcelJS (carregado sob demanda no navegador). */
export function buildWorkbook(ExcelJS: ExcelJSModule, p: Project, o: SheetOptions = {}) {
  const ev = evaluate(p);
  const T = SpreadsheetTheme;
  const date = o.date ?? new Date();
  const wb = new ExcelJS.Workbook();
  wb.creator = 'ENGEFRIL 3D (protótipo demonstrativo)';
  wb.title = `Pré-dimensionamento: ${p.name}`;
  wb.subject = 'Estudo preliminar de refrigeração industrial (R717)';
  wb.created = date; wb.modified = date;
  wb.company = 'Protótipo inspirado na Engefril, sem vínculo oficial';

  const kindStyle = (c: ExcelJSNS.Cell, k: Kind) => {
    if (k === 'Entrada') { c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: T.input } }; c.font = { name: T.font, bold: true }; }
    else if (k === 'Fórmula') c.font = { name: T.font, italic: true, color: { argb: T.formula } };
    else if (k === 'Resultado do motor') c.font = { name: T.font, bold: true };
    else c.font = { name: T.font };
  };
  const newSheet = (name: (typeof SHEET_NAMES)[number], title: string, cols: { header: string; key: string; width: number }[]) => {
    const ws = wb.addWorksheet(name, { properties: { defaultRowHeight: 16 }, pageSetup: { paperSize: 9, orientation: 'landscape', fitToPage: true, fitToWidth: 1, fitToHeight: 0 } });
    ws.getCell('A1').value = title;
    ws.getCell('A1').font = { name: T.font, size: 14, bold: true, color: { argb: T.title } };
    ws.getCell('A2').value = `ENGEFRIL 3D · ${p.name} · ${o.revision || 'R0'} · ${date.toLocaleDateString('pt-BR')} · Estudo preliminar (pré-dimensionamento orientativo)`;
    ws.getCell('A2').font = { name: T.font, size: 9, italic: true, color: { argb: argb('ui-muted') } };
    ws.columns = cols.map((c) => ({ key: c.key, width: c.width }));
    const hr = ws.getRow(4);
    cols.forEach((c, i) => {
      const cell = hr.getCell(i + 1);
      cell.value = c.header;
      cell.font = { name: T.font, bold: true, color: { argb: T.header.font } };
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: T.header.fill } };
      cell.alignment = { vertical: 'middle', wrapText: true };
    });
    hr.height = 30;
    ws.views = [{ state: 'frozen', ySplit: 4 }];
    return ws;
  };
  const finishTable = (ws: ExcelJSNS.Worksheet, nCols: number, firstRow = 5) => {
    const last = ws.rowCount;
    for (let r = firstRow; r <= last; r++) {
      const row = ws.getRow(r);
      for (let c = 1; c <= nCols; c++) {
        const cell = row.getCell(c);
        cell.border = { bottom: { style: 'thin', color: { argb: T.border } } };
        if (!cell.fill && (r - firstRow) % 2 === 1) cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: T.zebra } };
        if (!cell.font) cell.font = { name: T.font };
        cell.alignment = { ...(cell.alignment ?? {}), vertical: 'top', wrapText: typeof cell.value === 'string' };
      }
    }
    if (last >= firstRow) ws.autoFilter = { from: { row: 4, column: 1 }, to: { row: last, column: nCols } };
  };
  const legend = (ws: ExcelJSNS.Worksheet, col = 1) => {
    const r = ws.getRow(3);
    r.getCell(col).value = 'Legenda (coluna Tipo): Entrada = editável (fundo amarelo, negrito) · Fórmula = calculada na planilha (itálico azul) · Resultado do motor = valor do simulador · Referência = literatura';
    r.getCell(col).font = { name: T.font, size: 8, color: { argb: argb('ui-muted') } };
  };

  // ---------------- Sobre
  {
    const ws = newSheet('Sobre', 'Sobre esta planilha', [{ header: 'Item', key: 'k', width: 30 }, { header: 'Conteúdo', key: 'v', width: 110 }]);
    const rows: [string, string | Date][] = [
      ['Projeto', p.name], ...(o.client ? [['Cliente', o.client] as [string, string]] : []), ['Revisão', o.revision || 'R0'], ['Data de emissão', date],
      ['Origem dos dados', 'Dados informados pelo usuário no simulador ENGEFRIL 3D e resultados do motor de cálculo da plataforma (mesmo motor do relatório PDF).'],
      ['Escopo', 'Pré-dimensionamento orientativo de câmaras frigoríficas e sistemas de refrigeração por amônia (R717).'],
      ['Classificação', 'Estudo preliminar. Não é projeto executivo, não tem assinatura, ART ou validação profissional.'],
      ['Vínculo', 'Protótipo demonstrativo inspirado na Engefril, sem vínculo, parceria ou aprovação oficial.'],
      ['Identidade visual', `Tokens ${TOKENS.meta.version} (${TOKENS.meta.status}): cores medidas no site e valores provisórios a validar.`],
      ['Abas', SHEET_NAMES.join(' · ')],
      ['Como ler', 'Células amarelas (Tipo = Entrada) podem ser editadas; as fórmulas da aba Cálculos e os totais de Resumo/Cenários se atualizam. Demais valores são resultados do motor e não se recalculam na planilha.'],
      ['Limitações', 'Regime permanente na condição de projeto; capacidades por modelo de equipamento não são publicadas pelo fabricante; propriedades interpoladas de tabelas CoolProp.'],
      ['Macros e links', 'Sem macros e sem vínculos externos.'],
    ];
    rows.forEach(([k, v]) => { const r = ws.addRow({ k, v }); if (v instanceof Date) r.getCell(2).numFmt = T.numFmt.date; });
    finishTable(ws, 2);
  }

  // ---------------- Entradas (células nomeadas pela posição; referenciadas em Cálculos)
  const IN: Record<string, string> = {};
  {
    const ws = newSheet('Entradas', 'Entradas do cenário', [{ header: 'Parâmetro', key: 'k', width: 46 }, { header: 'Valor', key: 'v', width: 16 }, { header: 'Unidade', key: 'u', width: 14 }, { header: 'Tipo', key: 't', width: 20 }, { header: 'Observação', key: 'o', width: 60 }]);
    legend(ws);
    const g = ev.loads.nominal.geometry;
    const add = (id: string | null, k: string, v: number | string, u: string, t: Kind, obs = '', fmt?: string, valid?: [number, number]) => {
      const r = ws.addRow({ k, v, u, t, o: obs });
      const c = r.getCell(2);
      kindStyle(c, t);
      if (fmt) c.numFmt = fmt;
      if (valid) c.dataValidation = { type: 'decimal', operator: 'between', allowBlank: false, formulae: [valid[0], valid[1]], showErrorMessage: true, errorTitle: 'Valor fora da faixa', error: `Use um valor entre ${valid[0]} e ${valid[1]}.` };
      if (id) IN[id] = `Entradas!$B$${r.number}`;
    };
    add(null, 'Aplicação', p.application, '', 'Informação');
    add('n', 'Quantidade de câmaras iguais', p.room.count, 'un', 'Informação', 'As cargas são multiplicadas por este número.', T.numFmt.int);
    if (p.application !== 'agua-gelada') {
      add(null, 'Comprimento interno', g.L, 'm', 'Informação', p.cadImport?.provenance.length ? 'importado do CAD' : '', T.numFmt.d2);
      add(null, 'Largura interna', g.W, 'm', 'Informação', p.cadImport?.provenance.width ? 'importado do CAD' : '', T.numFmt.d2);
      add(null, 'Pé-direito interno', g.H, 'm', 'Informação', '', T.numFmt.d2);
      add(null, 'Temperatura interna', p.room.Tin, '°C', 'Informação', '', T.numFmt.d1);
      add(null, 'Espessura das paredes / teto', `${p.envelope.wallThk} / ${p.envelope.roofThk}`, 'mm', 'Informação', insulationById(p.envelope.insulation).name);
    }
    add(null, 'Temperatura externa de projeto', p.climate.Tout, '°C', 'Informação', '', T.numFmt.d1);
    add('bridge', 'Pontes térmicas sobre a transmissão', p.envelope.thermalBridgePct, '%', 'Entrada', 'Hipótese editável', T.numFmt.d1, [0, 40]);
    add('run', 'Operação dos compressores', p.system.runHours, 'h/dia', 'Entrada', 'Base da capacidade média (ASHRAE: 16 a 20 h/dia usual)', T.numFmt.d1, [8, 24]);
    add('cool', 'Tempo de resfriamento do produto', p.product.coolingHours, 'h', 'Entrada', 'Define o pico de produto', T.numFmt.d1, [0.5, 72]);
    add('sf', 'Fator de segurança', p.system.safetyFactor, 'fração', 'Entrada', 'ASHRAE sugere cerca de 0,10', T.numFmt.d2, [0, 0.3]);
    add('aux', 'Auxiliares do condensador', p.system.condAuxPct, '% de Qc', 'Entrada', 'Hipótese editável', T.numFmt.d1, [0, 8]);
    add('tariff', 'Tarifa de energia', p.finance.tariff, 'R$/kWh', 'Entrada', 'Informada pelo cliente', T.numFmt.d2, [0, 5]);
    add('days', 'Dias de operação por ano', p.finance.operatingDays, 'dias', 'Entrada', '', T.numFmt.int, [1, 366]);
    add('cop', 'COP do ciclo (motor)', ev.cycle.errors.length ? 0 : ev.loads.nominal.requiredKW / ev.cycle.Welec, '-', 'Resultado do motor', `Te ${ev.temps.Te.toFixed(1)} °C / Tc ${ev.temps.Tc.toFixed(1)} °C; independe da escala da carga`, T.numFmt.d3);
    add('pumpkw', 'Potência das bombas (motor)', ev.cycle.Wpump, 'kW', 'Resultado do motor', '', T.numFmt.d3);
    finishTable(ws, 5);
  }

  // ---------------- Cálculos (fórmulas auditáveis)
  const OUT: Record<string, string> = {};
  {
    const ws = newSheet('Cálculos', 'Memorial de cálculo (fórmulas)', [{ header: 'Grandeza', key: 'k', width: 44 }, { header: 'A / q aberta', key: 'a', width: 14 }, { header: 'U / Dt', key: 'b', width: 12 }, { header: 'dT / Df', key: 'c', width: 12 }, { header: 'E', key: 'd', width: 10 }, { header: 'Fator', key: 'e', width: 10 }, { header: 'Resultado', key: 'r', width: 16 }, { header: 'Unidade', key: 'u', width: 12 }, { header: 'Tipo', key: 't', width: 20 }]);
    legend(ws);
    const m = ev.loads.nominal.memo;
    const it = Object.fromEntries(ev.loads.nominal.items.map((i) => [i.key, i])) as unknown as Partial<Record<LoadKey, { kWhDay: number }>>;
    const section = (title: string) => { const r = ws.addRow({ k: title }); r.getCell(1).font = { name: T.font, bold: true, color: { argb: T.title } }; };
    const res = (r: ExcelJSNS.Row, formula: string, result: number, fmt: string) => { const c = r.getCell(7); c.value = { formula, result }; c.numFmt = fmt; kindStyle(c, 'Fórmula'); };
    const sumParts: string[] = [];
    if (m) {
      section('Transmissão: Q = U · A · dT');
      const first = ws.rowCount + 1;
      for (const s of m.surfaces) {
        const r = ws.addRow({ k: s.name, a: s.A, b: s.U, c: s.dT, u: 'W', t: 'Fórmula' });
        r.getCell(2).numFmt = T.numFmt.d2; r.getCell(3).numFmt = T.numFmt.d3; r.getCell(4).numFmt = T.numFmt.d1;
        res(r, `B${r.number}*C${r.number}*D${r.number}`, s.W, T.numFmt.d1);
      }
      const last = ws.rowCount;
      const sub = ws.addRow({ k: 'Subtotal · (1 + pontes/100) · n', u: 'W', t: 'Fórmula' });
      const tW = m.surfaces.reduce((a, x) => a + x.W, 0) * m.bridge * m.n;
      res(sub, `SUM(G${first}:G${last})*(1+${IN.bridge}/100)*${IN.n}`, tW, T.numFmt.d1);
      const e = ws.addRow({ k: 'Energia de transmissão = Q · 24 / 1000', u: 'kWh/dia', t: 'Fórmula' });
      res(e, `G${sub.number}*24/1000`, it.transmissao?.kWhDay ?? 0, T.numFmt.d2);
      sumParts.push(`G${e.number}`); OUT.trans = `G${e.number}`;

      section('Infiltração (Gosney & Olama): qt = q · Dt · Df · (1 - E) · fator(vedação × quantidade)');
      const f0 = ws.rowCount + 1;
      m.doors.forEach((d) => {
        const i = p.doors.findIndex((x) => x.id === d.id);
        const base = d.qFull * d.Dt * m.Df * (1 - d.E);
        const factor = base > 0 ? d.q / base : 0;
        const r = ws.addRow({ k: `P-${String(i + 1).padStart(2, '0')} ${DOOR_TYPES.find((t) => t.id === p.doors[i].type)?.name ?? ''}`, a: d.qFull, b: d.Dt, c: m.Df, d: d.E, e: factor, u: 'kW', t: 'Fórmula' });
        r.getCell(2).numFmt = T.numFmt.d3; r.getCell(3).numFmt = '0.0000'; r.getCell(4).numFmt = T.numFmt.d2; r.getCell(5).numFmt = T.numFmt.d3; r.getCell(6).numFmt = T.numFmt.d2;
        res(r, `B${r.number}*C${r.number}*D${r.number}*(1-E${r.number})*F${r.number}`, d.q, T.numFmt.d3);
      });
      const fl = ws.rowCount;
      const ei = ws.addRow({ k: 'Energia de infiltração = soma(qt) · n · 24', u: 'kWh/dia', t: 'Fórmula' });
      res(ei, m.doors.length ? `SUM(G${f0}:G${fl})*${IN.n}*24` : '0', it.infiltracao?.kWhDay ?? 0, T.numFmt.d2);
      sumParts.push(`G${ei.number}`); OUT.inf = `G${ei.number}`;
    }
    section('Demais parcelas (resultado do motor, já multiplicadas por n)');
    const others: LoadKey[] = ['produto', 'pessoas', 'iluminacao', 'equipamentos', 'ventiladores', 'degelo', 'outras'];
    for (const k of others) {
      const r = ws.addRow({ k: LOAD_LABEL[k], u: 'kWh/dia', t: 'Resultado do motor' });
      r.getCell(7).value = it[k]?.kWhDay ?? 0; r.getCell(7).numFmt = T.numFmt.d2; kindStyle(r.getCell(7), 'Resultado do motor');
      sumParts.push(`G${r.number}`);
      if (k === 'produto') OUT.prod = `G${r.number}`;
      if (k === 'ventiladores') OUT.fan = `G${r.number}`;
    }
    section('Capacidade frigorífica');
    const tot = ws.addRow({ k: 'Carga térmica diária total', u: 'kWh/dia', t: 'Fórmula' });
    res(tot, sumParts.join('+'), ev.loads.nominal.totalKWhDay, T.numFmt.d2); OUT.total = `G${tot.number}`;
    const water = p.application === 'agua-gelada';
    const runRef = water && p.process.strategy === 'chiller' ? String(p.process.hoursPerDay) : (water ? `MIN(22,${IN.run})` : IN.run);
    const avg = ws.addRow({ k: 'Q média = E / horas de operação', u: 'kW', t: 'Fórmula' });
    res(avg, `${OUT.total}/${runRef}`, ev.loads.nominal.capacityAvgBasis, T.numFmt.d2);
    const rate = ws.addRow({ k: 'Taxa de produto durante o processo (motor)', u: 'kW', t: 'Resultado do motor' });
    rate.getCell(7).value = ev.loads.nominal.productRateKW; rate.getCell(7).numFmt = T.numFmt.d2; kindStyle(rate.getCell(7), 'Resultado do motor');
    const peak = ws.addRow({ k: 'Q pico = contínuas + produto concentrado', u: 'kW', t: 'Fórmula' });
    if (water) res(peak, p.process.strategy === 'banco-gelo' ? `G${avg.number}` : `G${rate.number}`, ev.loads.nominal.capacityPeakBasis, T.numFmt.d2);
    else res(peak, `(${OUT.total}-${OUT.prod})/${IN.run}+IF(${IN.cool}<${IN.run},G${rate.number},${OUT.prod}/${IN.run})`, ev.loads.nominal.capacityPeakBasis, T.numFmt.d2);
    const req = ws.addRow({ k: 'Capacidade requerida = max(Q média; Q pico) · (1 + fs)', u: 'kW', t: 'Fórmula' });
    res(req, `MAX(G${avg.number},G${peak.number})*(1+${IN.sf})`, ev.loads.nominal.requiredKW, T.numFmt.d2); OUT.req = `G${req.number}`;
    const tr = ws.addRow({ k: 'Capacidade requerida em TR (1 TR = 3,517 kW)', u: 'TR', t: 'Fórmula' });
    res(tr, `${OUT.req}/3.517`, ev.loads.nominal.requiredKW / 3.517, T.numFmt.d1);

    section('Energia elétrica');
    const comp = ws.addRow({ k: 'Compressores = E / COP', u: 'kWh/dia', t: 'Fórmula' });
    const compV = ev.loads.nominal.totalKWhDay / (ev.loads.nominal.requiredKW / ev.cycle.Welec);
    res(comp, `IF(${IN.cop}>0,${OUT.total}/${IN.cop},0)`, compV, T.numFmt.d2);
    const aux = ws.addRow({ k: 'Auxiliares do condensador = aux% · (E + compressores)', u: 'kWh/dia', t: 'Fórmula' });
    res(aux, `${IN.aux}/100*(${OUT.total}+G${comp.number})`, (p.system.condAuxPct / 100) * (ev.loads.nominal.totalKWhDay + compV), T.numFmt.d2);
    const pump = ws.addRow({ k: 'Bombas = potência · min(24; horas)', u: 'kWh/dia', t: 'Fórmula' });
    res(pump, `${IN.pumpkw}*MIN(24,${IN.run})`, ev.cycle.Wpump * Math.min(24, p.system.runHours), T.numFmt.d2);
    const fanRef = OUT.fan ?? '0';
    const day = ws.addRow({ k: 'Consumo diário = compressores + auxiliares + ventiladores + bombas', u: 'kWh/dia', t: 'Fórmula' });
    res(day, `G${comp.number}+G${aux.number}+${fanRef}+G${pump.number}`, ev.energy.kWhDay, T.numFmt.d2); OUT.day = `G${day.number}`;
    const year = ws.addRow({ k: 'Consumo anual = diário · dias', u: 'kWh/ano', t: 'Fórmula' });
    res(year, `${OUT.day}*${IN.days}`, ev.energy.kWhYear, T.numFmt.int); OUT.year = `G${year.number}`;
    const cost = ws.addRow({ k: 'Custo anual de energia = anual · tarifa', u: 'R$/ano', t: 'Fórmula' });
    res(cost, `${OUT.year}*${IN.tariff}`, ev.energy.costYear, T.numFmt.brl); OUT.cost = `G${cost.number}`;
    ws.getColumn(9).eachCell((c, r) => { if (r > 4 && typeof c.value === 'string') kindStyle(c, c.value as Kind); });
    finishTable(ws, 9);
  }

  // ---------------- Resumo (referencia Cálculos)
  {
    const ws = newSheet('Resumo', 'Resumo do pré-dimensionamento', [{ header: 'Indicador', key: 'k', width: 46 }, { header: 'Valor', key: 'v', width: 18 }, { header: 'Unidade', key: 'u', width: 14 }, { header: 'Tipo', key: 't', width: 20 }]);
    legend(ws);
    const g = ev.loads.nominal.geometry;
    const val = (k: string, v: number | string, u: string, t: Kind, fmt?: string) => { const r = ws.addRow({ k, v, u, t }); if (fmt) r.getCell(2).numFmt = fmt; kindStyle(r.getCell(2), t); return r; };
    const ref = (k: string, f: string, result: number, u: string, fmt: string) => { const r = ws.addRow({ k, u, t: 'Fórmula' }); r.getCell(2).value = { formula: `'Cálculos'!${f}`, result }; r.getCell(2).numFmt = fmt; kindStyle(r.getCell(2), 'Fórmula'); };
    if (p.application !== 'agua-gelada') {
      val('Área total', g.floor * p.room.count, 'm²', 'Resultado do motor', T.numFmt.d1);
      val('Volume refrigerado total', g.volume * p.room.count, 'm³', 'Resultado do motor', T.numFmt.int);
      val('Temperatura interna', p.room.Tin, '°C', 'Informação', T.numFmt.d1);
    }
    ref('Carga térmica diária', OUT.total, ev.loads.nominal.totalKWhDay, 'kWh/dia', T.numFmt.d1);
    ref('Capacidade frigorífica requerida (nominal)', OUT.req, ev.loads.nominal.requiredKW, 'kW', T.numFmt.d1);
    val('Faixa de capacidade: mínimo', ev.range[0], 'kW', 'Resultado do motor', T.numFmt.int);
    val('Faixa de capacidade: máximo', ev.range[1], 'kW', 'Resultado do motor', T.numFmt.int);
    val('Qualidade dos dados', QUALITY_INFO[ev.quality].label, '', 'Resultado do motor');
    val('Temperatura de evaporação / condensação', `${ev.temps.Te.toFixed(1)} / ${ev.temps.Tc.toFixed(1)}`, '°C', 'Resultado do motor');
    val('COP do ciclo', ev.cycle.COP, '-', 'Resultado do motor', T.numFmt.d2);
    val('Potência elétrica total estimada', ev.energy.totalElecKW, 'kW', 'Resultado do motor', T.numFmt.d1);
    ref('Consumo de energia anual', OUT.year, ev.energy.kWhYear, 'kWh/ano', T.numFmt.int);
    ref('Custo anual de energia', OUT.cost, ev.energy.costYear, 'R$/ano', T.numFmt.brl);
    val('Arquitetura', ARCHITECTURES.find((a) => a.id === p.system.architecture)?.name ?? '', '', 'Informação');
    ws.addRow({});
    ws.addRow({ k: 'Distribuição da carga (motor)' }).getCell(1).font = { name: T.font, bold: true, color: { argb: T.title } };
    ev.breakdown.forEach((b) => { const r = ws.addRow({ k: b.label, v: b.share, u: '% da carga', t: 'Resultado do motor' }); r.getCell(2).numFmt = T.numFmt.pct; });
    finishTable(ws, 4);
  }

  // ---------------- Equipamentos
  {
    const ws = newSheet('Equipamentos', 'Especificação de equipamentos (capacidades estimadas)', [{ header: 'TAG', key: 'tag', width: 14 }, { header: 'Equipamento', key: 'name', width: 38 }, { header: 'Função', key: 'fn', width: 46 }, { header: 'Capacidade estimada', key: 'capacity', width: 46 }, { header: 'Características disponíveis', key: 'facts', width: 60 }, { header: 'Origem', key: 'origin', width: 26 }]);
    equipmentSchedule(p, ev).forEach((r) => ws.addRow(r));
    ws.addRow({});
    ws.addRow({ name: 'A Engefril não publica capacidades nem modelos: a seleção final exige catálogo do fabricante e orçamento técnico-comercial.' });
    finishTable(ws, 6);
  }

  // ---------------- Cenários
  {
    const ws = newSheet('Cenários', 'Comparação de configurações', [{ header: 'Configuração', key: 'k', width: 46 }, { header: 'Te [°C]', key: 'te', width: 10 }, { header: 'COP', key: 'cop', width: 10 }, { header: 'kW elétricos', key: 'kw', width: 14 }, { header: 'Consumo [kWh/ano]', key: 'kwh', width: 18 }, { header: 'Custo [R$/ano]', key: 'cost', width: 18 }, { header: 'Observação', key: 'o', width: 50 }]);
    const archRows = p.application === 'agua-gelada' ? [] : compareArchitectures(p, ev);
    for (const a of archRows) {
      const ok = !a.cycle.errors.length;
      const r = ws.addRow({ k: a.name + (a.id === p.system.architecture ? ' (adotada)' : ''), te: a.Te, cop: ok ? a.cycle.COP : null, kw: ok ? a.cycle.Welec + a.cycle.Wpump : null, o: a.cycle.errors[0] ?? a.cycle.warnings[0] ?? '' });
      r.getCell(2).numFmt = T.numFmt.d1; r.getCell(3).numFmt = T.numFmt.d2; r.getCell(4).numFmt = T.numFmt.d1;
    }
    const scen = (label: string, q: Project, e: Evaluation) => {
      const r = ws.addRow({ k: label, te: e.temps.Te, cop: e.cycle.COP, kw: e.energy.totalElecKW, kwh: e.energy.kWhYear, o: q.name });
      r.getCell(6).value = { formula: `E${r.number}*${IN.tariff}`, result: e.energy.kWhYear * p.finance.tariff };
      [2, 3, 4, 5, 6].forEach((c, i) => (r.getCell(c).numFmt = [T.numFmt.d1, T.numFmt.d2, T.numFmt.d1, T.numFmt.int, T.numFmt.brl][i]));
      kindStyle(r.getCell(6), 'Fórmula');
      return r;
    };
    ws.addRow({});
    const ra = scen('Cenário A (projeto atual)', p, ev);
    if (o.compare) {
      const eb = evaluate(o.compare);
      const rb = scen('Cenário B', o.compare, eb);
      const d = ws.addRow({ k: 'Diferença de custo anual (A - B)', o: compare(p, ev, o.compare, eb).note });
      d.getCell(6).value = { formula: `F${ra.number}-F${rb.number}`, result: (ev.energy.kWhYear - eb.energy.kWhYear) * p.finance.tariff };
      d.getCell(6).numFmt = T.numFmt.brl; kindStyle(d.getCell(6), 'Fórmula');
    }
    finishTable(ws, 7);
  }

  // ---------------- Fontes e Premissas
  {
    const ws = newSheet('Fontes e Premissas', 'Fontes e premissas', [{ header: 'Item', key: 'k', width: 46 }, { header: 'Valor / referência', key: 'v', width: 40 }, { header: 'Natureza', key: 't', width: 28 }, { header: 'Observação', key: 'o', width: 70 }]);
    const s = p.system;
    const hyp: [string, string, string][] = [
      ['Diferença ar–evaporação (TD)', `${s.evapTD} K`, 'Hipótese editável'], ['Aproximação do condensador ao bulbo úmido', `${s.condApproach} K`, 'Hipótese editável'],
      ['Eficiência isentrópica / motor', `${s.etaIs} / ${s.etaMotor}`, 'Hipótese editável'], ['Ventiladores: Δp / η / ΔT do ar', `${s.fanDp} Pa / ${s.fanEta} / ${s.airDT} K`, 'Hipótese editável'],
      ['Eficiência do degelo', String(s.defrostEff), 'Hipótese editável'], ['Pontes térmicas', `${p.envelope.thermalBridgePct} %`, 'Hipótese editável'],
      ['Produto', productById(p.product.typeId).name, 'Informado'], ['Portas', p.doors.map((d) => `${d.count}× ${DOOR_TYPES.find((t) => t.id === d.type)?.name} (${DOOR_PROTECTION[d.protection].name})`).join('; ') || 'nenhuma', 'Informado'],
    ];
    hyp.forEach(([k, v, t]) => ws.addRow({ k, v, t }));
    ws.addRow({});
    SOURCES.forEach((x) => ws.addRow({ k: x.title, v: x.url ?? '', t: x.id.startsWith('engefril') ? 'Fonte oficial Engefril' : 'Referência técnica', o: x.note }));
    finishTable(ws, 4);
  }

  // ordem das abas conforme o padrão
  const order = SHEET_NAMES as readonly string[];
  wb.worksheets.sort((a, b) => order.indexOf(a.name) - order.indexOf(b.name)).forEach((w, i) => ((w as any).orderNo = i));
  return { wb, ev, out: OUT, inputs: IN };
}

/** CSV (UTF-8 com BOM, separador ';', decimal com vírgula) com o resumo e as parcelas de carga. */
export function buildCsv(p: Project): string {
  const ev = evaluate(p);
  const num = (v: number, d = 2) => (Number.isFinite(v) ? v.toFixed(d).replace('.', ',') : '');
  const esc = (s: string) => (/[;"\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s);
  const rows: string[][] = [
    ['Seção', 'Indicador', 'Valor', 'Unidade'],
    ['Identificação', 'Projeto', p.name, ''],
    ['Identificação', 'Classificação', 'Estudo preliminar (pré-dimensionamento orientativo)', ''],
    ['Resultado', 'Capacidade frigorífica requerida', num(ev.loads.nominal.requiredKW), 'kW'],
    ['Resultado', 'Faixa mínima', num(ev.range[0], 0), 'kW'],
    ['Resultado', 'Faixa máxima', num(ev.range[1], 0), 'kW'],
    ['Resultado', 'Carga térmica diária', num(ev.loads.nominal.totalKWhDay), 'kWh/dia'],
    ['Resultado', 'COP do ciclo', num(ev.cycle.COP, 3), '-'],
    ['Resultado', 'Potência elétrica total', num(ev.energy.totalElecKW), 'kW'],
    ['Resultado', 'Consumo anual', num(ev.energy.kWhYear, 0), 'kWh/ano'],
    ['Resultado', 'Custo anual de energia', num(ev.energy.costYear), 'R$/ano'],
    ...ev.loads.nominal.items.map((i) => ['Carga', LOAD_LABEL[i.key], num(i.kWhDay), 'kWh/dia']),
  ];
  return '﻿' + rows.map((r) => r.map(esc).join(';')).join('\r\n') + '\r\n';
}
