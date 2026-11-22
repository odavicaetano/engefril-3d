/**
 * Famílias de equipamentos sugeridas a partir do cenário. Nunca atribui capacidade a um modelo comercial:
 * indica a categoria, o produto de catálogo (quando existe), a justificativa e os dados que faltam para selecionar.
 */
import type { Evaluation } from './analysis';
import type { Project } from './types';
import type { Origin } from '../data/sources';

export interface Suggestion { category: string; product?: string; url?: string; equipId?: string; why: string; duty?: string; missing: string[]; origin: Origin }

export function suggestEquipment(p: Project, e: Evaluation): Suggestion[] {
  const out: Suggestion[] = [];
  const cap = e.loads.nominal.requiredKW;
  const Tin = p.room.Tin;
  const water = p.application === 'agua-gelada';
  const fmt = (v: number) => v.toLocaleString('pt-BR', { maximumFractionDigits: 0 });
  if (!water) {
    const fin = Tin > 0 ? '5 mm (degelo natural por ar, ambientes acima de 0 °C)' : Tin > -18 ? '8 mm (degelo por água ou gás quente)' : '11,2 mm (baixa temperatura e túneis; bandejas com serpentina de gás quente)';
    out.push({
      category: 'Evaporadores (resfriadores de ar)', product: 'Evaporadores Engefril', url: 'https://engefril.com.br/produtos/equipamentos-frigorificos/evaporadores/', equipId: 'evaporador-1',
      why: `Capacidade total de cerca de ${fmt(cap)} kW a ${Tin} °C, com evaporação estimada de ${e.temps.Te.toFixed(0)} °C (TD ${p.system.evapTD} K). Passo de aletas indicado: ${fin}.`,
      duty: `${fmt(cap)} kW total`, missing: ['Capacidade certificada por modelo (não publicada)', 'Alcance de jato e layout de estocagem', 'Regime e tipo de degelo definitivos'], origin: 'calculado',
    });
  }
  out.push({
    category: 'Condensador evaporativo', product: 'Condensador Evaporativo Engefril', url: 'https://engefril.com.br/produtos/equipamentos-frigorificos/condensador-evaporativo/', equipId: 'condensador',
    why: `Calor a rejeitar de cerca de ${e.cycle.errors.length ? '—' : fmt(e.cycle.Qc)} kW, com bulbo úmido de projeto de ${e.temps.twb.toFixed(1)} °C e condensação a ${e.temps.Tc.toFixed(1)} °C.`,
    duty: e.cycle.errors.length ? undefined : `${fmt(e.cycle.Qc)} kW rejeitados`,
    missing: ['Tabela de capacidade do fabricante (publicada em imagem, não transcrita)', 'Bulbo úmido de projeto do local', 'Qualidade da água'], origin: 'calculado',
  });
  out.push({
    category: 'Sistema de compressão', equipId: 'compressor-1',
    why: `${p.system.architecture === 'duplo-estagio' ? 'Duplo estágio (booster + alta)' : 'Estágio único'}, relação de compressão ${e.cycle.pressureRatio.toFixed(1)}, vazão de sucção de cerca de ${fmt(e.cycle.Vsuction)} m³/h e potência elétrica de cerca de ${e.cycle.Welec.toFixed(0)} kW. Compressores de terceiros, integrados pelo instalador.`,
    duty: `${fmt(e.cycle.Vsuction)} m³/h na sucção`, missing: ['Seleção de fabricante e modelo', 'Estratégia de controle de capacidade', 'Redundância desejada (N+1)'], origin: 'calculado',
  });
  out.push({ category: 'Reservatório de amônia', product: 'Reservatório de Amônia (RAR) Engefril', url: 'https://engefril.com.br/produtos/equipamentos-frigorificos/reservatorio-de-amonia/', equipId: 'recipiente', why: 'Acumula a carga de líquido de alta pressão; vaso NR-13 (ASME VIII Div. 1).', missing: ['Carga total de amônia (volumes de tubulação e evaporadores)', 'Volume de recolhimento (pump-down)'], origin: 'oficial' });
  if (['bombeado', 'gravidade', 'duplo-estagio', 'indireto'].includes(p.system.architecture) || water) {
    out.push({ category: 'Separador de líquido', product: 'Separadores de líquido (linha Engefril)', url: 'https://engefril.com.br/a-engefril/', equipId: 'separador', why: `Separa o vapor de sucção (${fmt(e.cycle.Vsuction)} m³/h) e mantém líquido para os consumidores.`, missing: ['Velocidade de separação e volume de oscilação', 'NPSH das bombas'], origin: 'calculado' });
  }
  if (p.system.architecture === 'bombeado' || water) out.push({ category: 'Bombas de amônia', equipId: 'bomba-1', why: `Recirculação com taxa típica de 3 a 4; potência estimada de cerca de ${e.cycle.Wpump.toFixed(1)} kW (hipótese).`, missing: ['Perda de carga até o consumidor mais distante', 'Modelo de bomba (terceiros)'], origin: 'hipotese' });
  if (water) {
    if (p.process.strategy === 'banco-gelo') out.push({ category: 'Tanque de água gelada compacto de NH₃ (banco de gelo)', product: 'Tanque de Água Gelada Compacto de NH3', url: 'https://engefril.com.br/produtos/equipamentos-frigorificos/tanque-de-agua-gelada-compacto-de-nh3/', equipId: 'tanque', why: `Acumula frio para o pico de ${e.loads.nominal.processKW?.toFixed(0)} kW durante ${p.process.hoursPerDay} h/dia; fornece água a cerca de +1 a +2 °C (dado oficial).`, missing: ['Perfil horário do consumo', 'Volume do tanque e massa de gelo'], origin: 'oficial' });
    else out.push({ category: 'Sistema Chiller', product: 'Sistema Chiller Engefril', url: 'https://engefril.com.br/produtos/equipamentos-frigorificos/sistema-chiller/', equipId: 'trocador', why: `Atende diretamente o pico de ${e.loads.nominal.processKW?.toFixed(0)} kW. Compressor, condensador, trocador a placas e separador em um equipamento (dado oficial).`, missing: ['Faixa de capacidade do modelo', 'Fluido secundário e proteção anticongelamento'], origin: 'oficial' });
  } else if (p.system.architecture === 'indireto') {
    out.push({ category: 'Sistema Chiller (fluido secundário)', product: 'Sistema Chiller Engefril', url: 'https://engefril.com.br/produtos/equipamentos-frigorificos/sistema-chiller/', equipId: 'trocador', why: 'Arquitetura indireta: a amônia fica confinada à sala de máquinas e o glicol atende os evaporadores.', missing: ['Tipo e concentração do glicol', 'Faixa de capacidade do modelo'], origin: 'oficial' });
  }
  if (!water) {
    out.push({ category: 'Painéis termoisolantes', product: 'Painel Termoisolante Engefril (EPS 15 kg/m³)', url: 'https://engefril.com.br/produtos/portas-de-refrigeracao/painel-termoisolante/', equipId: 'camara', why: `Envelope com ${p.envelope.wallThk} mm nas paredes e ${p.envelope.roofThk} mm no teto; U das paredes de ${e.loads.nominal.U.wall.toFixed(3)} W/m²·K (λ adotado ${p.envelope.lambdaOverride ?? 0.038}).`, missing: ['Espessuras disponíveis e λ declarado pelo fabricante', 'Detalhes de piso, barreira de vapor e pontes térmicas'], origin: 'oficial' });
    const doorTypes = [...new Set(p.doors.map((d) => d.type))];
    if (doorTypes.length) out.push({ category: 'Portas frigoríficas', product: 'Portas Engefril', url: 'https://engefril.com.br/produtos/portas-de-refrigeracao/', why: `Tipos configurados: ${doorTypes.join(', ')}. Folhas em painel de 35 a 250 mm; resistência no marco para câmaras de congelados (dado oficial).`, missing: ['Vão livre, automação e intertravamentos', 'Dispositivo de proteção (cortina) e vedação'], origin: 'oficial' });
  }
  return out;
}
