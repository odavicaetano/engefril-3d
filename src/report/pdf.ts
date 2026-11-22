/** Relatório Comercial em PDF A4, montado com o kit compartilhado (mesma identidade do relatório técnico). */
import type { jsPDF } from 'jspdf';
import type { Project } from '../engine/types';
import { evaluate, compare, QUALITY_INFO } from '../engine/analysis';
import { suggestEquipment } from '../engine/suggest';
import { productById } from '../data/products';
import { insulationById, DOOR_PROTECTION, DOOR_TYPES } from '../data/materials';
import { ARCHITECTURES } from '../engine/cycle';
import { SOURCES, ORIGIN_LABEL } from '../data/sources';
import { BLUE, NAVY, GREY, n, brl } from './common';
import { PdfComposer } from './kit';

const DISCLAIMER = 'ESTUDO PRELIMINAR: estimativa gerada por protótipo demonstrativo inspirado na Engefril, sem vínculo oficial. Não constitui proposta comercial, projeto de engenharia, ART ou validação profissional.';

export interface CommercialOptions {
  orientation?: 'retrato' | 'paisagem';
  revision?: string; client?: string; date?: Date; compress?: boolean;
  image?: string | null; imageA?: string | null; imageB?: string | null;
}

export function buildCommercialReport(p: Project, b: Project | null, o: CommercialOptions = {}): jsPDF {
  const ev = evaluate(p);
  const date = (o.date ?? new Date()).toLocaleDateString('pt-BR');
  const K = new PdfComposer({
    title: `Relatório Comercial de Pré-dimensionamento: ${p.name}`, shortTitle: 'Relatório Comercial de Pré-dimensionamento',
    subject: 'Resumo comercial de pré-dimensionamento de refrigeração industrial', code: 'E3D-COM', revision: o.revision || 'R0', date,
    project: p.name, client: o.client, classification: 'Estudo preliminar', disclaimer: DISCLAIMER,
  }, { orientation: o.orientation ?? 'retrato', compress: o.compress });
  const { para, kv, note, bullets, barChart } = K;
  const doc = K.doc;
  let secN = 0;
  const h2 = (t: string) => { K.SubTitle(`${++secN}. ${t}`); };

  // ---------- capa
  const g = ev.loads.nominal.geometry;
  K.Cover([
    ['Projeto', p.name], ...(o.client ? [['Cliente', o.client] as [string, string]] : []),
    ['Classificação', 'Estudo preliminar (pré-dimensionamento orientativo)'], ['Revisão / data', `${o.revision || 'R0'} · ${date}`],
    ['Capacidade frigorífica preliminar', ev.cycle.errors.length ? 'sem cálculo válido' : `${n(ev.range[0])} a ${n(ev.range[1])} kW (nominal ${n(ev.loads.nominal.requiredKW)} kW, ~${n(ev.loads.nominal.requiredKW / 3.517)} TR)`],
    ['Consumo de energia estimado', `~${n(ev.energy.kWhYear / 1000)} MWh/ano · ${brl(ev.energy.costYear)}/ano`],
    ['Arquitetura considerada', ARCHITECTURES.find((a) => a.id === p.system.architecture)?.name ?? ''],
    ['Qualidade da estimativa', `${QUALITY_INFO[ev.quality].label}: ${QUALITY_INFO[ev.quality].desc}`],
  ], o.image);

  // ---------- conteúdo
  K.newPage('texto');
  h2('Dados da instalação');
  if (p.application === 'agua-gelada') {
    kv([['Aplicação', 'Processo com água gelada'], ['Vazão', `${n(p.process.flow, 1)} m³/h`], ['Temperaturas', `${p.process.Tin} -> ${p.process.Tout} °C`], ['Horas de consumo', `${p.process.hoursPerDay} h/dia`], ['Estratégia', p.process.strategy === 'banco-gelo' ? 'Banco de gelo (acumulação)' : 'Chiller direto']]);
  } else {
    kv([
      ['Dimensões (C × L × A)', `${n(g.L, 1)} × ${n(g.W, 1)} × ${n(g.H, 1)} m · ${p.room.count} câmara(s)`],
      ['Área / volume totais', `${n(g.floor * p.room.count)} m² · ${n(g.volume * p.room.count)} m³`],
      ['Temperatura / UR internas', `${p.room.Tin} °C · ${Math.round(p.room.RHin * 100)}%`],
      ['Clima de projeto', `${p.climate.label}: ${p.climate.Tout} °C, ${Math.round(p.climate.RHout * 100)}% UR (bulbo úmido ${n(ev.temps.twb, 1)} °C)`],
      ...(p.cadImport ? [['Geometria', `importada de ${p.cadImport.fileName} (${p.cadImport.format.toUpperCase()}, unidade ${p.cadImport.unit})`] as [string, string]] : []),
    ]);
    h2('Produtos');
    const prod = productById(p.product.typeId);
    kv([['Produto', prod.name], ['Massa armazenada / diária', `${n(p.product.storedMass)} kg · ${n(p.product.dailyMass)} kg/dia`], ['Temperaturas', `entrada ${p.product.Tenter} °C -> final ${p.product.Tfinal} °C em ${p.product.coolingHours} h`], ['Embalagem', `${p.product.packaging} (${Math.round(p.product.packagingFraction * 100)}% da massa)`]]);
    h2('Portas');
    if (!p.doors.length) para('Nenhuma porta configurada.');
    else K.TechnicalTable([{ h: 'Porta', w: 8 }, { h: 'Tipo', w: 26 }, { h: 'l × h × qtd [m]', w: 16, a: 'r' }, { h: 'Uso', w: 20 }, { h: 'Proteção', w: 16 }, { h: 'Carga [kW]', w: 10, a: 'r' }],
      p.doors.map((d, i) => [`P-${String(i + 1).padStart(2, '0')}`, DOOR_TYPES.find((t) => t.id === d.type)?.name ?? d.type, `${n(d.width, 2)} × ${n(d.height, 2)} × ${d.count}`, `${d.passagesPerHour} passagens/h · ${d.hoursPerDay} h/dia · ${d.adjacentT} °C`, DOOR_PROTECTION[d.protection].name, n(ev.loads.nominal.doorDetails.find((x) => x.id === d.id)?.kW ?? 0, 2)]));
    h2('Isolamento');
    const ins = insulationById(p.envelope.insulation);
    kv([['Material', ins.name], ['Espessuras', `paredes ${p.envelope.wallThk} mm · teto ${p.envelope.roofThk} mm · piso ${p.envelope.floorInsulated ? p.envelope.floorThk + ' mm' : 'sem isolamento'}`], ['U das paredes (calculado)', `${n(ev.loads.nominal.U.wall, 3)} W/(m²·K) (lambda ${p.envelope.lambdaOverride ?? ins.lambda} W/(m·K))`]]);
  }

  h2('Cargas térmicas estimadas');
  barChart('Distribuição da carga térmica diária', ev.breakdown.map((x) => ({ label: x.label, v: x.kWhDay, txt: `${n(x.share * 100)} % · ${n(x.kWhDay)} kWh/dia` })));
  kv([
    ['Carga média / diária', `${n(ev.loads.nominal.avgKW, 1)} kW · ${n(ev.loads.nominal.totalKWhDay)} kWh/dia`],
    ['Capacidade requerida', `${n(ev.loads.nominal.requiredKW)} kW (faixa ${n(ev.range[0])} a ${n(ev.range[1])} kW), ${p.system.runHours} h/dia de operação, segurança de ${Math.round(p.system.safetyFactor * 100)} %`],
    ['Evaporação / condensação', `${n(ev.temps.Te, 1)} °C / ${n(ev.temps.Tc, 1)} °C · COP do ciclo ${n(ev.cycle.COP, 2)}`],
    ['Potência elétrica estimada', `${n(ev.energy.totalElecKW)} kW (compressores ${n(ev.energy.compKW)} kW)`],
    ['Consumo e custo estimados', `${n(ev.energy.kWhYear)} kWh/ano · ${brl(ev.energy.costYear)}/ano a ${n(p.finance.tariff, 2)} R$/kWh`],
  ]);
  if (ev.insights.length) { h2('Conclusões sustentadas pelos resultados'); bullets(ev.insights); }

  h2('Soluções sugeridas (famílias de equipamentos)');
  suggestEquipment(p, ev).forEach((s) => { para(`${s.category}${s.product ? `: referência ${s.product}` : ''} [${ORIGIN_LABEL[s.origin]}]`, 9.5, NAVY, 'bold'); para(s.why, 8.5); note('Falta para seleção: ' + s.missing.join('; ') + '.'); });
  para('Valor de fornecimento sujeito a orçamento técnico-comercial.', 9, BLUE, 'bold');

  if (b) {
    const eb = evaluate(b);
    const c = compare(p, ev, b, eb);
    h2('Comparação de cenários');
    if (o.imageA && o.imageB) {
      try {
        const pa = doc.getImageProperties(o.imageA);
        const iw = (K.cw() - 4) / 2, ih = Math.min(90, iw * (pa.height / pa.width));
        K.need(ih + 8);
        doc.addImage(o.imageA, 'PNG', K.ML, K.y, iw, ih, undefined, 'FAST'); doc.addImage(o.imageB, 'PNG', K.ML + iw + 4, K.y, iw, ih, undefined, 'FAST');
        K.font(8, 'bold', GREY); doc.text('A', K.ML + 2, K.y + ih + 4); doc.text('B', K.ML + iw + 6, K.y + ih + 4);
        K.y += ih + 9;
      } catch { /* imagens opcionais */ }
    }
    K.TechnicalTable([{ h: 'Indicador', w: 40 }, { h: 'A', w: 20, a: 'r' }, { h: 'B', w: 20, a: 'r' }, { h: 'B - A', w: 20, a: 'r' }], [
      ['Capacidade requerida [kW]', n(ev.loads.nominal.requiredKW), n(eb.loads.nominal.requiredKW), n(eb.loads.nominal.requiredKW - ev.loads.nominal.requiredKW)],
      ['Consumo [MWh/ano]', n(ev.energy.kWhYear / 1000), n(eb.energy.kWhYear / 1000), n((eb.energy.kWhYear - ev.energy.kWhYear) / 1000)],
      ['Custo de energia [R$/ano]', brl(ev.energy.costYear), brl(eb.energy.costYear), brl(eb.energy.costYear - ev.energy.costYear)],
      ['Payback simples', '', '', c.payback ? `${n(c.payback, 1)} anos` : 'não calculado'],
    ]);
    note(c.note + (p.finance.investmentSource ? ` Origem dos valores de investimento: ${p.finance.investmentSource}.` : ''));
  }

  h2('Benefícios potenciais');
  para('Os benefícios derivam dos números deste cenário e não são promessas de desempenho: ' + ev.breakdown.slice(0, 2).map((x) => `${x.label.toLowerCase()} responde por ${n(x.share * 100)} % da carga`).join('; ') + '. Ações sobre essas parcelas tendem a ter o maior efeito na capacidade e no consumo.');
  h2('Premissas e limitações');
  bullets([
    'Regime permanente na condição de projeto (verão), sem carga parcial, condensação flutuante ou inércia térmica.',
    'Propriedades do R717 por tabelas CoolProp (referência IIR) e psicrometria ASHRAE; cargas pelo ASHRAE Refrigeration, cap. 24.',
    'Hipóteses editáveis: TD do evaporador, aproximação do condensador, eficiências, ventiladores, degelo e pontes térmicas.',
    `Margem de incerteza pela qualidade dos dados: +/-${Math.round(QUALITY_INFO[ev.quality].extra * 100)} % (${QUALITY_INFO[ev.quality].label}).`,
    'Não substitui projeto executivo, seleção de catálogo, análise de risco ou responsabilidade técnica (ART). Requisitos legais: NR-13, NR-15, NR-36; normas: ABNT NBR 16069, ANSI/IIAR.',
  ], 8.6);
  h2('Informações necessárias para a engenharia detalhada');
  bullets(ev.missing, 8.6);
  h2('Fontes técnicas');
  SOURCES.forEach((s) => para(`${s.title}${s.url ? ` (${s.url})` : ''}`, 7.5, GREY));
  K.Disclaimer(DISCLAIMER);
  return K.finalize();
}

/** Compatibilidade: gera e (opcionalmente) baixa o relatório comercial, retornando o Blob. */
export async function buildReport(p: Project, b: Project | null, opts: CommercialOptions & { save?: boolean } = {}): Promise<Blob> {
  const doc = buildCommercialReport(p, b, opts);
  if (opts.save) doc.save(`${p.name.replace(/[^\w-]+/g, '_')}_relatorio_comercial.pdf`);
  return doc.output('blob');
}
