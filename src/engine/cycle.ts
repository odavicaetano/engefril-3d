/**
 * Ciclos de compressão de vapor com R717 para diferentes arquiteturas.
 * Modelo em regime permanente, sem perdas de carga explícitas (penalidade de sucção como ΔT equivalente).
 */
import { satT, tSat, satLiquid, satVapor, statePh, subcooledLiquid, vaporPs, vaporPT, PropertyDomainError, type State } from './r717';

export type Architecture = 'dx' | 'gravidade' | 'bombeado' | 'duplo-estagio' | 'indireto';
export const ARCHITECTURES: { id: Architecture; name: string; desc: string }[] = [
  { id: 'bombeado', name: 'Recirculação bombeada (overfeed)', desc: 'Separador de líquido de baixa pressão com bombas que alimentam os evaporadores com excesso de líquido. O vapor seco volta ao separador e segue para o compressor.' },
  { id: 'gravidade', name: 'Circulação por gravidade (inundado)', desc: 'O separador fica acima do evaporador e o líquido desce por gravidade (termossifão). Não usa bombas, mas exige altura e mais carga de refrigerante.' },
  { id: 'dx', name: 'Expansão direta (DX)', desc: 'Válvula de expansão na entrada do evaporador, com superaquecimento na saída. Usa menos carga de NH₃, mas a superfície da serpentina é menos aproveitada.' },
  { id: 'duplo-estagio', name: 'Duplo estágio com resfriador intermediário', desc: 'Compressores de baixa e de alta com um intercooler aberto (flash). Indicado para grandes relações de pressão, como em congelamento e túneis.' },
  { id: 'indireto', name: 'Sistema indireto (água gelada / glicol)', desc: 'O NH₃ fica restrito à sala de máquinas (chiller) e um fluido secundário leva o frio aos consumidores. Reduz a carga de amônia em áreas ocupadas, com uma penalidade de temperatura.' },
];

export interface CycleInput {
  Te: number; // temperatura de evaporação [°C]
  Tc: number; // temperatura de condensação [°C]
  superheat: number; // superaquecimento na sucção do compressor [K]
  subcool: number; // sub-resfriamento na saída do condensador/recipiente [K]
  etaIs: number; // eficiência isentrópica do compressor
  etaMotor: number; // eficiência motor/transmissão
  architecture: Architecture;
  capacity: number; // capacidade frigorífica requerida no evaporador [kW]
  circulationRate?: number; // taxa de recirculação (bombeado)
  pumpDp?: number; // kPa
  secondaryApproach?: number; // K (indireto: diferença entre evaporação do NH3 e fluido no consumidor)
}

export interface CycleState extends State { id: string; label: string }
export interface CycleResult {
  states: CycleState[];
  path: string[][]; // sequências de ids para desenhar o ciclo
  mdot: number; mdotHP?: number; // kg/s
  qe: number; // kJ/kg efeito frigorífico
  W: number; // potência no eixo dos compressores [kW]
  Welec: number; // potência elétrica dos compressores [kW]
  Wpump: number; // bombas de refrigerante/fluido secundário [kW]
  Qc: number; // calor rejeitado [kW]
  COP: number; // capacidade / potência elétrica (compressores + bombas)
  COPcarnot: number;
  Tdis: number; Tdis2?: number; // temperatura de descarga
  pressureRatio: number;
  Vsuction: number; // vazão volumétrica na sucção [m³/h]
  Pi?: number; Ti?: number;
  balanceError: number; // |Qe + W - Qc| / Qc
  warnings: string[];
  errors: string[];
}

export const VALID = { TeMin: -55, TeMax: 10, TcMin: 15, TcMax: 55, minLift: 10 };

const lab = (id: string, label: string, s: State): CycleState => ({ ...s, id, label });

function compress(s1: State, P2: number, etaIs: number): { s2s: State; s2: State } {
  const s2s = vaporPs(P2, s1.s);
  const h2 = s1.h + (s2s.h - s1.h) / etaIs;
  return { s2s, s2: statePh(P2, h2) };
}

export function computeCycle(inp: CycleInput): CycleResult {
  const warnings: string[] = [];
  const errors: string[] = [];
  const { Te, Tc, superheat, subcool, etaIs, etaMotor, architecture, capacity } = inp;
  const empty = (msg: string): CycleResult => ({ states: [], path: [], mdot: 0, qe: 0, W: 0, Welec: 0, Wpump: 0, Qc: 0, COP: 0, COPcarnot: 0, Tdis: 0, pressureRatio: 0, Vsuction: 0, balanceError: 0, warnings, errors: [msg] });

  if (!(Te >= VALID.TeMin && Te <= VALID.TeMax)) return empty(`Temperatura de evaporação fora do domínio do modelo (${VALID.TeMin} a ${VALID.TeMax} °C).`);
  if (!(Tc >= VALID.TcMin && Tc <= VALID.TcMax)) return empty(`Temperatura de condensação fora do domínio do modelo (${VALID.TcMin} a ${VALID.TcMax} °C).`);
  if (Tc - Te < VALID.minLift) return empty('A condensação deve ser ao menos 10 K acima da evaporação para que o ciclo faça sentido físico.');
  if (!(etaIs > 0.3 && etaIs <= 1)) return empty('Eficiência isentrópica deve estar entre 0,3 e 1,0.');
  if (subcool < 0 || subcool > 15) return empty('Sub-resfriamento fora da faixa admitida (0 a 15 K).');
  if (superheat < 0 || superheat > 30) return empty('Superaquecimento fora da faixa admitida (0 a 30 K).');

  try {
    const Pe = satT(Te).P, Pc = satT(Tc).P;
    const pr = Pc / Pe;
    const liq = subcooledLiquid(Pc, Tc - subcool);
    const COPcarnot = (Te + 273.15) / (Tc - Te);
    let r: CycleResult;

    if (architecture === 'duplo-estagio') {
      const Pi = Math.sqrt(Pe * Pc);
      const s1 = superheat > 0 ? vaporPT(Pe, Te + superheat) : satVapor(Te);
      const { s2 } = compress(s1, Pi, etaIs);
      const Ti = tSat(Pi);
      const iL = satLiquid(Ti), iV = satVapor(Ti);
      const s3 = iV;
      const { s2: s4 } = compress(s3, Pc, etaIs);
      const s5 = liq;
      const s6 = statePh(Pi, s5.h); // expansão para o intercooler
      const s7 = iL; // líquido saturado do intercooler
      const s8 = statePh(Pe, s7.h); // expansão para o evaporador
      const qe = s1.h - s8.h;
      const mLP = capacity / qe;
      const mHP = (mLP * (s2.h - s7.h)) / (s3.h - s5.h);
      const W = mLP * (s2.h - s1.h) + mHP * (s4.h - s3.h);
      const Qc = mHP * (s4.h - s5.h);
      const Welec = W / etaMotor;
      r = {
        states: [lab('1', 'Sucção BP', s1), lab('2', 'Descarga BP', s2), lab('3', 'Sucção AP (vapor saturado do intercooler)', s3), lab('4', 'Descarga AP', s4), lab('5', 'Saída do condensador', s5), lab('6', 'Entrada do intercooler', s6), lab('7', 'Líquido do intercooler', s7), lab('8', 'Entrada do evaporador', s8)],
        path: [['8', '1', '2', '3', '4', '5', '6', '7', '8']],
        mdot: mLP, mdotHP: mHP, qe, W, Welec, Wpump: 0, Qc, COP: capacity / Welec, COPcarnot,
        Tdis: s2.T, Tdis2: s4.T, pressureRatio: pr, Vsuction: (mLP / s1.rho) * 3600, Pi, Ti,
        balanceError: Math.abs(capacity + W - Qc) / Qc, warnings, errors,
      };
    } else {
      // Ciclo simples. Em sistemas inundados/bombeados, o compressor aspira vapor (quase) saturado do separador.
      const sh = architecture === 'dx' ? Math.max(superheat, 5) : superheat;
      const s1 = sh > 0 ? vaporPT(Pe, Te + sh) : satVapor(Te);
      const { s2 } = compress(s1, Pc, etaIs);
      const s3 = liq;
      const s4 = statePh(Pe, s3.h);
      // Efeito frigorífico útil: em sistemas inundados o superaquecimento ocorre na linha de sucção (não útil).
      const usefulOut = architecture === 'dx' ? s1.h : satVapor(Te).h;
      const qe = usefulOut - s4.h;
      const mdot = capacity / qe;
      const W = mdot * (s2.h - s1.h);
      const Qc = mdot * (s2.h - s3.h);
      const Welec = W / etaMotor;
      let Wpump = 0;
      if (architecture === 'bombeado') {
        const n = inp.circulationRate ?? 4;
        const rhoL = satT(Te).rhoL;
        const Vdot = (n * mdot) / rhoL; // m³/s de líquido bombeado
        Wpump = (Vdot * (inp.pumpDp ?? 200)) / 0.5; // kW (eficiência global 50%, hipótese)
      }
      if (architecture === 'indireto') {
        // bomba do fluido secundário: propilenoglicol ~30% (cp≈3,85 kJ/kg.K, rho≈1030 kg/m³), ΔT 4 K, Δp 250 kPa, η 0,6 (hipóteses)
        const m2 = capacity / (3.85 * 4);
        Wpump = ((m2 / 1030) * 250) / 0.6;
      }
      const nonUseful = (s1.h - usefulOut) * mdot;
      r = {
        states: [lab('1', 'Sucção do compressor', s1), lab('2', 'Descarga do compressor', s2), lab('3', 'Saída do condensador / recipiente', s3), lab('4', 'Após a expansão', s4)],
        path: [['4', '1', '2', '3', '4']],
        mdot, qe, W, Welec, Wpump, Qc, COP: capacity / (Welec + Wpump), COPcarnot,
        Tdis: s2.T, pressureRatio: pr, Vsuction: (mdot / s1.rho) * 3600,
        balanceError: Math.abs(capacity + nonUseful + W - Qc) / Qc, warnings, errors,
      };
    }

    // Avisos de engenharia (limites usuais; não são limites de um equipamento específico)
    if (architecture !== 'duplo-estagio' && pr > 8) warnings.push(`Relação de compressão ${pr.toFixed(1)} elevada para um único estágio: avalie duplo estágio ou economizador.`);
    const tdMax = Math.max(r.Tdis, r.Tdis2 ?? -999);
    if (tdMax > 130) warnings.push(`Temperatura de descarga estimada de ${tdMax.toFixed(0)} °C. Compressores alternativos de amônia costumam ter limite próximo de 120 a 135 °C; compressores parafuso controlam a descarga pela injeção de óleo.`);
    if (architecture === 'dx' && Te < -30) warnings.push('Expansão direta com NH₃ em temperaturas muito baixas é pouco usual: a distribuição e o retorno de óleo ficam difíceis.');
    if (architecture === 'gravidade' && capacity > 500) warnings.push('Grandes capacidades por gravidade exigem separadores elevados e mais carga de amônia; a recirculação bombeada costuma ser preferida.');
    return r;
  } catch (e) {
    if (e instanceof PropertyDomainError) return empty(e.message);
    throw e;
  }
}
