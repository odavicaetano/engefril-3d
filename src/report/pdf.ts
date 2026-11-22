/** Relatório comercial em PDF (jsPDF), com aparência institucional. */
import { jsPDF } from 'jspdf';
import type { Project } from '../engine/types';
import { evaluate, compare, QUALITY_INFO } from '../engine/analysis';
import { suggestEquipment } from '../engine/suggest';
import { productById } from '../data/products';
import { insulationById, DOOR_PROTECTION, DOOR_TYPES } from '../data/materials';
import { ARCHITECTURES } from '../engine/cycle';
import { SOURCES, ORIGIN_LABEL } from '../data/sources';
import { captureScene } from '../scene/sceneUtils';

const BLUE: [number, number, number] = [0, 105, 174];
const NAVY: [number, number, number] = [11, 26, 43];
const GREY: [number, number, number] = [93, 107, 121];
const PAL: [number, number, number][] = [[0, 105, 174], [228, 87, 46], [240, 162, 2], [31, 157, 85], [107, 91, 210], [70, 179, 230], [156, 154, 160], [194, 124, 0], [72, 72, 72]];

/** A fonte padrão do PDF cobre o Latin-1; substitui símbolos fora dela. */
const clean = (s: string) => s
  .replace(/₃/g, '3').replace(/₂/g, '2').replace(/≈/g, '~').replace(/−/g, '-').replace(/→/g, '->').replace(/λ/g, 'lambda').replace(/Δ/g, 'Delta ')
  .replace(/η/g, 'eta').replace(/θ/g, 'theta').replace(/√/g, 'raiz').replace(/≥/g, '>=').replace(/≤/g, '<=').replace(/±/g, '+/-').replace(/∓/g, '-/+').replace(/[“”]/g, '"').replace(/[‘’]/g, "'").replace(/·/g, '·');
const n = (v: number, d = 0) => (Number.isFinite(v) ? v.toLocaleString('pt-BR', { minimumFractionDigits: d, maximumFractionDigits: d }) : '-');

async function logoPng(): Promise<string | null> {
  try {
    const svg = await (await fetch('./favicon.svg')).text();
    const img = new Image();
    img.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg);
    await img.decode();
    const c = document.createElement('canvas'); c.width = c.height = 128;
    c.getContext('2d')!.drawImage(img, 0, 0, 128, 128);
    return c.toDataURL('image/png');
  } catch { return null; }
}

export async function buildReport(p: Project, b: Project | null, opts: { save?: boolean } = {}): Promise<Blob> {
  const ev = evaluate(p);
  const doc = new jsPDF({ unit: 'mm', format: 'a4' });
  const W = 210, M = 16;
  let y = 0;
  const logo = await logoPng();
  const date = new Date().toLocaleDateString('pt-BR');

  const header = () => {
    doc.setFillColor(...NAVY); doc.rect(0, 0, W, 20, 'F');
    doc.setFillColor(...BLUE); doc.rect(0, 20, W, 1.2, 'F');
    if (logo) doc.addImage(logo, 'PNG', M, 4, 12, 12);
    doc.setTextColor(255, 255, 255); doc.setFont('helvetica', 'bold'); doc.setFontSize(13); doc.text('ENGEFRIL 3D', M + 15, 10.5);
    doc.setFont('helvetica', 'normal'); doc.setFontSize(8.5); doc.text(clean('Relatório de pré-dimensionamento · protótipo demonstrativo'), M + 15, 15);
    doc.text(date, W - M, 10.5, { align: 'right' });
    y = 30;
  };
  const footer = () => {
    const pages = doc.getNumberOfPages();
    for (let i = 1; i <= pages; i++) {
      doc.setPage(i);
      doc.setFontSize(7); doc.setTextColor(...GREY);
      doc.text(clean('Estimativa preliminar gerada por protótipo demonstrativo inspirado na Engefril, sem vínculo oficial. Não constitui proposta comercial nem projeto de engenharia.'), M, 290);
      doc.text(`${i}/${pages}`, W - M, 290, { align: 'right' });
    }
  };
  const need = (h: number) => { if (y + h > 280) { doc.addPage(); header(); } };
  const h2 = (t: string) => { need(14); doc.setFont('helvetica', 'bold'); doc.setFontSize(12); doc.setTextColor(...BLUE); doc.text(clean(t), M, y); doc.setDrawColor(...BLUE); doc.setLineWidth(0.3); doc.line(M, y + 1.5, W - M, y + 1.5); y += 7; };
  const para = (t: string, size = 9, color: [number, number, number] = [29, 39, 51]) => {
    doc.setFont('helvetica', 'normal'); doc.setFontSize(size); doc.setTextColor(...color);
    const lines = doc.splitTextToSize(clean(t), W - 2 * M);
    for (const l of lines) { need(5); doc.text(l, M, y); y += size * 0.45; }
    y += 1.5;
  };
  const table = (rows: [string, string][], colW = 70) => {
    doc.setFontSize(9);
    rows.forEach(([k, v], i) => {
      const lines = doc.splitTextToSize(clean(v), W - 2 * M - colW - 2);
      const h = Math.max(5.5, lines.length * 4.2 + 1.5);
      need(h);
      if (i % 2 === 0) { doc.setFillColor(244, 246, 248); doc.rect(M, y - 4, W - 2 * M, h, 'F'); }
      doc.setFont('helvetica', 'normal'); doc.setTextColor(...GREY); doc.text(clean(k), M + 2, y);
      doc.setTextColor(29, 39, 51); doc.setFont('helvetica', 'bold'); doc.text(lines, M + colW, y);
      y += h;
    });
    y += 3;
  };

  // ---------- Capa / identificação
  header();
  doc.setFont('helvetica', 'bold'); doc.setFontSize(18); doc.setTextColor(...NAVY);
  doc.text(doc.splitTextToSize(clean(p.name), W - 2 * M), M, y + 2); y += 11;
  doc.setFont('helvetica', 'normal'); doc.setFontSize(10); doc.setTextColor(...GREY);
  doc.text(clean(`Qualidade da estimativa: ${QUALITY_INFO[ev.quality].label} · ${ARCHITECTURES.find((a) => a.id === p.system.architecture)?.name}`), M, y); y += 6;

  // destaque
  doc.setFillColor(...NAVY); doc.roundedRect(M, y, W - 2 * M, 24, 2, 2, 'F');
  doc.setTextColor(170, 200, 225); doc.setFontSize(9); doc.text(clean('Capacidade frigorífica preliminar requerida'), M + 5, y + 7);
  doc.setTextColor(255, 255, 255); doc.setFont('helvetica', 'bold'); doc.setFontSize(18);
  doc.text(ev.cycle.errors.length ? 'Sem cálculo válido' : `${n(ev.range[0])} a ${n(ev.range[1])} kW`, M + 5, y + 16);
  doc.setFont('helvetica', 'normal'); doc.setFontSize(9); doc.setTextColor(170, 200, 225);
  doc.text(clean(`nominal ${n(ev.loads.nominal.requiredKW)} kW (~${n(ev.loads.nominal.requiredKW / 3.517)} TR) · consumo ~${n(ev.energy.kWhYear / 1000)} MWh/ano`), M + 5, y + 21);
  y += 30;

  const img = captureScene();
  if (img) {
    const prop = doc.getImageProperties(img);
    const iw = W - 2 * M, ih = Math.min(110, iw * (prop.height / prop.width));
    need(ih + 4);
    try { doc.addImage(img, 'PNG', M, y, iw, ih, undefined, 'FAST'); } catch { /* ignora */ }
    doc.setFontSize(7.5); doc.setTextColor(...GREY); doc.text(clean('Imagem do modelo 3D (representação esquemática gerada pela plataforma).'), M, y + ih + 3.5);
    y += ih + 8;
  }

  // ---------- Dados da instalação
  const g = ev.loads.nominal.geometry;
  h2('1. Dados da instalação');
  if (p.application === 'agua-gelada') {
    table([['Aplicação', 'Processo com água gelada'], ['Vazão', `${n(p.process.flow, 1)} m³/h`], ['Temperaturas', `${p.process.Tin} -> ${p.process.Tout} °C`], ['Horas de consumo', `${p.process.hoursPerDay} h/dia`], ['Estratégia', p.process.strategy === 'banco-gelo' ? 'Banco de gelo (acumulação)' : 'Chiller direto']]);
  } else {
    table([
      ['Dimensões (C × L × A)', `${n(g.L, 1)} × ${n(g.W, 1)} × ${n(g.H, 1)} m · ${p.room.count} câmara(s)`],
      ['Área / volume totais', `${n(g.floor * p.room.count)} m² · ${n(g.volume * p.room.count)} m³`],
      ['Temperatura / UR internas', `${p.room.Tin} °C · ${Math.round(p.room.RHin * 100)}%`],
      ['Clima de projeto', `${p.climate.label}: ${p.climate.Tout} °C, ${Math.round(p.climate.RHout * 100)}% UR (bulbo úmido ${n(ev.temps.twb, 1)} °C)`],
    ]);
    h2('2. Produtos');
    const prod = productById(p.product.typeId);
    table([['Produto', prod.name], ['Massa armazenada / diária', `${n(p.product.storedMass)} kg · ${n(p.product.dailyMass)} kg/dia`], ['Temperaturas', `entrada ${p.product.Tenter} °C -> final ${p.product.Tfinal} °C em ${p.product.coolingHours} h`], ['Embalagem', `${p.product.packaging} (${Math.round(p.product.packagingFraction * 100)}% da massa)`]]);
    h2('3. Portas');
    if (!p.doors.length) para('Nenhuma porta configurada.');
    p.doors.forEach((d, i) => {
      const det = ev.loads.nominal.doorDetails.find((x) => x.id === d.id);
      table([[`Porta ${i + 1}`, `${DOOR_TYPES.find((t) => t.id === d.type)?.name} · ${n(d.width, 1)} × ${n(d.height, 1)} m × ${d.count} · ${d.passagesPerHour} passagens/h por ${d.hoursPerDay} h/dia · lado externo ${d.adjacentT} °C/${Math.round(d.adjacentRH * 100)}% · ${DOOR_PROTECTION[d.protection].name} · ~${n(det?.kW ?? 0, 2)} kW médios`]]);
    });
    h2('4. Isolamento');
    const ins = insulationById(p.envelope.insulation);
    table([['Material', ins.name], ['Espessuras', `paredes ${p.envelope.wallThk} mm · teto ${p.envelope.roofThk} mm · piso ${p.envelope.floorInsulated ? p.envelope.floorThk + ' mm' : 'sem isolamento'}`], ['U das paredes (calculado)', `${n(ev.loads.nominal.U.wall, 3)} W/m²K (lambda ${p.envelope.lambdaOverride ?? ins.lambda} W/mK)`]]);
  }

  // ---------- Cargas
  h2(`${p.application === 'agua-gelada' ? 2 : 5}. Cargas térmicas estimadas`);
  const items = ev.breakdown;
  const max = Math.max(...items.map((i) => i.kWhDay), 1);
  items.forEach((it, k) => {
    need(7);
    doc.setFontSize(8.5); doc.setFont('helvetica', 'normal'); doc.setTextColor(29, 39, 51);
    doc.text(clean(it.label), M, y);
    doc.setFillColor(238, 241, 244); doc.rect(M + 55, y - 3, 90, 3.5, 'F');
    doc.setFillColor(...PAL[k % PAL.length]); doc.rect(M + 55, y - 3, (90 * it.kWhDay) / max, 3.5, 'F');
    doc.text(`${n(it.share * 100)}% · ${n(it.kWhDay)} kWh/dia`, W - M, y, { align: 'right' });
    y += 6;
  });
  y += 2;
  table([
    ['Carga média / diária', `${n(ev.loads.nominal.avgKW, 1)} kW · ${n(ev.loads.nominal.totalKWhDay)} kWh/dia`],
    ['Capacidade requerida', `${n(ev.loads.nominal.requiredKW)} kW (faixa ${n(ev.range[0])} a ${n(ev.range[1])} kW), ${p.system.runHours} h/dia de operação, segurança de ${Math.round(p.system.safetyFactor * 100)}%`],
    ['Evaporação / condensação', `${n(ev.temps.Te, 1)} °C / ${n(ev.temps.Tc, 1)} °C · COP do ciclo ${n(ev.cycle.COP, 2)}`],
    ['Potência elétrica estimada', `${n(ev.energy.totalElecKW)} kW (compressores ${n(ev.energy.compKW)} kW)`],
    ['Consumo e custo estimados', `${n(ev.energy.kWhYear)} kWh/ano · ${ev.energy.costYear.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 })}/ano a ${n(p.finance.tariff, 2)} R$/kWh`],
  ]);
  if (ev.insights.length) { h2('Conclusões sustentadas pelos resultados'); ev.insights.forEach((t) => para('• ' + t)); }

  // ---------- Soluções
  h2('Soluções sugeridas (famílias de equipamentos)');
  suggestEquipment(p, ev).forEach((s) => { para(`${s.category}${s.product ? ` — ref.: ${s.product}` : ''} [${ORIGIN_LABEL[s.origin]}]`, 9.5, NAVY); para(s.why, 8.5); para('Falta para seleção: ' + s.missing.join('; ') + '.', 8, GREY); });
  para('Valor de fornecimento sujeito a orçamento técnico-comercial.', 9, BLUE);

  // ---------- Comparação
  if (b) {
    const eb = evaluate(b);
    const c = compare(p, ev, b, eb);
    h2('Comparação de cenários');
    const ia = captureScene('A'), ib = captureScene('B');
    if (ia && ib) {
      // vista dividida ativa: imagens dos dois cenários lado a lado
      const pa = doc.getImageProperties(ia);
      const iw = (W - 2 * M - 4) / 2, ih = Math.min(90, iw * (pa.height / pa.width));
      need(ih + 8);
      try { doc.addImage(ia, 'PNG', M, y, iw, ih, undefined, 'FAST'); doc.addImage(ib, 'PNG', M + iw + 4, y, iw, ih, undefined, 'FAST'); } catch { /* ignora */ }
      doc.setFontSize(8); doc.setTextColor(...GREY);
      doc.text('A', M + 2, y + ih + 4); doc.text('B', M + iw + 6, y + ih + 4);
      y += ih + 9;
    }
    table([
      ['Cenário A', p.name], ['Cenário B', b.name],
      ['Capacidade A / B', `${n(ev.loads.nominal.requiredKW)} / ${n(eb.loads.nominal.requiredKW)} kW`],
      ['Consumo A / B', `${n(ev.energy.kWhYear / 1000)} / ${n(eb.energy.kWhYear / 1000)} MWh/ano`],
      ['Economia potencial', `${c.dCost.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 })}/ano`],
      ['Payback simples', c.payback ? `${n(c.payback, 1)} anos` : 'não calculado'],
    ]);
    para(c.note, 8, GREY);
    if (p.finance.investmentSource) para('Origem dos valores de investimento: ' + p.finance.investmentSource, 8, GREY);
  }

  h2('Benefícios potenciais');
  para('Os benefícios abaixo derivam dos números deste cenário e não são promessas de desempenho: ' + (ev.breakdown.slice(0, 2).map((x) => `${x.label.toLowerCase()} responde por ${n(x.share * 100)}% da carga`).join('; ')) + '. Ações sobre essas parcelas tendem a ter o maior efeito na capacidade e no consumo.');

  h2('Premissas e limitações');
  [
    'Regime permanente na condição de projeto (verão). Sem modelagem de carga parcial, condensação flutuante ou inércia térmica.',
    'Propriedades do R717 por tabelas CoolProp (referência IIR) e psicrometria ASHRAE. Cargas pelo ASHRAE Refrigeration, cap. 24.',
    'Hipóteses editáveis: TD do evaporador, aproximação do condensador, eficiências, ventiladores, degelo e pontes térmicas.',
    `Margem de incerteza pela qualidade dos dados: ±${Math.round(QUALITY_INFO[ev.quality].extra * 100)}% (${QUALITY_INFO[ev.quality].label}).`,
    'Não substitui projeto executivo, seleção de catálogo, análise de risco ou responsabilidade técnica (ART). Requisitos legais: NR-13, NR-15, NR-36; normas: ABNT NBR 16069, ANSI/IIAR.',
  ].forEach((t) => para('• ' + t, 8.5));
  h2('Informações necessárias para a engenharia detalhada');
  ev.missing.forEach((t) => para('• ' + t, 8.5));
  h2('Fontes técnicas');
  SOURCES.forEach((s) => para(`${s.title}${s.url ? ` — ${s.url}` : ''}`, 7.5, GREY));

  footer();
  if (opts.save !== false) doc.save(`${p.name.replace(/[^\w-]+/g, '_')}_relatorio.pdf`);
  return doc.output('blob');
}
