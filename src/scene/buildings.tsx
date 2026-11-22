import * as THREE from 'three';
import { useLayoutEffect, useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { useStore } from '../state/store';
import type { Door, Project, Wall } from '../engine/types';
import { placeDoors, type PlacedDoor } from './layout';
import { M } from './materials';
import { G } from './parts';
import type { Layout } from './layout';

/** Material das faces frontais e coberturas em transparência: corte arquitetônico para mostrar o interior. */
export const cutaway = new THREE.MeshStandardMaterial({ color: '#dfe7ee', transparent: true, opacity: 0.16, roughness: 0.3, depthWrite: false, side: THREE.DoubleSide });

export function Ground({ l }: { l: Layout }) {
  const size = Math.max(120, (l.bounds.max[0] - l.bounds.min[0]) * 2.5);
  return (
    <group>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.01, 0]} receiveShadow>
        <planeGeometry args={[size, size]} />
        <meshStandardMaterial color="#d6dbe0" roughness={1} />
      </mesh>
      <gridHelper args={[size, size / 2, '#c2c9d0', '#cbd1d7']} position={[0, 0.001, 0]} />
    </group>
  );
}

export function MachineRoom({ l }: { l: Layout }) {
  const hide = useStore((s) => s.view.hideBuilding);
  const { min, max } = l.machineRoom;
  const w = max[0] - min[0], d = max[2] - min[2], h = max[1];
  const cx = (min[0] + max[0]) / 2;
  return (
    <group>
      <mesh geometry={G.box} material={M.concrete} position={[cx, -0.05, 0]} scale={[w + 0.4, 0.1, d + 0.4]} receiveShadow />
      {!hide && (
        <group>
          <mesh geometry={G.box} material={M.concrete} position={[cx, h / 2, min[2]]} scale={[w, h, 0.2]} castShadow receiveShadow />
          <mesh geometry={G.box} material={M.concrete} position={[min[0], h / 2, 0]} scale={[0.2, h, d]} castShadow receiveShadow />
          <mesh geometry={G.box} material={M.concrete} position={[max[0], h / 2, 0]} scale={[0.2, h, d]} castShadow />
          <mesh geometry={G.box} material={cutaway} position={[cx, h / 2, max[2]]} scale={[w, h, 0.2]} />
          <mesh geometry={G.box} material={cutaway} position={[cx, h + 0.1, 0]} scale={[w + 0.2, 0.2, d + 0.2]} />
        </group>
      )}
    </group>
  );
}

function wallFrame(wall: Wall, L: number, W: number, t: number) {
  // retorna origem, direção ao longo da parede e comprimento; normal externa
  switch (wall) {
    case 'frente': return { o: new THREE.Vector3(0, 0, W / 2 + t / 2), u: new THREE.Vector3(1, 0, 0), len: L, rotY: 0 };
    case 'fundo': return { o: new THREE.Vector3(L, 0, -W / 2 - t / 2), u: new THREE.Vector3(-1, 0, 0), len: L, rotY: Math.PI };
    case 'esquerda': return { o: new THREE.Vector3(-t / 2, 0, W / 2), u: new THREE.Vector3(0, 0, -1), len: W, rotY: -Math.PI / 2 };
    case 'direita': return { o: new THREE.Vector3(L + t / 2, 0, -W / 2), u: new THREE.Vector3(0, 0, 1), len: W, rotY: Math.PI / 2 };
  }
}

export function ColdRoom({ l, p }: { l: Layout; p: Project }) {
  const hide = useStore((s) => s.view.hideBuilding);
  const { L, W, H } = l;
  const tw = p.envelope.wallThk / 1000, tr = p.envelope.roofThk / 1000;
  const doors = useMemo(() => placeDoors(p, L, W), [p, L, W]);
  const walls: Wall[] = ['frente', 'fundo', 'esquerda', 'direita'];
  return (
    <group>
      {/* piso (com isolamento quando especificado) */}
      <mesh geometry={G.box} material={p.envelope.floorInsulated ? M.panel : M.concrete} position={[L / 2, -0.06, 0]} scale={[L + 2 * tw, 0.12, W + 2 * tw]} receiveShadow />
      <mesh geometry={G.box} material={M.floor} position={[L / 2, 0.005, 0]} scale={[L, 0.01, W]} receiveShadow />
      {!hide && walls.map((w) => <WallWithOpenings key={w} wall={w} L={L} W={W} H={H} t={tw} doors={doors.filter((d) => d.wall === w)} front={w === 'frente'} />)}
      {!hide && <mesh geometry={G.box} material={cutaway} position={[L / 2, H + tr / 2, 0]} scale={[L + 2 * tw, tr, W + 2 * tw]} />}
      {doors.map((d) => <DoorModel key={d.door.id + d.idx} pd={d} L={L} W={W} t={tw} />)}
      <Pallets p={p} l={l} doors={doors} />
      <HeatArrows l={l} p={p} />
    </group>
  );
}

function WallWithOpenings({ wall, L, W, H, t, doors, front }: { wall: Wall; L: number; W: number; H: number; t: number; doors: PlacedDoor[]; front: boolean }) {
  const f = wallFrame(wall, L, W, t);
  const segs: { u0: number; u1: number; y0: number; y1: number }[] = [];
  const sorted = [...doors].sort((a, b) => a.u0 - b.u0);
  let cur = -t;
  for (const d of sorted) {
    if (d.u0 > cur) segs.push({ u0: cur, u1: d.u0, y0: 0, y1: H });
    segs.push({ u0: d.u0, u1: d.u1, y0: d.door.height, y1: H });
    cur = d.u1;
  }
  segs.push({ u0: cur, u1: f.len + t, y0: 0, y1: H });
  const mat = front ? cutaway : M.panel;
  return (
    <group>
      {segs.filter((s) => s.u1 - s.u0 > 0.01 && s.y1 - s.y0 > 0.01).map((s, i) => {
        const mid = (s.u0 + s.u1) / 2;
        const pos = f.o.clone().addScaledVector(f.u, mid);
        return <mesh key={i} geometry={G.box} material={mat} position={[pos.x, (s.y0 + s.y1) / 2, pos.z]} rotation={[0, f.rotY, 0]} scale={[s.u1 - s.u0, s.y1 - s.y0, t]} castShadow={!front} receiveShadow />;
      })}
    </group>
  );
}

function DoorModel({ pd, L, W, t }: { pd: PlacedDoor; L: number; W: number; t: number }) {
  const f = wallFrame(pd.wall, L, W, t);
  const d = pd.door;
  const leaf = useRef<THREE.Group>(null);
  const open = useRef(0);
  useFrame((_, dt) => {
    const v = useStore.getState().view;
    const target = v.doorsOpen ? 1 : 0;
    open.current += (target - open.current) * Math.min(1, dt * 2.5);
    const g = leaf.current; if (!g) return;
    const o = open.current;
    g.position.set(0, 0, 0); g.rotation.set(0, 0, 0);
    if (d.type === 'correr' || d.type === 'correr-trilho') g.position.x = o * d.width;
    else if (d.type === 'seccional') g.position.y = o * (d.height - 0.2);
    else g.rotation.y = -o * Math.PI * 0.55;
  });
  const center = f.o.clone().addScaledVector(f.u, (pd.u0 + pd.u1) / 2);
  const out = t / 2 + 0.06;
  const thk = Math.min(0.25, Math.max(0.035, t * 0.9));
  const pivot = d.type === 'giratoria' || d.type === 'portinhola' ? -d.width / 2 : 0;
  const y0 = d.type === 'portinhola' ? 0.9 : 0;
  return (
    <group position={[center.x, 0, center.z]} rotation={[0, f.rotY, 0]}>
      {/* marco */}
      <mesh geometry={G.box} material={M.galv} position={[-d.width / 2 - 0.05, d.height / 2 + y0, out - 0.04]} scale={[0.1, d.height, 0.08]} />
      <mesh geometry={G.box} material={M.galv} position={[d.width / 2 + 0.05, d.height / 2 + y0, out - 0.04]} scale={[0.1, d.height, 0.08]} />
      <mesh geometry={G.box} material={M.galv} position={[0, d.height + y0 + 0.05, out - 0.04]} scale={[d.width + 0.2, 0.1, 0.08]} />
      {(d.type === 'correr' || d.type === 'correr-trilho') && <mesh geometry={G.box} material={M.steel} position={[d.width / 2, d.height + 0.18, out]} scale={[d.width * 2.2, 0.08, 0.08]} />}
      {d.protection === 'ar' && <mesh geometry={G.box} material={M.graphite} position={[0, d.height + 0.35, out + 0.05]} scale={[d.width, 0.3, 0.35]} />}
      <group position={[pivot, y0, out + thk / 2]}>
        <group ref={leaf}>
          <mesh geometry={G.box} material={M.panel} position={[-pivot, d.height / 2, 0]} scale={[d.width, d.height, thk]} castShadow />
          <mesh geometry={G.box} material={M.blue} position={[-pivot, d.height * 0.5, thk / 2 + 0.01]} scale={[d.width * 0.9, 0.06, 0.01]} />
          {d.type === 'seccional' && [0.25, 0.5, 0.75].map((k) => <mesh key={k} geometry={G.box} material={M.galv} position={[0, d.height * k, thk / 2 + 0.005]} scale={[d.width, 0.02, 0.01]} />)}
        </group>
      </group>
      {d.protection === 'pvc' && (() => {
        const ns = Math.max(3, Math.round(d.width / 0.2));
        return Array.from({ length: ns }, (_, i) => (
          <mesh key={i} geometry={G.box} material={M.glass} position={[-d.width / 2 + (d.width * (i + 0.5)) / ns, d.height / 2 + y0, -t / 2 - 0.03]} scale={[d.width / ns - 0.01, d.height, 0.01]} />
        ));
      })()}
      <DoorAirExchange d={d} out={out} y0={y0} />
    </group>
  );
}

/** Troca de ar por diferença de densidade: ar frio sai por baixo, ar quente e úmido entra por cima. */
function DoorAirExchange({ d, out, y0 }: { d: Door; out: number; y0: number }) {
  const show = useStore((s) => s.view.doorsOpen && s.view.showHeat);
  const ref = useRef<THREE.InstancedMesh>(null);
  const n = 40;
  const seeds = useMemo(() => Array.from({ length: n }, (_, i) => [Math.random(), Math.random(), i % 2]), []);
  const tmp = useMemo(() => new THREE.Object3D(), []);
  const t = useRef(0);
  const warm = new THREE.Color('#ff8a4c'), cold = new THREE.Color('#5fb4ff');
  useFrame((_, dt) => {
    const st = useStore.getState().view;
    t.current += dt * (st.anim === 'pausada' ? 0 : 1);
    const im = ref.current; if (!im) return;
    seeds.forEach(([a, b, c], i) => {
      const f = (b + t.current * 0.45) % 1;
      const inward = c === 1;
      const y = y0 + (inward ? 0.55 + a * 0.4 : 0.05 + a * 0.4) * d.height;
      const z = inward ? out + 1.5 - f * 3.5 : out - 2 + f * 3.5;
      tmp.position.set((a - 0.5) * d.width * 0.9, y, z);
      tmp.scale.setScalar(0.06);
      tmp.updateMatrix(); im.setMatrixAt(i, tmp.matrix);
      im.setColorAt(i, inward ? warm : cold);
    });
    im.instanceMatrix.needsUpdate = true;
    if (im.instanceColor) im.instanceColor.needsUpdate = true;
  });
  const mat = useMemo(() => new THREE.MeshBasicMaterial({ transparent: true, opacity: 0.75, depthWrite: false }), []);
  if (!show) return null;
  return <instancedMesh ref={ref} args={[G.sphereLow, mat, n]} frustumCulled={false} />;
}

function Pallets({ p, l, doors }: { p: Project; l: Layout; doors: PlacedDoor[] }) {
  const ref = useRef<THREE.InstancedMesh>(null);
  const boxes = useMemo(() => {
    const out: THREE.Matrix4[] = [];
    const levels = Math.max(1, Math.min(5, Math.floor((l.H - 1.4) / 1.7)));
    const wanted = Math.min(600, Math.ceil(p.product.storedMass / 700));
    const tmp = new THREE.Object3D();
    const aisle = new Set(doors.filter((d) => d.wall === 'frente').map((d) => Math.round((d.u0 + d.u1) / 2 / 1.5)));
    for (let z = l.W / 2 - 1.2; z > -l.W / 2 + 2.6 && out.length < wanted; z -= 1.4) {
      for (let x = 1; x < l.L - 1 && out.length < wanted; x += 1.5) {
        if (aisle.has(Math.round(x / 1.5)) && z > l.W / 2 - 4) continue;
        if (Math.abs(z) < 1.2 && l.W > 8) continue; // corredor central
        for (let k = 0; k < levels && out.length < wanted; k++) {
          tmp.position.set(x, 0.75 + k * 1.7, z);
          tmp.scale.set(1.1, 1.4, 1.0);
          tmp.updateMatrix(); out.push(tmp.matrix.clone());
        }
      }
    }
    return out;
  }, [p.product.storedMass, l, doors]);
  useLayoutEffect(() => {
    const im = ref.current; if (!im) return;
    boxes.forEach((m, i) => im.setMatrixAt(i, m));
    im.count = boxes.length;
    im.instanceMatrix.needsUpdate = true;
  }, [boxes]);
  const mat = useMemo(() => new THREE.MeshStandardMaterial({ color: '#c9a46a', roughness: 0.9 }), []);
  if (p.application === 'agua-gelada' || !boxes.length) return null;
  return <instancedMesh ref={ref} args={[G.box, mat, 600]} castShadow receiveShadow />;
}

/** Setas de calor atravessando o envelope: tamanho proporcional ao fluxo U·ΔT de cada superfície. */
function HeatArrows({ l, p }: { l: Layout; p: Project }) {
  const show = useStore((s) => s.view.showHeat);
  const grp = useRef<THREE.Group>(null);
  useFrame(({ clock }) => {
    grp.current?.children.forEach((c, i) => {
      const k = 0.85 + 0.15 * Math.sin(clock.elapsedTime * 3 + i);
      c.scale.set(0.18 * s * k, 0.6 * s * k, 0.18 * s * k);
    });
  });
  const lambda = 0.038;
  const U = 1 / (1 / 8 + p.envelope.wallThk / 1000 / lambda + 1 / 25);
  const flux = U * Math.max(0, p.climate.Tout - p.room.Tin); // W/m²
  const s = Math.min(1.6, 0.35 + flux / 15);
  const items: { pos: [number, number, number]; rot: [number, number, number] }[] = [];
  for (let i = 1; i <= 3; i++) {
    const x = (l.L * i) / 4;
    items.push({ pos: [x, l.H * 0.6, l.W / 2 + 0.9], rot: [-Math.PI / 2, 0, 0] });
    items.push({ pos: [x, l.H + 0.9, 0], rot: [Math.PI, 0, 0] });
  }
  if (!show || p.application === 'agua-gelada') return null;
  return (
    <group ref={grp}>
      {items.map((it, i) => (
        <mesh key={i} geometry={G.cone} position={it.pos} rotation={it.rot} scale={[0.18 * s, 0.6 * s, 0.18 * s]}>
          <meshBasicMaterial color="#ff6a3d" transparent opacity={0.7} />
        </mesh>
      ))}
    </group>
  );
}
