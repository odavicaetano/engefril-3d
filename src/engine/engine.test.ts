import { describe, expect, it } from 'vitest';
import ref from '../data/generated/r717-reference.json';
import { satT, tSat, vaporPT, vaporPs, statePh, PropertyDomainError } from './r717';
import { air, wetBulb } from './psychro';
import { computeCycle, ARCHITECTURES, type CycleInput } from './cycle';
import { computeLoads, doorInfiltration } from './loads';
import { evaluate, sensitivity, compare } from './analysis';
import { baseProject, DEMOS, makeDoor, projectFor, APPLICATIONS } from '../data/scenarios';

const rel = (a: number, b: number) => Math.abs(a - b) / Math.abs(b);

describe('R717: propriedades vs CoolProp (pontos fora da grade)', () => {
  it('saturação', () => {
    for (const r of ref.refSat) {
      const s = satT(r.T);
      expect(rel(s.P, r.P)).toBeLessThan(2e-4);
      expect(Math.abs(s.hL - r.hL)).toBeLessThan(0.3);
      expect(Math.abs(s.hV - r.hV)).toBeLessThan(0.3);
      expect(Math.abs(s.sV - r.sV)).toBeLessThan(2e-3);
      expect(rel(s.rhoV, r.rhoV)).toBeLessThan(2e-3);
      expect(Math.abs(tSat(r.P) - r.T)).toBeLessThan(0.02);
    }
  });
  it('vapor superaquecido', () => {
    for (const r of ref.ref) {
      const s = vaporPT(r.P, r.Tsat + r.dT);
      expect(Math.abs(s.h - r.h)).toBeLessThan(1.5); // < 0,1%
      expect(Math.abs(s.s - r.s)).toBeLessThan(5e-3);
      expect(rel(s.rho, r.rho)).toBeLessThan(5e-3);
    }
  });
  it('compressão isentrópica', () => {
    for (const r of ref.refIsen) {
      const s1 = satT(r.Te);
      const s2 = vaporPs(satT(r.Tc).P, s1.sV);
      expect(Math.abs(s2.h - r.h2s)).toBeLessThan(2);
      expect(Math.abs(s2.T - r.T2s)).toBeLessThan(1);
    }
  });
  it('estados por P,h e títulos possíveis', () => {
    const s = satT(-10);
    const mid = statePh(s.P, (s.hL + s.hV) / 2);
    expect(mid.phase).toBe('bifasico');
    expect(mid.x!).toBeCloseTo(0.5, 3);
    expect(statePh(s.P, s.hL - 20).phase).toBe('liquido');
    expect(statePh(s.P, s.hV + 50).phase).toBe('vapor');
  });
  it('fora do domínio gera erro explícito, não número', () => {
    expect(() => satT(150)).toThrow(PropertyDomainError);
  });
});

describe('Psicrometria vs CoolProp HAPropsSI', () => {
  it('W, h, v', () => {
    for (const r of ref.psy) {
      const a = air(r.T, r.RH);
      expect(rel(a.W, r.W)).toBeLessThan(0.01);
      expect(Math.abs(a.h - r.h)).toBeLessThan(0.5);
      expect(rel(a.v, r.v)).toBeLessThan(0.002);
    }
  });
  it('bulbo úmido coerente', () => {
    const tw = wetBulb(32, 0.55);
    expect(tw).toBeGreaterThan(24.5);
    expect(tw).toBeLessThan(25.5);
  });
});

const baseCycle: CycleInput = { Te: -10, Tc: 35, superheat: 0, subcool: 0, etaIs: 1, etaMotor: 1, architecture: 'gravidade', capacity: 100 };

describe('Ciclo frigorífico', () => {
  it('conservação de energia em todas as arquiteturas', () => {
    for (const a of ARCHITECTURES) {
      const r = computeCycle({ ...baseCycle, etaIs: 0.75, superheat: 3, subcool: 2, architecture: a.id });
      expect(r.errors).toEqual([]);
      expect(r.balanceError).toBeLessThan(1e-6);
      expect(r.COP).toBeGreaterThan(0);
      expect(r.COP).toBeLessThan(r.COPcarnot);
    }
  });
  it('COP ideal dentro de faixa de literatura (−10/35 °C, isentrópico ≈ 4,8)', () => {
    const r = computeCycle(baseCycle);
    expect(r.COP).toBeGreaterThan(4.6);
    expect(r.COP).toBeLessThan(5.0);
    expect(r.Tdis).toBeGreaterThan(90); // amônia tem descarga quente
  });
  it('COP cai com evaporação mais baixa e condensação mais alta', () => {
    const a = computeCycle(baseCycle).COP;
    expect(computeCycle({ ...baseCycle, Te: -30 }).COP).toBeLessThan(a);
    expect(computeCycle({ ...baseCycle, Tc: 45 }).COP).toBeLessThan(a);
  });
  it('duplo estágio melhora o COP em grande relação de pressão', () => {
    const one = computeCycle({ ...baseCycle, Te: -40, etaIs: 0.75 });
    const two = computeCycle({ ...baseCycle, Te: -40, etaIs: 0.75, architecture: 'duplo-estagio' });
    expect(two.COP).toBeGreaterThan(one.COP);
    expect(Math.max(two.Tdis, two.Tdis2!)).toBeLessThan(one.Tdis);
  });
  it('rejeita combinações fisicamente impossíveis', () => {
    expect(computeCycle({ ...baseCycle, Te: 30, Tc: 35 }).errors.length).toBeGreaterThan(0);
    expect(computeCycle({ ...baseCycle, Te: -80 }).errors.length).toBeGreaterThan(0);
    expect(computeCycle({ ...baseCycle, etaIs: 1.2 }).errors.length).toBeGreaterThan(0);
  });
  it('pressões compatíveis com as temperaturas', () => {
    const r = computeCycle(baseCycle);
    const s1 = r.states.find((s) => s.id === '1')!, s2 = r.states.find((s) => s.id === '2')!;
    expect(s1.P).toBeCloseTo(satT(-10).P, 3);
    expect(s2.P).toBeCloseTo(satT(35).P, 3);
    expect(s2.P).toBeGreaterThan(s1.P);
  });
});

describe('Cargas térmicas', () => {
  it('mais passagens pela porta nunca reduzem a infiltração', () => {
    const p = baseProject();
    let prev = -1;
    for (const n of [0, 2, 5, 10, 20, 40]) {
      p.doors[0].passagesPerHour = n;
      const q = computeLoads(p).items.find((i) => i.key === 'infiltracao')!.kWhDay;
      expect(q).toBeGreaterThanOrEqual(prev);
      prev = q;
    }
  });
  it('porta maior e maior diferença de temperatura aumentam a infiltração', () => {
    const d = makeDoor();
    const a = doorInfiltration(d, 2, 0.85, 0.9).q;
    expect(doorInfiltration({ ...d, width: 3 }, 2, 0.85, 0.9).q).toBeGreaterThan(a);
    expect(doorInfiltration({ ...d, adjacentT: 35 }, 2, 0.85, 0.9).q).toBeGreaterThan(a);
    expect(doorInfiltration({ ...d, protection: 'nenhuma' }, 2, 0.85, 0.9).q).toBeGreaterThan(a);
  });
  it('isolamento mais espesso reduz a transmissão', () => {
    const p = baseProject();
    const t = (thk: number) => { p.envelope.wallThk = thk; p.envelope.roofThk = thk; return computeLoads(p).items.find((i) => i.key === 'transmissao')!.kWhDay; };
    expect(t(150)).toBeLessThan(t(100));
    expect(t(200)).toBeLessThan(t(150));
  });
  it('transmissão responde a área e volume', () => {
    const p = baseProject();
    const a = computeLoads(p);
    p.room.length *= 2;
    const b = computeLoads(p);
    expect(b.geometry.volume).toBeCloseTo(a.geometry.volume * 2, 6);
    expect(b.items[0].kWhDay).toBeGreaterThan(a.items[0].kWhDay * 1.4);
  });
  it('modo por área + altura gera volume coerente', () => {
    const p = baseProject();
    p.room.areaMode = 'area'; p.room.area = 300; p.room.aspect = 2; p.room.height = 5;
    const g = computeLoads(p).geometry;
    expect(g.floor).toBeCloseTo(300, 6);
    expect(g.volume).toBeCloseTo(1500, 6);
    expect(g.L / g.W).toBeCloseTo(2, 6);
  });
  it('congelamento exige mais energia que resfriamento da mesma massa', () => {
    const p = baseProject();
    p.product.Tenter = 5; p.product.Tfinal = 0;
    const cool = computeLoads(p).items.find((i) => i.key === 'produto')!.kWhDay;
    p.product.Tfinal = -18;
    const freeze = computeLoads(p).items.find((i) => i.key === 'produto')!.kWhDay;
    expect(freeze).toBeGreaterThan(cool * 5);
    // produto que já entra congelado não recebe calor latente
    p.product.Tenter = -10; p.product.Tfinal = -20;
    const frozen = computeLoads(p).items.find((i) => i.key === 'produto')!.kWhDay;
    expect(frozen).toBeLessThan(cool * 2.5);
  });
  it('temperatura interna mais baixa aumenta a carga', () => {
    const p = baseProject();
    const a = computeLoads(p).requiredKW;
    p.room.Tin = -5;
    expect(computeLoads(p).requiredKW).toBeGreaterThan(a);
  });
  it('faixa: baixo ≤ nominal ≤ alto', () => {
    for (const d of DEMOS) {
      const e = evaluate(d.build());
      expect(e.loads.baixo.requiredKW).toBeLessThanOrEqual(e.loads.nominal.requiredKW + 1e-9);
      expect(e.loads.nominal.requiredKW).toBeLessThanOrEqual(e.loads.alto.requiredKW + 1e-9);
      expect(e.range[0]).toBeLessThan(e.range[1]);
    }
  });
  it('sem dupla contagem: soma dos itens = total', () => {
    const r = computeLoads(baseProject());
    expect(r.items.reduce((a, i) => a + i.kWhDay, 0)).toBeCloseTo(r.totalKWhDay, 9);
    expect(new Set(r.items.map((i) => i.key)).size).toBe(r.items.length);
  });
});

describe('Avaliação integrada e energia', () => {
  it('todas as aplicações e demos produzem resultados finitos e positivos', () => {
    for (const a of APPLICATIONS) {
      const e = evaluate(projectFor(a.id));
      expect(e.cycle.errors).toEqual([]);
      expect(Number.isFinite(e.energy.kWhYear)).toBe(true);
      expect(e.loads.nominal.requiredKW).toBeGreaterThan(0);
    }
  });
  it('consumo coerente: energia elétrica < carga térmica (COP > 1) e custo = kWh × tarifa', () => {
    const p = baseProject();
    const e = evaluate(p);
    expect(e.energy.kWhDay).toBeLessThan(e.loads.nominal.totalKWhDay);
    expect(e.energy.costYear).toBeCloseTo(e.energy.kWhYear * p.finance.tariff, 6);
  });
  it('melhor isolamento reduz consumo; comparação sem investimento não gera payback', () => {
    const a = baseProject();
    const b = structuredClone(a); b.envelope.wallThk = 200; b.envelope.roofThk = 200;
    const c = compare(a, evaluate(a), b, evaluate(b));
    expect(c.dKWh).toBeGreaterThan(0);
    expect(c.payback).toBeNull();
    b.finance.investment = 50000;
    expect(compare(a, evaluate(a), b, evaluate(b)).payback).toBeGreaterThan(0);
  });
  it('conclusão sobre portas só aparece quando sustentada', () => {
    const p = baseProject();
    p.doors = [];
    expect(evaluate(p).insights.some((i) => i.includes('portas'))).toBe(false);
    p.doors = [makeDoor({ passagesPerHour: 60, hoursPerDay: 20, protection: 'nenhuma', width: 3, height: 3.5 })];
    p.product.dailyMass = 0;
    expect(evaluate(p).insights.some((i) => i.includes('portas'))).toBe(true);
  });
  it('sensibilidade retorna efeitos com sinal físico', () => {
    const s = sensitivity(baseProject());
    const tout = s.find((x) => x.label.startsWith('Temperatura externa'))!;
    expect(tout.high).toBeGreaterThan(0);
    expect(tout.low).toBeLessThan(0);
  });
});
