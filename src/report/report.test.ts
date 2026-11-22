import { describe, expect, it } from 'vitest';
import { buildTechnicalReport, equipmentTags } from './technical';
import { buildCommercialReport } from './pdf';
import { chooseScale } from './common';
import { DEMOS, makeDoor, projectFor } from '../data/scenarios';
import { evaluate } from '../engine/analysis';
import { computeLoads } from '../engine/loads';
import { computeLayout } from '../scene/layout';
import type { Project } from '../engine/types';
import type { Architecture } from '../engine/cycle';

const n = (v: number, d = 0) => v.toLocaleString('pt-BR', { minimumFractionDigits: d, maximumFractionDigits: d });

function build(p: Project, orientation: 'auto' | 'retrato' | 'paisagem' = 'auto', compare: Project | null = null) {
  const doc = buildTechnicalReport(p, { orientation, revision: 'R0', compare, compress: false, date: new Date(2026, 10, 22) });
  return { doc, txt: doc.output() as string, pages: doc.getNumberOfPages() };
}

/** Todas as páginas são A4 (retrato 210×297 ou paisagem 297×210). */
function allA4(doc: ReturnType<typeof buildTechnicalReport>) {
  for (let i = 1; i <= doc.getNumberOfPages(); i++) {
    doc.setPage(i);
    const w = Math.round(doc.internal.pageSize.getWidth()), h = Math.round(doc.internal.pageSize.getHeight());
    expect([w, h].sort((a, b) => a - b)).toEqual([210, 297]);
  }
}

const variants: [string, () => Project][] = [
  ...DEMOS.map((d) => [d.id, d.build] as [string, () => Project]),
  ['8 evaporadores (80 m)', () => { const p = projectFor('resfriamento'); p.room.length = 80; p.room.width = 30; return p; }],
  ['5 câmaras', () => { const p = projectFor('congelamento'); p.room.count = 5; return p; }],
  ['6 portas em 4 paredes', () => {
    const p = projectFor('cd');
    p.doors.push(makeDoor({ wall: 'fundo', position: 0.3, count: 3 }), makeDoor({ wall: 'esquerda', type: 'giratoria', width: 1.2 }), makeDoor({ wall: 'direita', type: 'portinhola', width: 0.8, height: 0.8 }));
    return p;
  }],
  ['sem portas', () => { const p = projectFor('resfriamento'); p.doors = []; return p; }],
  ['câmara pequena 4×3', () => { const p = projectFor('farmaceutica'); p.room = { ...p.room, length: 4, width: 3, height: 2.6 }; return p; }],
  ['água gelada com chiller', () => { const p = projectFor('agua-gelada'); p.process.strategy = 'chiller'; return p; }],
  ...(['dx', 'gravidade', 'duplo-estagio', 'indireto'] as Architecture[]).map((a) => [`arquitetura ${a}`, () => { const p = projectFor('congelamento'); p.system.architecture = a; return p; }] as [string, () => Project]),
];

describe('Relatório técnico A4', () => {
  for (const [name, mk] of variants) {
    it(`gera o documento completo: ${name}`, () => {
      const p = mk();
      const { doc, txt, pages } = build(p);
      allA4(doc);
      expect(pages).toBeGreaterThanOrEqual(10);
      expect(pages).toBeLessThan(40);
      const ev = evaluate(p);
      // números do documento = números do motor
      expect(txt).toContain(n(ev.loads.nominal.requiredKW, 1));
      expect(txt).toContain(n(ev.loads.nominal.totalKWhDay, 1));
      expect(txt).toContain('PRÉ-DIMENSIONAMENTO ORIENTATIVO'.normalize());
      // seções obrigatórias
      for (const s of ['Memorial descritivo', 'Memorial de c', 'Especifica', 'Quadro de dimensionamento', 'lise energ', 'Conclus', 'DIAGRAMA SIMPLIFICADO']) expect(txt).toContain(s);
      if (p.application !== 'agua-gelada') {
        const g = ev.loads.nominal.geometry;
        expect(txt).toContain(`C = ${n(g.L, 2)}`); // cota de comprimento no corte
        expect(txt).toContain(`L = ${n(g.W, 2)}`); // cota de largura no corte B-B
        expect(txt).toContain('CORTE A-A');
      }
      // todas as TAGs de equipamento aparecem
      const tags = equipmentTags(computeLayout(p));
      for (const id of Object.keys(tags).filter((k) => !k.startsWith('sensor'))) expect(txt).toContain(tags[id]);
    });
  }
  it('orientações retrato e paisagem mantêm A4', () => {
    for (const o of ['retrato', 'paisagem'] as const) {
      const { doc } = build(DEMOS[3].build(), o);
      allA4(doc);
      doc.setPage(1);
      expect(doc.internal.pageSize.getWidth() > doc.internal.pageSize.getHeight()).toBe(o === 'paisagem');
    }
  });
  it('comparação A × B entra no documento', () => {
    const a = DEMOS[0].build();
    const b = structuredClone(a); b.envelope.wallThk = 200;
    expect(build(a, 'auto', b).txt).toContain('A × B'.normalize());
  });
  it('escala escolhida sempre cabe na área', () => {
    for (const [ext, av] of [[[30, 20], [240, 120]], [[110, 60], [240, 120]], [[5, 3], [240, 120]]] as [[number, number], [number, number]][]) {
      const s = chooseScale(ext, av);
      expect((ext[0] * 1000) / s).toBeLessThanOrEqual(av[0]);
      expect((ext[1] * 1000) / s).toBeLessThanOrEqual(av[1]);
    }
  });
  it('memorial de transmissão confere com a carga calculada', () => {
    for (const d of DEMOS.slice(0, 4)) {
      const r = computeLoads(d.build());
      const m = r.memo!;
      const sum = m.surfaces.reduce((a, s) => a + s.W, 0) * m.bridge * m.n * 24 / 1000;
      expect(sum).toBeCloseTo(r.items.find((i) => i.key === 'transmissao')!.kWhDay, 6);
      const inf = m.doors.reduce((a, x) => a + x.q, 0) * m.n * 24;
      expect(inf).toBeCloseTo(r.items.find((i) => i.key === 'infiltracao')!.kWhDay, 6);
    }
  });
  it('seleção de seções renumera, cliente e classificação na capa, marcadores e metadados', () => {
    const p = DEMOS[0].build();
    const doc = buildTechnicalReport(p, { orientation: 'auto', revision: 'R2', compress: false, client: 'Cliente Exemplo', sections: ['calculo', 'conclusoes'] });
    const txt = doc.output() as string;
    expect(txt).toContain('1. Memorial de c');
    expect(txt).toContain('2. Conclus');
    expect(txt).not.toContain('Memorial descritivo');
    expect(txt).not.toContain('DIAGRAMA SIMPLIFICADO');
    expect(txt).toContain('Cliente Exemplo');
    expect(txt).toContain('Estudo preliminar');
    expect(txt).toContain('/Outlines'); // marcadores de navegação
    expect(txt).toContain('/Lang (pt-BR)');
    expect(txt).toContain('/Title (');
  });
  it('relatório comercial usa o mesmo kit: A4, capa, aviso e números do motor', () => {
    for (const o of ['retrato', 'paisagem'] as const) {
      const p = DEMOS[2].build();
      const doc = buildCommercialReport(p, null, { orientation: o, compress: false, client: 'ACME' });
      allA4(doc);
      const txt = doc.output() as string;
      expect(txt).toContain(n(evaluate(p).loads.nominal.requiredKW, 0));
      expect(txt).toContain('ESTUDO PRELIMINAR');
    }
  });
});
