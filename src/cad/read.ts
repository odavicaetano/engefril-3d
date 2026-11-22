/**
 * Leitura de DWG (GNU LibreDWG via WebAssembly, GPL-3.0) e DXF ASCII (dxf-parser, MIT), normalizadas para CadModel.
 * Roda no navegador (Web Worker) e no Node (testes). Blocos (INSERT) são expandidos com transformação até 4 níveis.
 */
import type { CadEntity, CadFormat, CadLayer, CadModel, Geo, Pt } from './model';
import { LIMITS } from './model';
import * as MODEL_REF from './model';

type Xf = { tx: number; ty: number; rot: number; sx: number; sy: number };
const ident: Xf = { tx: 0, ty: 0, rot: 0, sx: 1, sy: 1 };
const apply = (t: Xf, p: Pt): Pt => {
  const x = p[0] * t.sx, y = p[1] * t.sy, c = Math.cos(t.rot), s = Math.sin(t.rot);
  return [t.tx + x * c - y * s, t.ty + x * s + y * c];
};
const compose = (outer: Xf, inner: Xf): Xf => {
  const [tx, ty] = apply(outer, [inner.tx, inner.ty]);
  return { tx, ty, rot: outer.rot + inner.rot, sx: outer.sx * inner.sx, sy: outer.sy * inner.sy };
};
const xfGeo = (t: Xf, g: Geo): Geo => {
  const k = Math.sqrt(Math.abs(t.sx * t.sy));
  switch (g.kind) {
    case 'line': return { kind: 'line', a: apply(t, g.a), b: apply(t, g.b) };
    case 'poly': return { kind: 'poly', pts: g.pts.map((p) => apply(t, p)), closed: g.closed };
    case 'arc': return { kind: 'arc', c: apply(t, g.c), r: g.r * k, a0: g.a0 + t.rot, a1: g.a1 + t.rot };
    case 'circle': return { kind: 'circle', c: apply(t, g.c), r: g.r * k };
    case 'text': return { ...g, p: apply(t, g.p), h: g.h * k };
    case 'insert': return { ...g, p: apply(t, g.p) };
    case 'face3d': return { kind: 'face3d', pts: g.pts.map((p) => apply(t, p)) };
    case 'dim': return { ...g, p: apply(t, g.p) };
  }
};
/** Polilinha com bulges → pontos (arcos discretizados). */
function bulgePts(v: { x: number; y: number; bulge?: number }[], closed: boolean): Pt[] {
  const out: Pt[] = [];
  const n = v.length;
  for (let i = 0; i < n; i++) {
    const a = v[i], b = v[(i + 1) % n];
    out.push([a.x, a.y]);
    if (!closed && i === n - 1) break;
    const bulge = a.bulge ?? 0;
    if (Math.abs(bulge) > 1e-9) {
      const th = 4 * Math.atan(bulge), dx = b.x - a.x, dy = b.y - a.y, chord = Math.hypot(dx, dy);
      if (chord > 1e-12) {
        const r = chord / (2 * Math.sin(th / 2)), mx = (a.x + b.x) / 2, my = (a.y + b.y) / 2, h = r * Math.cos(th / 2);
        const cx = mx - (dy / chord) * h, cy = my + (dx / chord) * h;
        const a0 = Math.atan2(a.y - cy, a.x - cx), seg = Math.max(4, Math.ceil(Math.abs(th) / (Math.PI / 12)));
        for (let k = 1; k < seg; k++) { const ang = a0 + (th * k) / seg; out.push([cx + Math.abs(r) * Math.cos(ang), cy + Math.abs(r) * Math.sin(ang)]); }
      }
    }
  }
  return out;
}
const P = (o: any): Pt => [Number(o?.x ?? 0), Number(o?.y ?? 0)];

class Collector {
  entities: CadEntity[] = [];
  stats: Record<string, number> = {};
  unsupported: Record<string, number> = {};
  warnings = new Set<string>();
  layerCount = new Map<string, number>();
  has3d = false;
  private id = 0;
  push(type: string, layer: string, geo: Geo | null, block?: string) {
    this.stats[type] = (this.stats[type] ?? 0) + 1;
    if (!geo) { this.unsupported[type] = (this.unsupported[type] ?? 0) + 1; return; }
    if (this.entities.length >= LIMITS.maxEntities) { this.warnings.add(`Limite de ${LIMITS.maxEntities.toLocaleString('pt-BR')} entidades atingido: o restante foi ignorado.`); return; }
    this.layerCount.set(layer, (this.layerCount.get(layer) ?? 0) + 1);
    this.entities.push({ id: this.id++, type, layer, block, geo });
  }
}

// ---------------- DXF (dxf-parser)
function dxfGeo(e: any): Geo | null {
  switch (e.type) {
    case 'LINE': return e.vertices?.length >= 2 ? { kind: 'line', a: P(e.vertices[0]), b: P(e.vertices[1]) } : null;
    case 'LWPOLYLINE': case 'POLYLINE': {
      if (!e.vertices?.length) return null;
      if (e.is3dPolyline || e.isPolyfaceMesh || e.is3dPolygonMesh) return { kind: 'face3d', pts: e.vertices.map(P) };
      const closed = !!e.shape;
      return { kind: 'poly', pts: bulgePts(e.vertices, closed), closed };
    }
    case 'ARC': return { kind: 'arc', c: P(e.center), r: e.radius, a0: e.startAngle, a1: e.endAngle };
    case 'CIRCLE': return { kind: 'circle', c: P(e.center), r: e.radius };
    case 'TEXT': return { kind: 'text', p: P(e.startPoint ?? e.position), h: e.textHeight ?? 1, text: String(e.text ?? '') };
    case 'MTEXT': return { kind: 'text', p: P(e.position), h: e.height ?? 1, text: String(e.text ?? '').replace(/\\[A-Za-z][^;]*;|[{}]/g, '') };
    case 'DIMENSION': return { kind: 'dim', p: P(e.middleOfText ?? e.anchorPoint), text: String(e.text ?? e.actualMeasurement ?? '') };
    case '3DFACE': case 'SOLID': return { kind: 'face3d', pts: (e.vertices ?? e.points ?? []).map(P) };
    case 'SPLINE': { const pts = (e.fitPoints?.length ? e.fitPoints : e.controlPoints) ?? []; return pts.length > 1 ? { kind: 'poly', pts: pts.map(P), closed: !!e.closed } : null; }
    case 'ELLIPSE': {
      const c = P(e.center), mx = e.majorAxisEndPoint?.x ?? 1, my = e.majorAxisEndPoint?.y ?? 0, R = Math.hypot(mx, my), rot = Math.atan2(my, mx), ratio = e.axisRatio ?? 1;
      const a0 = e.startAngle ?? 0, a1 = e.endAngle ?? Math.PI * 2, n = 48, pts: Pt[] = [];
      for (let i = 0; i <= n; i++) { const t = a0 + ((a1 - a0) * i) / n, x = R * Math.cos(t), y = R * ratio * Math.sin(t); pts.push([c[0] + x * Math.cos(rot) - y * Math.sin(rot), c[1] + x * Math.sin(rot) + y * Math.cos(rot)]); }
      return { kind: 'poly', pts, closed: Math.abs(a1 - a0 - Math.PI * 2) < 1e-6 };
    }
    default: return null;
  }
}

export async function readDxf(text: string, fileName: string, format: CadFormat): Promise<CadModel> {
  const { default: DxfParser } = await import('dxf-parser');
  let dxf: any;
  try { dxf = new (DxfParser as any)().parseSync(text); } catch (e) { throw new Error(`DXF inválido ou corrompido: ${(e as Error).message}`); }
  if (!dxf || !Array.isArray(dxf.entities)) throw new Error('DXF inválido ou corrompido: seção ENTITIES ausente.');
  if (!dxf.entities.length) throw new Error('DXF sem entidades: arquivo vazio, truncado ou corrompido.');
  const col = new Collector();
  const blocks: Record<string, any> = dxf.blocks ?? {};
  const xrefs = Object.values(blocks).filter((b: any) => (b.type & 4) || b.xrefPath);
  xrefs.forEach((b: any) => col.warnings.add(`Referência externa (Xref) "${b.name}"${b.xrefPath ? ` → ${b.xrefPath}` : ''} não incluída no arquivo: o conteúdo dela não será importado. Envie o arquivo referenciado separadamente ou faça BIND no AutoCAD.`));
  const walk = (ents: any[], t: Xf, depth: number, block?: string) => {
    for (const e of ents) {
      const layer = String(e.layer ?? '0');
      if (e.type === 'INSERT') {
        const name = String(e.name ?? '');
        const ins: Xf = { tx: e.position?.x ?? 0, ty: e.position?.y ?? 0, rot: ((e.rotation ?? 0) * Math.PI) / 180, sx: e.xScale ?? 1, sy: e.yScale ?? 1 };
        const tt = compose(t, ins);
        col.push('INSERT', layer, { kind: 'insert', name, p: apply(t, [ins.tx, ins.ty]), rot: tt.rot, sx: tt.sx, sy: tt.sy }, block);
        const b = blocks[name];
        if (!b) col.warnings.add(`Bloco "${name}" referenciado mas não definido no arquivo.`);
        else if (depth >= LIMITS.maxBlockDepth) col.warnings.add(`Blocos aninhados além de ${LIMITS.maxBlockDepth} níveis foram ignorados.`);
        else {
          const bp: Xf = { tx: -(b.position?.x ?? 0), ty: -(b.position?.y ?? 0), rot: 0, sx: 1, sy: 1 };
          walk(b.entities ?? [], compose(tt, bp), depth + 1, block ?? name);
        }
        continue;
      }
      const g = dxfGeo(e);
      if (g?.kind === 'face3d') col.has3d = true;
      col.push(e.type, layer, g ? xfGeo(t, g) : null, block);
    }
  };
  walk(dxf.entities, ident, 0);
  const layerTable: Record<string, any> = dxf.tables?.layer?.layers ?? {};
  return finish(col, { fileName, format, sourceFormat: 'dxf', version: String(dxf.header?.$ACADVER ?? 'DXF'), insunits: Number(dxf.header?.$INSUNITS ?? 0), blocks: Object.keys(blocks).filter((b) => !b.startsWith('*')),
    layers: (name) => { const l = layerTable[name]; return l ? { color: l.colorIndex, off: l.visible === false, frozen: !!l.frozen } : {}; } });
}

// ---------------- DWG (LibreDWG)
function dwgGeo(e: any): Geo | null {
  switch (e.type) {
    case 'LINE': return { kind: 'line', a: P(e.startPoint), b: P(e.endPoint) };
    case 'LWPOLYLINE': { const closed = !!(e.flag & 1) || !!(e.flag & 512); return e.vertices?.length ? { kind: 'poly', pts: bulgePts(e.vertices, closed), closed } : null; }
    case 'POLYLINE2D': { const closed = !!(e.flag & 1); const vs = (e.vertices ?? []).map((v: any) => ({ x: v.x ?? v.point?.x ?? 0, y: v.y ?? v.point?.y ?? 0, bulge: v.bulge ?? 0 })); return vs.length ? { kind: 'poly', pts: bulgePts(vs, closed), closed } : null; }
    case 'POLYLINE3D': { const vs = (e.vertices ?? []).map((v: any) => [v.x ?? v.point?.x ?? 0, v.y ?? v.point?.y ?? 0] as Pt); return vs.length ? { kind: 'face3d', pts: vs } : null; }
    case 'ARC': return { kind: 'arc', c: P(e.center), r: e.radius, a0: e.startAngle, a1: e.endAngle };
    case 'CIRCLE': return { kind: 'circle', c: P(e.center), r: e.radius };
    case 'TEXT': case 'ATTRIB': case 'ATTDEF': return { kind: 'text', p: P(e.startPoint), h: e.textHeight ?? 1, text: String(e.text ?? '') };
    case 'MTEXT': return { kind: 'text', p: P(e.insertionPoint), h: e.textHeight ?? 1, text: String(e.text ?? '').replace(/\\[A-Za-z][^;]*;|[{}]/g, '') };
    case 'DIMENSION': return { kind: 'dim', p: P(e.textPoint), text: String(e.text || (e.measurement != null ? Number(e.measurement).toFixed(2) : '')) };
    case '3DFACE': return { kind: 'face3d', pts: [e.corner1, e.corner2, e.corner3, e.corner4].filter(Boolean).map(P) };
    case 'SOLID': return { kind: 'face3d', pts: [e.corner1, e.corner2, e.corner4, e.corner3].filter(Boolean).map(P) };
    case 'SPLINE': { const pts = (e.fitPoints?.length ? e.fitPoints : e.controlPoints) ?? []; return pts.length > 1 ? { kind: 'poly', pts: pts.map(P), closed: !!(e.flag & 1) } : null; }
    case 'ELLIPSE': return dxfGeo({ ...e, type: 'ELLIPSE' });
    default: return null;
  }
}

let libPromise: Promise<any> | null = null;
/**
 * Carrega o LibreDWG uma única vez. wasm: URL completa do arquivo .wasm (navegador, nome com hash do bundler)
 * ou pasta que contém libredwg-web.wasm (Node/testes).
 */
export function loadLibreDwg(wasm: string) {
  libPromise ??= import('@mlightcad/libredwg-web').then(async (m: any) => {
    const locateFile = (file: string) => (wasm.endsWith('.wasm') ? wasm : `${wasm}/${file}`);
    const instance = await m.createModule({ locateFile });
    return m.LibreDwg.createByWasmInstance(instance);
  });
  return libPromise;
}

export async function readDwg(bytes: Uint8Array, fileName: string, format: CadFormat, wasmDir: string): Promise<CadModel> {
  const lib = await loadLibreDwg(wasmDir);
  const buf = bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength);
  const ptr = lib.dwg_read_data(buf, 0 /* Dwg_File_Type.DWG */);
  if (!ptr) throw new Error('DWG não pôde ser lido (arquivo corrompido ou incompleto).');
  let db: any;
  try { db = lib.convert(ptr); } finally { try { lib.dwg_free(ptr); } catch { /* */ } }
  const ver = String(db.header?.ACADVER ?? '') || (new TextDecoder('latin1').decode(bytes.slice(0, 6)));
  if (!db.entities?.length && !db.tables?.LAYER?.entries?.length) throw new Error('DWG corrompido ou vazio: nenhuma entidade ou camada pôde ser lida.');
  const col = new Collector();
  const brs: any[] = db.tables?.BLOCK_RECORD?.entries ?? [];
  const blockMap = new Map(brs.map((b) => [b.name, b]));
  const proxies = (db.entities ?? []).filter((e: any) => /PROXY|ACAD_PROXY/i.test(e.type)).length;
  if (proxies) col.warnings.add(`${proxies} objeto(s) proxy (ex.: objetos AEC proprietários) não podem ser interpretados; converta-os em geometria simples no AutoCAD (EXPLODE/EXPORTTOAUTOCAD).`);
  brs.filter((b) => b.flags & 4).forEach((b) => col.warnings.add(`Referência externa (Xref) "${b.name}" não incluída no arquivo: o conteúdo dela não será importado.`));
  const walk = (ents: any[], t: Xf, depth: number, block?: string) => {
    for (const e of ents) {
      const layer = String(e.layer ?? '0');
      if (e.type === 'INSERT') {
        const name = String(e.name ?? '');
        const ins: Xf = { tx: e.insertionPoint?.x ?? 0, ty: e.insertionPoint?.y ?? 0, rot: e.rotation ?? 0, sx: e.xScale ?? 1, sy: e.yScale ?? 1 };
        const tt = compose(t, ins);
        col.push('INSERT', layer, { kind: 'insert', name, p: apply(t, [ins.tx, ins.ty]), rot: tt.rot, sx: tt.sx, sy: tt.sy }, block);
        const b = blockMap.get(name);
        if (!b) col.warnings.add(`Bloco "${name || '(sem nome)'}" referenciado mas não definido.`);
        else if (depth >= LIMITS.maxBlockDepth) col.warnings.add(`Blocos aninhados além de ${LIMITS.maxBlockDepth} níveis foram ignorados.`);
        else walk(b.entities ?? [], compose(tt, { tx: -(b.basePoint?.x ?? 0), ty: -(b.basePoint?.y ?? 0), rot: 0, sx: 1, sy: 1 }), depth + 1, block ?? name);
        continue;
      }
      if (e.type === '3DSOLID' || e.type === 'REGION' || e.type === 'BODY') { col.has3d = true; col.push(e.type, layer, null, block); continue; }
      const g = dwgGeo(e);
      if (g?.kind === 'face3d') col.has3d = true;
      col.push(e.type, layer, g ? xfGeo(t, g) : null, block);
    }
  };
  walk(db.entities ?? [], ident, 0);
  const layerEntries: any[] = db.tables?.LAYER?.entries ?? [];
  return finish(col, { fileName, format, sourceFormat: 'dwg', version: ver, insunits: Number(db.header?.INSUNITS ?? 0), blocks: brs.map((b) => b.name).filter((n: string) => !n.startsWith('*')),
    layers: (name) => { const l = layerEntries.find((x) => x.name === name); return l ? { color: l.colorIndex, off: !!l.off, frozen: !!l.frozen } : {}; },
    allLayers: layerEntries.map((l) => l.name) });
}

function finish(col: Collector, m: { fileName: string; format: CadFormat; sourceFormat: 'dwg' | 'dxf'; version: string; insunits: number; blocks: string[]; layers: (name: string) => Partial<CadLayer>; allLayers?: string[] }): CadModel {
  let minx = Infinity, miny = Infinity, maxx = -Infinity, maxy = -Infinity;
  const grow = (p: Pt) => { if (Number.isFinite(p[0]) && Number.isFinite(p[1])) { minx = Math.min(minx, p[0]); miny = Math.min(miny, p[1]); maxx = Math.max(maxx, p[0]); maxy = Math.max(maxy, p[1]); } };
  for (const e of col.entities) {
    const g = e.geo;
    if (g.kind === 'line') { grow(g.a); grow(g.b); }
    else if (g.kind === 'poly' || g.kind === 'face3d') g.pts.forEach(grow);
    else if (g.kind === 'arc' || g.kind === 'circle') { grow([g.c[0] - g.r, g.c[1] - g.r]); grow([g.c[0] + g.r, g.c[1] + g.r]); }
    else if (g.kind !== 'insert') grow(g.p);
  }
  if (!Number.isFinite(minx)) { minx = miny = 0; maxx = maxy = 1; }
  const names = new Set<string>([...(m.allLayers ?? []), ...col.layerCount.keys()]);
  const layers = [...names].map((name) => ({ name, count: col.layerCount.get(name) ?? 0, ...m.layers(name) })).sort((a, b) => b.count - a.count);
  const { DWG_VERSIONS } = MODEL_REF;
  const vName = DWG_VERSIONS[m.version] ?? (m.sourceFormat === 'dxf' ? 'DXF' : m.version);
  if (col.has3d) col.warnings.add('O desenho contém geometria 3D (faces, sólidos ou polilinhas 3D): ela será exibida como projeção em planta e usada apenas como referência.');
  const unsupportedTotal = Object.values(col.unsupported).reduce((a, b) => a + b, 0);
  if (unsupportedTotal) col.warnings.add(`${unsupportedTotal} entidade(s) de tipos não suportados foram ignoradas: ${Object.entries(col.unsupported).map(([k, v]) => `${k} (${v})`).join(', ')}.`);
  return {
    fileName: m.fileName, format: m.format, sourceFormat: m.sourceFormat, version: m.version, versionName: vName, insunits: m.insunits,
    extents: { min: [minx, miny], max: [maxx, maxy] }, layers, entities: col.entities, blocks: m.blocks, stats: col.stats, unsupported: col.unsupported, warnings: [...col.warnings], has3d: col.has3d,
  };
}

/** Ponto de entrada: detecta e lê o arquivo (DWG/BAK via LibreDWG, DXF via dxf-parser). */
export async function readCad(bytes: Uint8Array, fileName: string, wasmDir: string): Promise<CadModel> {
  const det = MODEL_REF.detectCad(fileName, bytes);
  if (!det.ok || !det.format || !det.sourceFormat) throw new Error(det.message);
  if (det.sourceFormat === 'dwg') return readDwg(bytes, fileName, det.format, wasmDir);
  return readDxf(new TextDecoder('utf-8').decode(bytes), fileName, det.format);
}
