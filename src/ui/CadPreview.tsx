import { useEffect, useMemo, useRef, useState } from 'react';
import type { CadModel, Pt } from '../cad/model';
import type { Category, DoorCandidate, Hint, RoomCandidate } from '../cad/recognize';

export const CAT_COLOR: Record<Category, string> = {
  camara: '#0069AE', parede: '#36424B', porta: '#1F9D55', tubulacao: '#E4572E', equipamento: '#6B5BD2', cota: '#9C9AA0', texto: '#9C9AA0', referencia: '#5D6B79', ignorar: '#CDD5DD',
};
const MAX_SEGS = 30000;

/** Planta 2D do desenho (SVG) com zoom (roda/botões), pan (arrastar) e camadas filtráveis. Não altera a cena 3D. */
export function CadPlan({ model, layers, mapping, room, doors, hints }: { model: CadModel; layers: Set<string>; mapping: Record<string, Category>; room?: RoomCandidate | null; doors?: DoorCandidate[]; hints?: Hint[] }) {
  const { paths, truncated } = useMemo(() => {
    const byCat = new Map<string, string[]>();
    let segs = 0, truncated = false;
    const add = (cat: string, d: string) => { if (!byCat.has(cat)) byCat.set(cat, []); byCat.get(cat)!.push(d); };
    const f = (v: number) => +v.toFixed(3);
    const M = (p: Pt) => `M${f(p[0])} ${f(-p[1])}`, Lc = (p: Pt) => `L${f(p[0])} ${f(-p[1])}`;
    for (const e of model.entities) {
      if (!layers.has(e.layer) || mapping[e.layer] === 'ignorar') continue;
      if (segs > MAX_SEGS) { truncated = true; break; }
      const cat = mapping[e.layer] ?? 'referencia', g = e.geo;
      if (g.kind === 'line') { add(cat, M(g.a) + Lc(g.b)); segs++; }
      else if (g.kind === 'poly' || g.kind === 'face3d') { add(cat, M(g.pts[0]) + g.pts.slice(1).map(Lc).join('') + (g.kind === 'poly' && g.closed ? 'Z' : '')); segs += g.pts.length; }
      else if (g.kind === 'circle') { add(cat, `M${f(g.c[0] + g.r)} ${f(-g.c[1])}A${f(g.r)} ${f(g.r)} 0 1 0 ${f(g.c[0] - g.r)} ${f(-g.c[1])}A${f(g.r)} ${f(g.r)} 0 1 0 ${f(g.c[0] + g.r)} ${f(-g.c[1])}`); segs += 2; }
      else if (g.kind === 'arc') {
        let sweep = g.a1 - g.a0; if (sweep < 0) sweep += Math.PI * 2;
        const p0: Pt = [g.c[0] + g.r * Math.cos(g.a0), g.c[1] + g.r * Math.sin(g.a0)], p1: Pt = [g.c[0] + g.r * Math.cos(g.a1), g.c[1] + g.r * Math.sin(g.a1)];
        add(cat, `${M(p0)}A${f(g.r)} ${f(g.r)} 0 ${sweep > Math.PI ? 1 : 0} 0 ${f(p1[0])} ${f(-p1[1])}`); segs++;
      }
    }
    return { paths: [...byCat.entries()], truncated };
  }, [model, layers, mapping]);
  const ext = model.extents;
  // Enquadre somente as entidades efetivamente visíveis. Extents do DWG podem conter
  // referências remotas ou entidades ocultas, fazendo uma planta válida parecer vazia.
  const visible = model.entities.filter((e) => layers.has(e.layer) && mapping[e.layer] !== 'ignorar');
  const coords: Pt[] = [];
  for (const e of visible) {
    const g = e.geo;
    if (g.kind === 'line') coords.push(g.a, g.b);
    else if (g.kind === 'poly' || g.kind === 'face3d') coords.push(...g.pts);
    else if (g.kind === 'arc' || g.kind === 'circle') coords.push([g.c[0]-g.r,g.c[1]-g.r],[g.c[0]+g.r,g.c[1]+g.r]);
    else if (g.kind === 'insert') coords.push(g.p);
    else if (g.kind === 'text' || g.kind === 'dim') coords.push(g.p);
  }
  const valid = coords.filter((p) => Number.isFinite(p[0]) && Number.isFinite(p[1]));
  const minX = valid.length ? valid.reduce((v,p)=>Math.min(v,p[0]),Infinity) : ext.min[0];
  const maxX = valid.length ? valid.reduce((v,p)=>Math.max(v,p[0]),-Infinity) : ext.max[0];
  const minY = valid.length ? valid.reduce((v,p)=>Math.min(v,p[1]),Infinity) : ext.min[1];
  const maxY = valid.length ? valid.reduce((v,p)=>Math.max(v,p[1]),-Infinity) : ext.max[1];
  const span = Math.max(maxX-minX, maxY-minY, 1);
  const safePad = span * 0.04;
  const base = { x: minX-safePad, y: -maxY-safePad, w: Math.max(maxX-minX,span*0.01)+2*safePad, h: Math.max(maxY-minY,span*0.01)+2*safePad };
  const [vb, setVb] = useState(base);
  useEffect(() => setVb(base), [minX, maxX, minY, maxY]);
  const drag = useRef<{ x: number; y: number; vb: typeof base } | null>(null);
  const svg = useRef<SVGSVGElement>(null);
  const stroke = Math.max(base.w, base.h) / 900;
  const zoom = (k: number, cx = vb.x + vb.w / 2, cy = vb.y + vb.h / 2) => setVb({ x: cx - (cx - vb.x) * k, y: cy - (cy - vb.y) * k, w: vb.w * k, h: vb.h * k });
  const toSvg = (clientX: number, clientY: number) => { const r = svg.current!.getBoundingClientRect(); return [vb.x + ((clientX - r.left) / r.width) * vb.w, vb.y + ((clientY - r.top) / r.height) * vb.h]; };
  return (
    <div className="cad-plan">
      <svg ref={svg} viewBox={`${vb.x} ${vb.y} ${vb.w} ${vb.h}`} preserveAspectRatio="xMidYMid meet" role="img" aria-label="Pré-visualização 2D do desenho"
        onWheel={(e) => { e.preventDefault(); const [cx, cy] = toSvg(e.clientX, e.clientY); zoom(e.deltaY > 0 ? 1.2 : 1 / 1.2, cx, cy); }}
        onPointerDown={(e) => { (e.target as Element).setPointerCapture?.(e.pointerId); drag.current = { x: e.clientX, y: e.clientY, vb }; }}
        onPointerMove={(e) => { if (!drag.current) return; const r = svg.current!.getBoundingClientRect(); const d = drag.current; setVb({ ...d.vb, x: d.vb.x - ((e.clientX - d.x) / r.width) * d.vb.w, y: d.vb.y - ((e.clientY - d.y) / r.height) * d.vb.h }); }}
        onPointerUp={() => (drag.current = null)}>
        {paths.map(([cat, ds]) => <path key={cat} d={ds.join('')} fill="none" stroke={CAT_COLOR[cat as Category] ?? '#5D6B79'} strokeWidth={1.2} vectorEffect="non-scaling-stroke" />)}
        {room && <polygon points={room.rect.corners.map((c) => `${c[0]},${-c[1]}`).join(' ')} fill="rgba(0,105,174,.12)" stroke="#0069AE" strokeWidth={2.5} vectorEffect="non-scaling-stroke" />}
        {hints?.map((h) => <circle key={h.id} cx={h.p[0]} cy={-h.p[1]} r={stroke * 9} fill="none" stroke="#C27C00" strokeWidth={2} vectorEffect="non-scaling-stroke" />)}
      </svg>
      {!paths.length && <div className="small muted" style={{ padding: 10 }}>Nenhuma geometria visível nas camadas selecionadas. Ative outras camadas ou verifique os objetos não suportados.</div>}
      <div className="cad-plan-tools">
        <button className="btn sm" onClick={() => zoom(1 / 1.4)} aria-label="Aproximar">+</button>
        <button className="btn sm" onClick={() => zoom(1.4)} aria-label="Afastar">−</button>
        <button className="btn sm" onClick={() => setVb(base)}>Enquadrar</button>
      </div>
      {truncated && <div className="small muted" style={{ padding: '2px 6px' }}>Prévia limitada a {MAX_SEGS.toLocaleString('pt-BR')} segmentos; a importação usa todas as entidades das camadas escolhidas.</div>}
      {doors && doors.length > 0 && <div className="small muted" style={{ padding: '2px 6px' }}>{doors.length} abertura(s) detectada(s) na câmara destacada.</div>}
    </div>
  );
}

/** Vista isométrica simplificada da câmara extrudada e das referências 2D. */
export function CadIso({ L, W, H, doors, refSegs }: { L: number; W: number; H: number; doors: { wall: string; position: number; width: number; height: number }[]; refSegs: number[] }) {
  const c = Math.cos(Math.PI / 6), s = Math.sin(Math.PI / 6);
  const P = (x: number, y: number, z: number): [number, number] => [(x - z) * c, -(y + (x + z) * s)]; // z: da frente (+) para o fundo (-) → profundidade = W/2 - z
  const pt = (x: number, y: number, zr: number) => P(x, y, W / 2 - zr);
  const box = [[0, 0, -W / 2], [L, 0, -W / 2], [L, 0, W / 2], [0, 0, W / 2]] as const;
  const poly = (pts: [number, number][]) => pts.map((p) => p.join(',')).join(' ');
  const floor = poly(box.map((b) => pt(b[0], 0, b[2])));
  const top = poly(box.map((b) => pt(b[0], H, b[2])));
  const all = [...box.map((b) => pt(b[0], 0, b[2])), ...box.map((b) => pt(b[0], H, b[2]))];
  const xs = all.map((p) => p[0]), ys = all.map((p) => p[1]);
  const pad = Math.max(L, W, H) * 0.08;
  const vb = `${Math.min(...xs) - pad} ${Math.min(...ys) - pad} ${Math.max(...xs) - Math.min(...xs) + 2 * pad} ${Math.max(...ys) - Math.min(...ys) + 2 * pad}`;
  const sw = Math.max(L, W) / 400;
  const wallXY = (wall: string, u: number): [number, number] => wall === 'frente' ? [u, W / 2] : wall === 'fundo' ? [L - u, -W / 2] : wall === 'esquerda' ? [0, W / 2 - u] : [L, -W / 2 + u];
  const refPath = useMemo(() => { let d = ''; for (let i = 0; i + 3 < refSegs.length && i < 24000; i += 4) { const a = pt(refSegs[i], 0.01, refSegs[i + 1]), b = pt(refSegs[i + 2], 0.01, refSegs[i + 3]); d += `M${a[0].toFixed(3)} ${a[1].toFixed(3)}L${b[0].toFixed(3)} ${b[1].toFixed(3)}`; } return d; }, [refSegs, L, W]); // eslint-disable-line react-hooks/exhaustive-deps
  return (
    <svg viewBox={vb} className="cad-iso" role="img" aria-label="Vista isométrica da câmara extrudada">
      <polygon points={floor} fill="#EDF1F4" stroke="#36424B" strokeWidth={sw} />
      <path d={refPath} fill="none" stroke="#5D6B79" strokeWidth={sw * 0.6} opacity={0.7} />
      {box.map((b, i) => { const a = pt(b[0], 0, b[2]), t = pt(b[0], H, b[2]); return <line key={i} x1={a[0]} y1={a[1]} x2={t[0]} y2={t[1]} stroke="#0069AE" strokeWidth={sw} />; })}
      <polygon points={top} fill="rgba(0,105,174,.08)" stroke="#0069AE" strokeWidth={sw} />
      {doors.map((d, i) => {
        const len = d.wall === 'frente' || d.wall === 'fundo' ? L : W;
        const u0 = Math.max(0, d.position * len - d.width / 2), u1 = Math.min(len, u0 + d.width);
        const [x0, z0] = wallXY(d.wall, u0), [x1, z1] = wallXY(d.wall, u1);
        const q = [pt(x0, 0, z0), pt(x1, 0, z1), pt(x1, d.height, z1), pt(x0, d.height, z0)];
        return <polygon key={i} points={poly(q)} fill="rgba(31,157,85,.25)" stroke="#1F9D55" strokeWidth={sw} />;
      })}
    </svg>
  );
}

/** Ícone de tipo de arquivo (DWG/BAK/DXF), no mesmo traço dos demais ícones. */
export function FileTypeIcon({ ext, title }: { ext: string; title: string }) {
  return (
    <span className="ftype" title={title} aria-label={title}>
      <svg viewBox="0 0 24 24" width="30" height="30" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinejoin="round" aria-hidden><path d="M14 3H6v18h12V7z" /><path d="M14 3v4h4" /></svg>
      <b>{ext}</b>
    </span>
  );
}
