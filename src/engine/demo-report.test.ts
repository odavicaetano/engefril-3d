import { it } from 'vitest';
import { evaluate } from './analysis';
import { DEMOS } from '../data/scenarios';

// Relatório de plausibilidade (não é asserção): imprime indicadores dos cenários de demonstração.
it('relatório dos cenários de demonstração', () => {
  for (const d of DEMOS) {
    const p = d.build();
    const e = evaluate(p);
    const g = e.loads.nominal.geometry;
    console.log(
      `${d.id.padEnd(12)} A=${g.floor.toFixed(0)}m² cap=${e.loads.nominal.requiredKW.toFixed(1)}kW [${e.range[0].toFixed(0)}–${e.range[1].toFixed(0)}] ` +
        `W/m³=${((e.loads.nominal.requiredKW * 1000) / g.volume).toFixed(1)} Te=${e.temps.Te.toFixed(1)} Tc=${e.temps.Tc.toFixed(1)} COP=${e.cycle.COP.toFixed(2)} ` +
        `kWh/ano=${e.energy.kWhYear.toFixed(0)} | ${e.breakdown.map((b) => `${b.key}:${(b.share * 100).toFixed(0)}%`).join(' ')}`,
    );
  }
});
