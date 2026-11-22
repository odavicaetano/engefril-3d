/**
 * Reconhecimento assistido: camadas → categorias, contornos de câmara, espessura de parede, portas e indícios de
 * equipamentos. Tudo é sugestão com grau de confiança; nada vira equipamento sem confirmação do usuário.
 */
import type { CadEntity, CadModel, Pt } from './model';
import type { Wall } from '../engine/types';
import { PANEL_THICKNESSES } from '../data/materials';

export type Category = 'camara' | 'parede' | 'porta' | 'tubulacao' | 'equipamento' | 'cota' | 'texto' | 'referencia' | 'ignorar';
export const CATEGORIES: { id: Category; label: string }[] = [
  { id: 'camara', label: 'Câmaras (contornos)' }, { id: 'parede', label: 'Paredes / painéis' }, { id: 'porta', label: 'Portas e aberturas' },
  { id: 'tubulacao', label: 'Tubulações' }, { id: 'equipamento', label: 'Equipamentos' }, { id: 'cota', label: 'Cotas' }, { id: 'texto', label: 'Textos' },
  { id: 'referencia', label: 'Referência 2D (sem conversão)' }, { id: 'ignorar', label: 'Ignorar' },
];
export type Status = 'reconhecido' | 'revisar' | 'nao-suportado' | 'referencia';
export const STATUS_LABEL: Record<Status, string> = { reconhecido: 'Reconhecido', revisar: 'Precisa de revisão', 'nao-suportado': 'Não suportado', referencia: 'Referência 2D' };

const KEYWORDS: [Category, RegExp][] = [
  ['camara', /C[ÂA]MARA|CAMERA|ROOM|FRIO|COLD|ESTOCAG|ANTE-?C/i], ['parede', /PAREDE|WALL|PAINEL|PANEL|ALVEN|MURO|ISOL/i], ['porta', /PORTA|DOOR|ABERT|PORTINH/i],
  ['tubulacao', /TUB|PIPE|LINHA|NH3|AMON|SUC[CÇ]|DESCARG|L[IÍ]QUID/i], ['equipamento', /EQUIP|EVAP|COMPR|CONDENS|BOMBA|PUMP|VALV|SEPARA|RESERV|MECH|MEC/i],
  ['cota', /COTA|DIM/i], ['texto', /TEXT|TXT|ANOT|NOTE/i],
];
/** Sugestão de categoria por nome de camada (pista, não prova). */
export function suggestCategory(layer: string, ents: CadEntity[]): { cat: Category; confidence: number } {
  for (const [cat, re] of KEYWORDS) if (re.test(layer)) return { cat, confidence: 0.75 };
  const types = new Set(ents.map((e) => e.geo.kind));
  if (types.size && [...types].every((t) => t === 'dim')) return { cat: 'cota', confidence: 0.9 };
  if (types.size && [...types].every((t) => t === 'text')) return { cat: 'texto', confidence: 0.9 };
  return { cat: 'referencia', confidence: 0.3 };
}

export interface Rect { id: string; center: Pt; angle: number; a: number; b: number; corners: Pt[]; layer: string; source: string } // a: lado ao longo de angle, b: perpendicular (unidades do desenho)
export interface RoomCandidate { rect: Rect; areaM2: number; lengthM: number; widthM: number; confidence: number; status: Status; reasons: string[]; wallThicknessM?: number; panelMm?: number }
export interface DoorCandidate { id: string; wall: Wall; position: number; widthM: number; type: 'giratoria' | 'correr'; confidence: number; status: Status; source: string }
export interface Hint { id: string; label: string; kind: string; p: Pt; layer: string; status: Status; confidence: number }
export interface Recognition { rooms: RoomCandidate[]; doors: DoorCandidate[]; hints: Hint[]; duplicates: number; danglingEnds: number; notes: string[] }

const dist = (a: Pt, b: Pt) => Math.hypot(a[0] - b[0], a[1] - b[1]);
const norm = (a: number) => { let x = a % Math.PI; if (x < 0) x += Math.PI; return x; };

/** Reduz polígono a vértices de canto e verifica se é retângulo (ângulos retos). */
function asRect(pts: Pt[], tol: number, layer: string, source: string, id: string): Rect | null {
  let p = pts.slice();
  if (p.length > 1 && dist(p[0], p[p.length - 1]) < tol) p.pop();
  const corners: Pt[] = [];
  for (let i = 0; i < p.length; i++) {
    const a = p[(i - 1 + p.length) % p.length], b = p[i], c = p[(i + 1) % p.length];
    const cross = (b[0] - a[0]) * (c[1] - b[1]) - (b[1] - a[1]) * (c[0] - b[0]);
    if (Math.abs(cross) > tol * Math.max(dist(a, b), dist(b, c))) corners.push(b);
  }
  if (corners.length !== 4) return null;
  const e = [0, 1, 2, 3].map((i) => [corners[(i + 1) % 4][0] - corners[i][0], corners[(i + 1) % 4][1] - corners[i][1]]);
  for (let i = 0; i < 4; i++) {
    const u = e[i], v = e[(i + 1) % 4];
    const cos = (u[0] * v[0] + u[1] * v[1]) / (Math.hypot(u[0], u[1]) * Math.hypot(v[0], v[1]) || 1);
    if (Math.abs(cos) > 0.02) return null; // não é ângulo reto
  }
  const a = Math.hypot(e[0][0], e[0][1]), b = Math.hypot(e[1][0], e[1][1]);
  const center: Pt = [(corners[0][0] + corners[2][0]) / 2, (corners[0][1] + corners[2][1]) / 2];
  return { id, center, angle: norm(Math.atan2(e[0][1], e[0][0])), a, b, corners, layer, source };
}

/** Retângulos formados por 4 linhas encadeadas (contornos desenhados com LINE). */
function rectsFromLines(lines: CadEntity[], tol: number): Rect[] {
  const key = (p: Pt) => `${Math.round(p[0] / tol)}:${Math.round(p[1] / tol)}`;
  const adj = new Map<string, { p: Pt; e: number[] }>();
  lines.forEach((l, i) => {
    if (l.geo.kind !== 'line') return;
    for (const p of [l.geo.a, l.geo.b]) { const k = key(p); if (!adj.has(k)) adj.set(k, { p, e: [] }); adj.get(k)!.e.push(i); }
  });
  const seen = new Set<number>(), out: Rect[] = [];
  lines.forEach((l, i) => {
    if (seen.has(i) || l.geo.kind !== 'line') return;
    // percorre a cadeia a partir de i
    const chain: Pt[] = [l.geo.a];
    let cur = i, at = l.geo.b, steps = 0;
    const used = [i];
    while (steps++ < 8) {
      chain.push(at);
      const node = adj.get(key(at));
      if (!node || node.e.length !== 2) break;
      const nxt = node.e.find((x) => x !== cur)!;
      if (nxt === i) { used.forEach((u) => seen.add(u)); const r = asRect(chain, tol, l.layer, 'linhas encadeadas', `L${i}`); if (r) out.push(r); break; }
      const g = lines[nxt].geo; if (g.kind !== 'line') break;
      at = dist(g.a, at) < tol * 1.5 ? g.b : g.a;
      cur = nxt; used.push(nxt);
    }
  });
  return out;
}

export function recognize(model: CadModel, toM: number, mapping: Record<string, Category>, selectedLayers: Set<string>): Recognition {
  const tol = Math.max(1e-6, 0.005 / toM); // 5 mm no desenho
  const use = (e: CadEntity) => selectedLayers.has(e.layer) && mapping[e.layer] !== 'ignorar';
  const ents = model.entities.filter(use);
  const notes: string[] = [];
  // ---- retângulos (câmaras e faces de parede)
  const rects: Rect[] = [];
  ents.forEach((e) => { if (e.geo.kind === 'poly' && e.geo.closed && !e.block) { const r = asRect(e.geo.pts, tol, e.layer, `polilinha fechada (${e.type})`, `P${e.id}`); if (r) rects.push(r); } });
  rects.push(...rectsFromLines(ents.filter((e) => e.geo.kind === 'line' && !e.block && ['camara', 'parede', 'referencia'].includes(mapping[e.layer])), tol));
  const plausible = (r: Rect) => { const a = r.a * toM, b = r.b * toM; return a >= 1.5 && b >= 1.5 && a <= 400 && b <= 400; };
  const cand = rects.filter(plausible);
  // contornos concêntricos: o interno é a câmara, a diferença é a espessura da parede
  const rooms: RoomCandidate[] = [];
  const used = new Set<string>();
  cand.sort((x, y) => x.a * x.b - y.a * y.b);
  for (const r of cand) {
    if (used.has(r.id)) continue;
    const outer = cand.find((o) => o !== r && !used.has(o.id) && dist(o.center, r.center) < tol * 4 && Math.abs(norm(o.angle - r.angle)) < 0.01 && o.a > r.a && o.b > r.b && Math.abs((o.a - r.a) - (o.b - r.b)) < tol * 4 && (o.a - r.a) * toM / 2 <= 0.4);
    const reasons: string[] = [`Retângulo fechado (${r.source}) na camada "${r.layer}".`];
    let conf = 0.45;
    const cat = mapping[r.layer];
    if (cat === 'camara') { conf += 0.3; reasons.push('Camada mapeada como câmara.'); }
    else if (cat === 'parede') { conf += 0.15; reasons.push('Camada mapeada como parede.'); }
    let wallThicknessM: number | undefined, panelMm: number | undefined;
    if (outer) {
      used.add(outer.id);
      wallThicknessM = ((outer.a - r.a) * toM) / 2;
      panelMm = PANEL_THICKNESSES.reduce((best, t) => (Math.abs(t - wallThicknessM! * 1000) < Math.abs(best - wallThicknessM! * 1000) ? t : best), PANEL_THICKNESSES[0]);
      conf += 0.2; reasons.push(`Contorno externo concêntrico: parede de ${(wallThicknessM * 1000).toFixed(0)} mm (painel padrão mais próximo: ${panelMm} mm).`);
    }
    used.add(r.id);
    const lengthM = Math.max(r.a, r.b) * toM, widthM = Math.min(r.a, r.b) * toM;
    conf = Math.min(0.95, conf);
    rooms.push({ rect: r, areaM2: lengthM * widthM, lengthM, widthM, confidence: conf, status: conf >= 0.7 ? 'reconhecido' : 'revisar', reasons, wallThicknessM, panelMm });
  }
  rooms.sort((a, b) => b.confidence - a.confidence || b.areaM2 - a.areaM2);
  if (!rooms.length) notes.push('Nenhum contorno retangular fechado foi encontrado nas camadas selecionadas. A planta pode ser importada como referência 2D e as dimensões informadas manualmente.');
  if (rects.length > cand.length) notes.push(`${rects.length - cand.length} retângulo(s) fora da faixa plausível para câmaras (1,5 a 400 m por lado) foram desconsiderados.`);

  // ---- portas (em relação à câmara mais provável)
  const doors: DoorCandidate[] = [];
  const room = rooms[0];
  if (room) {
    const R = room.rect;
    const ux: Pt = [Math.cos(R.angle), Math.sin(R.angle)], uy: Pt = [-ux[1], ux[0]];
    const local = (p: Pt): Pt => { const d: Pt = [p[0] - R.center[0], p[1] - R.center[1]]; return [d[0] * ux[0] + d[1] * ux[1], d[0] * uy[0] + d[1] * uy[1]]; };
    const ha = R.a / 2, hb = R.b / 2, edgeTol = Math.max(tol * 10, ((room.wallThicknessM ?? 0.25) / toM) * 1.6);
    const onEdge = (q: Pt): { wall: Wall; u: number } | null => {
      // eixo a → comprimento (x da câmara) se a >= b; senão troca
      const swap = R.b > R.a;
      const X = swap ? q[1] : q[0], Y = swap ? -q[0] : q[1], HX = swap ? hb : ha, HY = swap ? ha : hb;
      if (Math.abs(X) > HX + edgeTol || Math.abs(Y) > HY + edgeTol) return null;
      const dists: [Wall, number, number][] = [['frente', Math.abs(Y + HY), (X + HX) / (2 * HX)], ['fundo', Math.abs(Y - HY), (HX - X) / (2 * HX)], ['esquerda', Math.abs(X + HX), (Y + HY) / (2 * HY)], ['direita', Math.abs(X - HX), (HY - Y) / (2 * HY)]];
      const best = dists.sort((a, b) => a[1] - b[1])[0];
      return best[1] <= edgeTol ? { wall: best[0], u: Math.min(1, Math.max(0, best[2])) } : null;
    };
    let k = 0;
    for (const e of ents) {
      const g = e.geo;
      if (g.kind === 'arc' && !e.block) {
        const rM = g.r * toM; if (rM < 0.5 || rM > 6) continue;
        const sweep = Math.abs(norm(g.a1 - g.a0 + Math.PI) - Math.PI);
        if (sweep < 1.2 || sweep > 1.95) continue; // folha de porta ~90°
        const hit = onEdge(local(g.c));
        if (hit) {
          const len = hit.wall === 'frente' || hit.wall === 'fundo' ? room.lengthM : room.widthM;
          // a dobradiça fica no centro do arco; o vão ocupa r a partir dela
          const pos = Math.min(1, Math.max(0, hit.u + (rM / 2) / len * (hit.u > 0.5 ? -1 : 1)));
          doors.push({ id: `D${k++}`, wall: hit.wall, position: pos, widthM: rM, type: 'giratoria', confidence: mapping[e.layer] === 'porta' ? 0.8 : 0.55, status: mapping[e.layer] === 'porta' ? 'reconhecido' : 'revisar', source: `arco de abertura na camada "${e.layer}"` });
        }
      }
    }
    // vãos: pares de linhas paralelas curtas cruzando a parede (camada de portas)
    const doorLines = ents.filter((e) => e.geo.kind === 'line' && mapping[e.layer] === 'porta' && !e.block);
    const taken = new Set<number>();
    doorLines.forEach((a, i) => {
      if (taken.has(i) || a.geo.kind !== 'line') return;
      const la = dist(a.geo.a, a.geo.b) * toM; if (la < 0.5 || la > 8) return;
      const mid: Pt = [(a.geo.a[0] + a.geo.b[0]) / 2, (a.geo.a[1] + a.geo.b[1]) / 2];
      const hit = onEdge(local(mid)); if (!hit) return;
      doorLines.forEach((b, j) => { if (j !== i && b.geo.kind === 'line' && Math.abs(dist(b.geo.a, b.geo.b) * toM - la) < 0.02) { const mb: Pt = [(b.geo.a[0] + b.geo.b[0]) / 2, (b.geo.a[1] + b.geo.b[1]) / 2]; if (dist(mb, mid) * toM < 0.5) taken.add(j); } });
      taken.add(i);
      if (doors.some((d) => d.wall === hit.wall && Math.abs(d.position - hit.u) < 0.05)) return;
      doors.push({ id: `D${k++}`, wall: hit.wall, position: hit.u, widthM: la, type: 'correr', confidence: 0.7, status: 'reconhecido', source: `vão desenhado na camada "${a.layer}"` });
    });
    // blocos com nome de porta
    ents.filter((e) => e.geo.kind === 'insert' && /PORTA|DOOR/i.test(e.geo.name)).forEach((e) => {
      if (e.geo.kind !== 'insert') return;
      const hit = onEdge(local(e.geo.p));
      if (hit && !doors.some((d) => d.wall === hit.wall && Math.abs(d.position - hit.u) < 0.05)) doors.push({ id: `D${k++}`, wall: hit.wall, position: hit.u, widthM: 1, type: 'giratoria', confidence: 0.5, status: 'revisar', source: `bloco "${e.geo.name}" (largura não determinada: informe)` });
    });
  }

  // ---- indícios de equipamentos (somente referência; nunca convertidos automaticamente)
  const EQ: [RegExp, string][] = [[/EVAP/i, 'Evaporador'], [/COMPR/i, 'Compressor'], [/CONDENS/i, 'Condensador'], [/BOMBA|PUMP/i, 'Bomba'], [/VALV/i, 'Válvula'], [/SEPARA/i, 'Separador de líquido'], [/RESERV|RECIP/i, 'Reservatório']];
  const hints: Hint[] = [];
  ents.forEach((e) => {
    if (e.geo.kind !== 'insert' || e.block) return;
    const m = EQ.find(([re]) => re.test(e.geo.kind === 'insert' ? e.geo.name : ''));
    if (m) hints.push({ id: `H${e.id}`, label: `${m[1]}? (bloco "${e.geo.name}")`, kind: m[1], p: e.geo.p, layer: e.layer, status: 'revisar', confidence: mapping[e.layer] === 'equipamento' ? 0.6 : 0.4 });
  });

  // ---- qualidade do desenho: duplicatas e pontas soltas
  const segKey = (a: Pt, b: Pt) => { const r = (v: number) => Math.round(v / tol); const k1 = `${r(a[0])},${r(a[1])}`, k2 = `${r(b[0])},${r(b[1])}`; return k1 < k2 ? `${k1}|${k2}` : `${k2}|${k1}`; };
  const segs = new Map<string, number>(); const ends = new Map<string, number>();
  ents.forEach((e) => { if (e.geo.kind === 'line') { const k = segKey(e.geo.a, e.geo.b); segs.set(k, (segs.get(k) ?? 0) + 1); for (const p of [e.geo.a, e.geo.b]) { const kk = `${Math.round(p[0] / tol)},${Math.round(p[1] / tol)}`; ends.set(kk, (ends.get(kk) ?? 0) + 1); } } });
  const duplicates = [...segs.values()].reduce((a, v) => a + Math.max(0, v - 1), 0);
  const danglingEnds = [...ends.values()].filter((v) => v === 1).length;
  if (duplicates) notes.push(`${duplicates} linha(s) duplicada(s) sobrepostas detectadas (serão desenhadas uma vez).`);
  return { rooms, doors, hints, duplicates, danglingEnds, notes };
}

/** Converte um ponto do desenho para coordenadas da câmara (m): X ao longo do comprimento, Z da frente (+W/2) ao fundo (-W/2). */
export function toRoomCoords(room: RoomCandidate, toM: number) {
  const R = room.rect, swap = R.b > R.a;
  const ux: Pt = [Math.cos(R.angle), Math.sin(R.angle)], uy: Pt = [-ux[1], ux[0]];
  const HX = (swap ? R.b : R.a) / 2;
  return (p: Pt): [number, number] => {
    const d: Pt = [p[0] - R.center[0], p[1] - R.center[1]];
    const qa = d[0] * ux[0] + d[1] * ux[1], qb = d[0] * uy[0] + d[1] * uy[1];
    const X = swap ? qb : qa, Y = swap ? -qa : qb;
    return [(X + HX) * toM, -Y * toM];
  };
}
