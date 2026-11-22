import * as THREE from 'three';
import { useMemo, useRef, type ReactNode } from 'react';
import { useFrame } from '@react-three/fiber';
import { useStore } from '../state/store';
import { M, clipped, lineMat } from './materials';
import { LINE_INFO, type Route, type V3 } from './layout';

export const G = {
  box: new THREE.BoxGeometry(1, 1, 1),
  cyl: new THREE.CylinderGeometry(1, 1, 1, 28),
  cylLow: new THREE.CylinderGeometry(1, 1, 1, 12),
  sphere: new THREE.SphereGeometry(1, 20, 14),
  sphereLow: new THREE.SphereGeometry(1, 8, 6),
  torus: new THREE.TorusGeometry(1, 0.08, 8, 28),
  cone: new THREE.ConeGeometry(1, 1, 12),
};

/** Grupo que se desloca na vista explodida (offset multiplicado pelo fator de explosão). */
export function Part({ offset = [0, 0, 0], children, position = [0, 0, 0] }: { offset?: V3; children: ReactNode; position?: V3 }) {
  const ref = useRef<THREE.Group>(null);
  useFrame(() => {
    const e = useStore.getState().view.explode;
    const g = ref.current;
    if (!g) return;
    g.position.x += (position[0] + offset[0] * e - g.position.x) * 0.15;
    g.position.y += (position[1] + offset[1] * e - g.position.y) * 0.15;
    g.position.z += (position[2] + offset[2] * e - g.position.z) * 0.15;
  });
  return <group ref={ref} position={position}>{children}</group>;
}

/** Cilindro entre dois pontos. */
export function Segment({ a, b, r, material }: { a: V3; b: V3; r: number; material: THREE.Material }) {
  const { pos, quat, len } = useMemo(() => {
    const va = new THREE.Vector3(...a), vb = new THREE.Vector3(...b);
    const dir = vb.clone().sub(va);
    const len = dir.length();
    const quat = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir.normalize());
    return { pos: va.add(vb).multiplyScalar(0.5), quat, len };
  }, [a, b]);
  return <mesh geometry={G.cylLow} material={material} position={pos} quaternion={quat} scale={[r, len, r]} castShadow />;
}

/** Vaso horizontal com tampos abaulados (eixo x). */
export function HVessel({ length, r, material = M.vessel, level, liquid = M.nh3Liquid, vapor = M.nh3Vapor }: { length: number; r: number; material?: THREE.Material; level?: number; liquid?: THREE.Material; vapor?: THREE.Material }) {
  const liq = useMemo(() => (level ? segmentGeometry(r * 0.94, level, length - 0.05) : null), [r, level, length]);
  return (
    <group>
      <mesh geometry={G.cyl} material={material} rotation={[0, 0, Math.PI / 2]} scale={[r, length - r, r]} castShadow />
      <mesh geometry={G.sphere} material={material} position={[(length - r) / 2, 0, 0]} scale={[r * 0.5, r, r]} castShadow />
      <mesh geometry={G.sphere} material={material} position={[-(length - r) / 2, 0, 0]} scale={[r * 0.5, r, r]} castShadow />
      {liq && <mesh geometry={liq} material={liquid} />}
      {level && <mesh geometry={G.cyl} material={vapor} rotation={[0, 0, Math.PI / 2]} scale={[r * 0.9, length - r - 0.1, r * 0.9]} />}
    </group>
  );
}

/** Prisma de segmento circular (líquido em vaso horizontal), eixo x, nível 0..1. */
export function segmentGeometry(r: number, level: number, length: number) {
  const h = -r + 2 * r * level;
  const ang = Math.acos(Math.max(-1, Math.min(1, h / r)));
  const shape = new THREE.Shape();
  const start = -Math.PI / 2 - (Math.PI - ang);
  const end = -Math.PI / 2 + (Math.PI - ang);
  shape.absarc(0, 0, r, start, end, false);
  shape.closePath();
  const g = new THREE.ExtrudeGeometry(shape, { depth: length - r * 1.1, bevelEnabled: false, curveSegments: 24 });
  g.translate(0, 0, -(length - r * 1.1) / 2);
  g.rotateY(Math.PI / 2);
  return g;
}

/** Ventilador axial (pás giratórias). */
export function Fan({ r, blades = 5, speed = 1, axis = 'y' }: { r: number; blades?: number; speed?: number; axis?: 'y' | 'z' }) {
  const ref = useRef<THREE.Group>(null);
  useFrame((_, dt) => {
    const v = useStore.getState().view;
    const k = v.anim === 'pausada' ? 0 : v.anim === 'reduzida' ? 0.25 : 1;
    if (ref.current) ref.current.rotation.y += dt * 9 * speed * k;
  });
  return (
    <group rotation={axis === 'z' ? [Math.PI / 2, 0, 0] : [0, 0, 0]}>
      <mesh geometry={G.torus} material={M.graphite} rotation={[Math.PI / 2, 0, 0]} scale={[r * 1.05, r * 1.05, r * 4]} />
      <group ref={ref}>
        <mesh geometry={G.cyl} material={M.graphite} scale={[r * 0.18, 0.12, r * 0.18]} />
        {Array.from({ length: blades }, (_, i) => (
          <mesh key={i} geometry={G.box} material={M.steel} rotation={[0.35, (i / blades) * Math.PI * 2, 0]} position={[Math.cos((i / blades) * Math.PI * 2) * r * 0.55, 0, -Math.sin((i / blades) * Math.PI * 2) * r * 0.55]} scale={[r * 0.8, 0.02, r * 0.28]} />
        ))}
      </group>
    </group>
  );
}

/** Tubulação de uma rota, com isolamento e faixas de identificação. */
export function Pipe({ route }: { route: Route }) {
  const info = LINE_INFO[route.kind];
  const r = info.radius;
  const mat = info.insulated ? M.insulation : lineMat(info.color);
  const band = lineMat(info.color);
  const segs = route.pts.slice(1).map((b, i) => [route.pts[i], b] as [V3, V3]);
  return (
    <group>
      {segs.map(([a, b], i) => <Segment key={i} a={a} b={b} r={info.insulated ? r + 0.04 : r} material={mat} />)}
      {route.pts.slice(1, -1).map((p, i) => <mesh key={i} geometry={G.sphereLow} material={mat} position={p} scale={info.insulated ? r + 0.04 : r} />)}
      {info.insulated && segs.filter(([a, b]) => dist(a, b) > 1.5).map(([a, b], i) => {
        const m: V3 = [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2, (a[2] + b[2]) / 2];
        const d = sub(b, a), l = dist(a, b);
        const t = 0.18 / l;
        return <Segment key={'b' + i} a={[m[0] - d[0] * t, m[1] - d[1] * t, m[2] - d[2] * t]} b={[m[0] + d[0] * t, m[1] + d[1] * t, m[2] + d[2] * t]} r={r + 0.05} material={band} />;
      })}
    </group>
  );
}
const sub = (a: V3, b: V3): V3 => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const dist = (a: V3, b: V3) => Math.hypot(...sub(a, b));

/** Partículas que percorrem a rota: representação visual do escoamento (as cores são legendas, não a cor real do fluido). */
export function Flow({ route, rate = 1 }: { route: Route; rate?: number }) {
  const info = LINE_INFO[route.kind];
  const quality = useStore((s) => s.view.quality);
  const ref = useRef<THREE.InstancedMesh>(null);
  const { cum, total } = useMemo(() => {
    const cum = [0];
    for (let i = 1; i < route.pts.length; i++) cum.push(cum[i - 1] + dist(route.pts[i], route.pts[i - 1]));
    return { cum, total: cum[cum.length - 1] };
  }, [route]);
  const density = info.phase === 'vapor' ? 0.9 : info.phase === 'mistura' ? 1.6 : 2.4; // partículas por metro
  const qf = quality === 'alta' ? 1 : quality === 'media' ? 0.55 : 0.25;
  const count = Math.max(2, Math.min(240, Math.round(total * density * qf)));
  const speed = (info.phase === 'vapor' ? 2.2 : info.phase === 'mistura' ? 1.5 : 0.8) * rate;
  const mat = useMemo(() => clipped(new THREE.MeshBasicMaterial({ color: info.color, transparent: info.phase !== 'liquido', opacity: info.phase === 'vapor' ? 0.75 : 0.9 })), [info]);
  const tmp = useMemo(() => new THREE.Object3D(), []);
  const offset = useRef(0);
  useFrame((_, dt) => {
    const st = useStore.getState().view;
    const k = st.anim === 'pausada' ? 0 : st.anim === 'reduzida' ? 0.3 : 1;
    offset.current = (offset.current + dt * speed * st.flowSpeed * k) % total;
    const im = ref.current;
    if (!im) return;
    const r = info.radius + (info.insulated ? 0.06 : 0.02);
    for (let i = 0; i < count; i++) {
      const s = ((i / count) * total + offset.current) % total;
      let j = 1;
      while (j < cum.length - 1 && cum[j] < s) j++;
      const f = (s - cum[j - 1]) / (cum[j] - cum[j - 1] || 1);
      const a = route.pts[j - 1], b = route.pts[j];
      tmp.position.set(a[0] + (b[0] - a[0]) * f, a[1] + (b[1] - a[1]) * f, a[2] + (b[2] - a[2]) * f);
      const isLiquid = info.phase === 'liquido' || (info.phase === 'mistura' && i % 3 === 0);
      const sc = isLiquid ? r * 0.75 : r * 0.55;
      tmp.scale.set(sc, sc, sc);
      tmp.updateMatrix();
      im.setMatrixAt(i, tmp.matrix);
    }
    im.instanceMatrix.needsUpdate = true;
  });
  return <instancedMesh ref={ref} args={[G.sphereLow, mat, count]} frustumCulled={false} />;
}
