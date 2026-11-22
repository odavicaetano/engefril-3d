import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { readCad } from './read';
import { detectCad, unitGuess } from './model';
import { recognize, suggestCategory, type Category } from './recognize';
import { applyImport } from './apply';
import { DEMOS } from '../data/scenarios';
import { evaluate } from '../engine/analysis';
import { buildTechnicalReport } from '../report/technical';

const WASM = './node_modules/@mlightcad/libredwg-web/wasm';
const fx = (f: string) => new Uint8Array(readFileSync(`test/fixtures/cad/${f}`));
const read = (f: string, as = f) => readCad(fx(f), as, WASM);
const autoMap = (m: Awaited<ReturnType<typeof read>>) => Object.fromEntries(m.layers.map((l) => [l.name, suggestCategory(l.name, m.entities.filter((e) => e.layer === l.name)).cat])) as Record<string, Category>;

describe('Detecção de formato por conteúdo', () => {
  it('DWG por assinatura e versão', () => {
    const d = detectCad('planta.dwg', fx('sample_2018.dwg'));
    expect(d).toMatchObject({ ok: true, format: 'dwg', sourceFormat: 'dwg', version: 'AC1032' });
  });
  it('BAK com DWG válido é tratado como backup', () => {
    const d = detectCad('planta.bak', fx('sample_2000.dwg'));
    expect(d).toMatchObject({ ok: true, format: 'bak', sourceFormat: 'dwg', version: 'AC1015' });
    expect(d.message).toMatch(/Backup do AutoCAD/);
  });
  it('BAK que não é CAD recebe erro claro', () => {
    const d = detectCad('nao-cad.bak', fx('nao-cad.bak'));
    expect(d.ok).toBe(false);
    expect(d.message).toMatch(/não contém um desenho AutoCAD/);
  });
  it('extensão renomeada não é conversão válida', () => {
    const d = detectCad('foto.dwg', new TextEncoder().encode('%PDF-1.7 qualquer conteúdo'));
    expect(d.ok).toBe(false);
    expect(d.message).toMatch(/assinatura DWG\/DXF ausente/);
  });
  it('DWT/DWS são recusados com orientação', () => {
    expect(detectCad('modelo.dwt', fx('sample_2018.dwg')).ok).toBe(false);
  });
});

describe('Leitura DWG (LibreDWG/WASM)', () => {
  it('DWG 2D simples: geometria, camadas, unidades e extensão verificáveis', async () => {
    for (const f of ['sample_2000.dwg', 'sample_2018.dwg']) {
      const m = await read(f);
      expect(m.sourceFormat).toBe('dwg');
      expect(m.entities.length).toBeGreaterThanOrEqual(6);
      expect(m.layers.length).toBeGreaterThan(0);
      expect(unitGuess(m)).toMatchObject({ unit: 'mm', confident: true });
      const w = m.extents.max[0] - m.extents.min[0];
      expect(w).toBeGreaterThan(200); expect(w).toBeLessThan(300); // extensão conhecida do arquivo de exemplo (~270 mm)
    }
  });
  it('DWG 3D com blocos: expansão de INSERT e aviso de geometria 3D', async () => {
    const m = await read('example_2018.dwg');
    expect(m.has3d).toBe(true);
    expect(m.warnings.join(' ')).toMatch(/geometria 3D/);
    expect(m.entities.some((e) => e.block)).toBe(true); // conteúdo de blocos expandido
    expect(m.blocks.length).toBeGreaterThan(0);
  });
  it('BAK contendo DWG é lido como DWG', async () => {
    const m = await read('sample_2000.dwg', 'copia.bak');
    expect(m.format).toBe('bak');
    expect(m.entities.length).toBeGreaterThan(0);
  });
  it('DWG truncado/corrompido falha com erro, sem travar', async () => {
    const bytes = fx('example_2018.dwg').slice(0, 2000);
    await expect(readCad(bytes, 'quebrado.dwg', WASM)).rejects.toThrow();
  });
});

describe('Leitura DXF e reconhecimento', () => {
  it('câmara retangular em mm: dimensões, parede, portas e indício de equipamento', async () => {
    const m = await read('camara-mm.dxf');
    const u = unitGuess(m);
    expect(u).toMatchObject({ unit: 'mm', toM: 0.001, confident: true });
    const map = autoMap(m);
    expect(map['PAREDE-INT']).toBe('parede');
    expect(map['PORTA']).toBe('porta');
    const rec = recognize(m, u.toM, map, new Set(m.layers.map((l) => l.name)));
    const room = rec.rooms[0];
    expect(room.lengthM).toBeCloseTo(20, 6);
    expect(room.widthM).toBeCloseTo(12, 6);
    expect(room.wallThicknessM).toBeCloseTo(0.1, 6);
    expect(room.panelMm).toBe(100);
    const front = rec.doors.find((d) => d.wall === 'frente')!;
    expect(front.widthM).toBeCloseTo(1.5, 6);
    expect(front.position).toBeCloseTo(5.75 / 20, 6);
    const right = rec.doors.find((d) => d.wall === 'direita')!;
    expect(right.type).toBe('giratoria');
    expect(right.widthM).toBeCloseTo(1.2, 6);
    // equipamento: apenas indício para revisão, nunca convertido silenciosamente
    expect(rec.hints).toHaveLength(1);
    expect(rec.hints[0].status).toBe('revisar');
    expect(rec.duplicates).toBe(1);
  });
  it('unidade não declarada é estimada e sinalizada para confirmação', async () => {
    const m = await read('camara-m-sem-unidade.dxf');
    expect(unitGuess(m)).toMatchObject({ unit: 'm', confident: false });
    const rec = recognize(m, 1, { CAMARA: 'camara', '0': 'referencia' }, new Set(['CAMARA']));
    expect(rec.rooms[0].lengthM).toBeCloseTo(30, 6);
    expect(rec.rooms[0].status).toBe('reconhecido');
  });
  it('a mesma câmara em escala errada (mm lido como m) sai da faixa plausível', async () => {
    const m = await read('camara-mm.dxf');
    const rec = recognize(m, 1, autoMap(m), new Set(m.layers.map((l) => l.name)));
    expect(rec.rooms).toHaveLength(0);
    expect(rec.notes.join(' ')).toMatch(/fora da faixa plausível/);
  });
  it('DXF 3D é identificado', async () => {
    const m = await read('faces-3d.dxf');
    expect(m.has3d).toBe(true);
  });
  it('Xref ausente gera aviso', async () => {
    const m = await read('xref-ausente.dxf');
    expect(m.warnings.join(' ')).toMatch(/Xref.*PLANTA-BASE/);
  });
  it('DXF corrompido falha com erro claro', async () => {
    await expect(read('corrompido.dxf')).rejects.toThrow(/corrompido|vazio/);
  });
  it('seleção de camadas restringe o reconhecimento', async () => {
    const m = await read('camara-mm.dxf');
    const rec = recognize(m, 0.001, autoMap(m), new Set(['TEXTO']));
    expect(rec.rooms).toHaveLength(0);
  });
});

describe('Aplicação da importação', () => {
  it('extrusão com altura informada, sem destruir o cenário original, e uso no PDF', async () => {
    const m = await read('camara-mm.dxf');
    const map = autoMap(m);
    const layers = m.layers.map((l) => l.name);
    const rec = recognize(m, 0.001, map, new Set(layers));
    const original = DEMOS[0].build();
    const snapshot = JSON.stringify(original);
    const out = applyImport(original, { model: m, unit: 'mm', toM: 0.001, rotationDeg: 0, room: rec.rooms[0], heightM: 7.5, doors: rec.doors, replaceDoors: true, applyPanel: true, layers, mapping: map, confirmDims: true });
    expect(JSON.stringify(original)).toBe(snapshot); // não destrutivo
    expect(out.room).toMatchObject({ length: 20, width: 12, height: 7.5, areaMode: 'dims' });
    expect(out.envelope.wallThk).toBe(100);
    expect(out.doors).toHaveLength(2);
    expect(out.cadImport?.provenance.height).toMatch(/usuário/);
    expect(out.cadImport!.ref.length).toBeGreaterThan(16);
    // o contorno interno da câmara fica em [0, L] × [-W/2, W/2]
    const xs = out.cadImport!.ref.filter((_, i) => i % 2 === 0), zs = out.cadImport!.ref.filter((_, i) => i % 2 === 1);
    expect(Math.min(...xs)).toBeGreaterThan(-4); expect(Math.max(...xs)).toBeLessThan(20.5);
    expect(Math.max(...zs)).toBeLessThanOrEqual(6.2); expect(Math.min(...zs)).toBeGreaterThanOrEqual(-6.2);
    const ev = evaluate(out);
    expect(ev.loads.nominal.geometry.volume).toBeCloseTo(20 * 12 * 7.5, 6);
    const txt = buildTechnicalReport(out, { orientation: 'auto', revision: 'R0', compress: false }).output();
    expect(txt).toContain('camara-mm.dxf');
  });
});
