/** Aplica a importação confirmada ao projeto, de forma não destrutiva (retorna um novo projeto). */
import type { CadImportRecord, Door, Project } from '../engine/types';
import type { CadModel, Pt } from './model';
import type { Category, DoorCandidate, RoomCandidate } from './recognize';
import { toRoomCoords } from './recognize';
import { makeDoor } from '../data/scenarios';

export interface ImportChoice {
  model: CadModel;
  unit: string; toM: number; rotationDeg: number;
  room: RoomCandidate | null;
  heightM: number;
  doors: DoorCandidate[]; // somente as confirmadas
  replaceDoors: boolean;
  applyPanel: boolean;
  layers: string[];
  mapping: Record<string, Category>;
  confirmDims: boolean;
}

const MAX_REF_SEGMENTS = 6000;

/** Segmentos de referência 2D (m, coordenadas da câmara) a partir das camadas importadas. */
export function referenceSegments(model: CadModel, layers: Set<string>, mapping: Record<string, Category>, map: (p: Pt) => [number, number]): number[] {
  const out: number[] = [];
  const seg = (a: Pt, b: Pt) => { if (out.length / 4 >= MAX_REF_SEGMENTS) return; const p = map(a), q = map(b); out.push(+p[0].toFixed(3), +p[1].toFixed(3), +q[0].toFixed(3), +q[1].toFixed(3)); };
  for (const e of model.entities) {
    if (!layers.has(e.layer) || mapping[e.layer] === 'ignorar' || mapping[e.layer] === 'texto' || mapping[e.layer] === 'cota') continue;
    const g = e.geo;
    if (g.kind === 'line') seg(g.a, g.b);
    else if (g.kind === 'poly' || g.kind === 'face3d') { for (let i = 1; i < g.pts.length; i++) seg(g.pts[i - 1], g.pts[i]); if (g.kind === 'poly' && g.closed && g.pts.length > 2) seg(g.pts[g.pts.length - 1], g.pts[0]); }
    else if (g.kind === 'arc' || g.kind === 'circle') {
      let a0 = g.kind === 'arc' ? g.a0 : 0, a1 = g.kind === 'arc' ? g.a1 : Math.PI * 2;
      if (a1 < a0) a1 += Math.PI * 2;
      const n = Math.max(6, Math.ceil((a1 - a0) / (Math.PI / 16)));
      for (let i = 0; i < n; i++) { const t0 = a0 + ((a1 - a0) * i) / n, t1 = a0 + ((a1 - a0) * (i + 1)) / n; seg([g.c[0] + g.r * Math.cos(t0), g.c[1] + g.r * Math.sin(t0)], [g.c[0] + g.r * Math.cos(t1), g.c[1] + g.r * Math.sin(t1)]); }
    }
  }
  return out;
}

export function applyImport(p: Project, c: ImportChoice): Project {
  const n: Project = structuredClone(p);
  const provenance: Record<string, string> = {};
  const warnings = [...c.model.warnings];
  const base = c.room ? toRoomCoords(c.room, c.toM) : null;
  // rotação de 180°: inverte frente/fundo e esquerda/direita (por convenção o comprimento é o lado maior)
  const flip = Math.round(((c.rotationDeg % 360) + 360) % 360) === 180;
  const L = c.room?.lengthM ?? 0;
  const fixed = base ? (q: Pt): [number, number] => { const [x, z] = base(q); return flip ? [L - x, -z] : [x, z]; } : null;
  const OPP: Record<string, Door['wall']> = { frente: 'fundo', fundo: 'frente', esquerda: 'direita', direita: 'esquerda' };
  if (c.room) {
    n.room.areaMode = 'dims';
    n.room.length = +c.room.lengthM.toFixed(3);
    n.room.width = +c.room.widthM.toFixed(3);
    provenance.length = 'importado do CAD'; provenance.width = 'importado do CAD';
  }
  n.room.height = c.heightM; provenance.height = 'informado pelo usuário na importação';
  if (c.applyPanel && c.room?.panelMm) { n.envelope.wallThk = c.room.panelMm; provenance.wallThk = `importado do CAD (parede de ${((c.room.wallThicknessM ?? 0) * 1000).toFixed(0)} mm, ajustada ao painel padrão)`; }
  if (c.doors.length) {
    const doors: Door[] = c.doors.map((d) => makeDoor({ wall: flip ? OPP[d.wall] : d.wall, position: +d.position.toFixed(3), width: +d.widthM.toFixed(2), height: Math.min(n.room.height - 0.1, d.widthM > 2.2 ? 3 : 2.2), type: d.type === 'giratoria' ? 'giratoria' : 'correr', adjacentT: n.climate.Tout, adjacentRH: n.climate.RHout }));
    n.doors = c.replaceDoors ? doors : [...n.doors, ...doors];
    provenance.doors = `${doors.length} porta(s) importada(s) do CAD (altura e regime de uso a confirmar)`;
  }
  if (c.confirmDims && c.room) n.confirmed.dimensoes = true;
  const identity = (q: Pt): [number, number] => [q[0] * c.toM, -q[1] * c.toM];
  const record: CadImportRecord = {
    fileName: c.model.fileName, format: c.model.format, version: `${c.model.version} (${c.model.versionName})`, unit: c.unit, scale: c.toM, rotationDeg: c.rotationDeg,
    importedAt: new Date().toISOString(), layers: c.layers, mapping: c.mapping,
    ref: referenceSegments(c.model, new Set(c.layers), c.mapping, fixed ?? identity),
    provenance, warnings,
  };
  n.cadImport = record;
  return n;
}
