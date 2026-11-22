import { it } from 'vitest';
import { writeFileSync, mkdirSync } from 'node:fs';
import { buildTechnicalReport } from './technical';
import { DEMOS, makeDoor, projectFor } from '../data/scenarios';

// Gera PDFs de amostra para revisão visual. Executar com: $env:PDF_OUT='pasta'; npx vitest run export-samples
const out = process.env.PDF_OUT;
it.skipIf(!out)('exporta amostras', () => {
  mkdirSync(out!, { recursive: true });
  const cd = projectFor('cd'); cd.doors.push(makeDoor({ wall: 'fundo', position: 0.3, count: 3 }), makeDoor({ wall: 'esquerda', type: 'giratoria', width: 1.2 }), makeDoor({ wall: 'direita', type: 'portinhola', width: 0.8, height: 0.8 }));
  const two = projectFor('tunel');
  const samples = { demo1: DEMOS[0].build(), cd6portas: cd, tunel: two, agua: DEMOS[4].build() };
  for (const [k, p] of Object.entries(samples)) {
    for (const o of ['auto', 'retrato'] as const) {
      const doc = buildTechnicalReport(p, { orientation: o, revision: 'R0', compare: k === 'demo1' ? { ...structuredClone(p), envelope: { ...p.envelope, wallThk: 150, roofThk: 150 } } : null });
      writeFileSync(`${out}/${k}-${o}.pdf`, Buffer.from(doc.output('arraybuffer')));
    }
  }
});
