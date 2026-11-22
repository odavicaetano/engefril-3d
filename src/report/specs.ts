/**
 * Quadros de dados compartilhados entre PDF e planilhas: TAGs e especificação de equipamentos.
 * Uma única fonte garante que o relatório e a planilha mostrem exatamente os mesmos valores.
 */
import type { Project } from '../engine/types';
import type { Evaluation } from '../engine/analysis';
import { EQUIPMENT } from '../data/equipment';
import { computeLayout, type Layout } from '../scene/layout';
import { n } from './common';

/** Etiquetas de desenho (TAG) por equipamento da cena. São identificadores do documento, não modelos comerciais. */
export function equipmentTags(l: Layout): Record<string, string> {
  const tags: Record<string, string> = {};
  const count: Record<string, number> = {};
  const pre: Record<string, string> = { compressor: 'C', condensador: 'CD', recipiente: 'RL', separador: 'SL', bomba: 'BA', intercooler: 'RI', trocador: 'TP', evaporador: 'EV', tanque: 'TQ', painel: 'QE', valvulas: 'QV', exaustor: 'EX', sensor: 'DT', camara: 'CF' };
  for (const e of l.equips) {
    const p = e.id === 'bomba-glicol' ? 'BG' : pre[e.kind] ?? 'X';
    count[p] = (count[p] ?? 0) + 1;
    tags[e.id] = `${p}-${String(count[p]).padStart(2, '0')}`;
  }
  return tags;
}

export interface EquipmentRow { tag: string; name: string; fn: string; capacity: string; facts: string; origin: string }

/** Especificação de equipamentos com capacidades estimadas pelo motor (sem atribuir modelos comerciais). */
export function equipmentSchedule(p: Project, ev: Evaluation, l: Layout = computeLayout(p)): EquipmentRow[] {
  const tags = equipmentTags(l);
  const c = ev.cycle;
  const nEv = Math.max(1, l.evaps.length);
  const evKW = ev.loads.nominal.requiredKW / (nEv * Math.max(1, p.room.count));
  const comps = l.equips.filter((e) => e.kind === 'compressor');
  const factsOf = (kind: string) => (EQUIPMENT[kind]?.facts ?? []).filter((f) => f.origin === 'oficial').slice(0, 2).map((f) => f.text).join('; ') || '—';
  const fnOf = (kind: string) => (EQUIPMENT[kind]?.fn ?? '').split('.')[0];
  const capOf = (id: string, kind: string): string => {
    if (c.errors.length) return '—';
    switch (kind) {
      case 'compressor': {
        if (l.arch === 'duplo-estagio') return id.endsWith('1') ? `Estágio BP: ${n(c.mdot * 3600, 0)} kg/h; ${n(c.Vsuction, 0)} m³/h na sucção` : `Estágio AP: ${n((c.mdotHP ?? 0) * 3600, 0)} kg/h`;
        return `${n(ev.loads.nominal.requiredKW / comps.length, 1)} kW frig. (divisão 1/${comps.length}, hipótese); ${n(c.Welec / comps.length, 1)} kW elét.`;
      }
      case 'condensador': return `${n(c.Qc, 1)} kW rejeitados a Tc ${n(ev.temps.Tc, 1)} °C / Tbu ${n(ev.temps.twb, 1)} °C`;
      case 'evaporador': return `${n(evKW, 1)} kW a Te ${n(ev.temps.Te, 1)} °C (ar a ${p.room.Tin} °C)`;
      case 'separador': return `Sucção de ${n(c.Vsuction, 0)} m³/h; volume a definir`;
      case 'recipiente': return 'Volume a definir (carga total de NH3)';
      case 'bomba': return id === 'bomba-glicol' ? 'Fluido secundário: vazão a definir' : `${n(c.Wpump, 2)} kW (taxa de recirculação 4; hipótese)${id.endsWith('2') ? '; reserva' : ''}`;
      case 'trocador': return `${n(ev.loads.nominal.requiredKW, 1)} kW`;
      case 'intercooler': return `Pressão intermediária de ${n((c.Pi ?? 0) / 100, 2)} bar (${n(c.Ti ?? 0, 1)} °C)`;
      case 'tanque': return `${n(ev.loads.nominal.totalKWhDay, 0)} kWh/dia; pico de ${n(ev.loads.nominal.processKW ?? 0, 0)} kW`;
      default: return '—';
    }
  };
  const originOf = (kind: string) => (EQUIPMENT[kind]?.engefril ? 'Catálogo Engefril (família)' : 'Componente de terceiros');
  const rows: EquipmentRow[] = l.equips.filter((e) => !['camara', 'sensor', 'evaporador'].includes(e.kind))
    .map((e) => ({ tag: tags[e.id], name: e.label, fn: fnOf(e.kind), capacity: capOf(e.id, e.kind), facts: factsOf(e.kind), origin: originOf(e.kind) }));
  if (l.evaps.length) {
    const t0 = tags[l.evaps[0].id], t1 = tags[l.evaps[l.evaps.length - 1].id];
    rows.splice(Math.min(rows.length, 2), 0, { tag: l.evaps.length > 1 ? `${t0} a ${t1}` : t0, name: `Evaporadores: ${l.evaps.length} por câmara × ${p.room.count} câmara(s)`, fn: fnOf('evaporador'), capacity: `${capOf(l.evaps[0].id, 'evaporador')}, cada`, facts: factsOf('evaporador'), origin: originOf('evaporador') });
  }
  const sensors = l.equips.filter((e) => e.kind === 'sensor');
  if (sensors.length) rows.push({ tag: sensors.map((s) => tags[s.id]).join(', '), name: 'Detectores de NH3', fn: 'Detecção de vazamentos e acionamento de alarmes e exaustão', capacity: '—', facts: 'Níveis de alarme por projeto (IIAR 2 / NBR 16069)', origin: 'Componente de terceiros' });
  return rows;
}
