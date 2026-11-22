import * as THREE from 'three';
import { useLayoutEffect, useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { useStore } from '../state/store';
import { M, clipped } from './materials';
import { Fan, G, HVessel, Part, Segment } from './parts';
import type { Equip } from './layout';

const animK = () => { const a = useStore.getState().view.anim; return a === 'pausada' ? 0 : a === 'reduzida' ? 0.25 : 1; };

/** Rotor helicoidal: perfil lobulado extrudado e torcido ao longo do eixo. */
function rotorGeometry(lobes: number, ro: number, ri: number, length: number, twist: number) {
  const shape = new THREE.Shape();
  const n = lobes * 16;
  for (let i = 0; i <= n; i++) {
    const t = (i / n) * Math.PI * 2;
    const r = ri + (ro - ri) * Math.pow(0.5 + 0.5 * Math.cos(t * lobes), 1.6);
    const x = Math.cos(t) * r, y = Math.sin(t) * r;
    if (i === 0) shape.moveTo(x, y); else shape.lineTo(x, y);
  }
  const g = new THREE.ExtrudeGeometry(shape, { depth: length, steps: 40, bevelEnabled: false });
  const p = g.attributes.position as THREE.BufferAttribute;
  const v = new THREE.Vector3();
  for (let i = 0; i < p.count; i++) {
    v.fromBufferAttribute(p, i);
    const a = (v.z / length) * twist;
    const c = Math.cos(a), s = Math.sin(a);
    p.setXYZ(i, v.x * c - v.y * s, v.x * s + v.y * c, v.z - length / 2);
  }
  g.computeVertexNormals();
  g.rotateY(Math.PI / 2);
  return g;
}
const ROTOR_M = rotorGeometry(4, 0.24, 0.13, 1.1, Math.PI * 1.2);
const ROTOR_F = rotorGeometry(6, 0.2, 0.15, 1.1, -Math.PI * 0.8);

export function Compressor(_: { e: Equip }) {
  const rm = useRef<THREE.Mesh>(null), rf = useRef<THREE.Mesh>(null);
  useFrame((_, dt) => {
    const k = animK();
    if (rm.current) rm.current.rotation.x += dt * 3 * k;
    if (rf.current) rf.current.rotation.x -= dt * 2 * k;
  });
  return (
    <group>
      {/* base / skid */}
      <mesh geometry={G.box} material={M.graphite} position={[0, 0.1, 0]} scale={[3.6, 0.2, 1.4]} receiveShadow castShadow />
      {/* motor elétrico */}
      <Part offset={[-1.2, 0, 0]}>
        <mesh geometry={G.cyl} material={M.blue} position={[-1.05, 0.8, 0]} rotation={[0, 0, Math.PI / 2]} scale={[0.42, 1.3, 0.42]} castShadow />
        <mesh geometry={G.box} material={M.blue} position={[-1.05, 0.45, 0]} scale={[1.1, 0.3, 0.7]} />
        <mesh geometry={G.box} material={M.graphite} position={[-1.05, 1.32, 0]} scale={[0.5, 0.2, 0.4]} />
      </Part>
      {/* acoplamento */}
      <mesh geometry={G.cyl} material={M.steel} position={[-0.25, 0.8, 0]} rotation={[0, 0, Math.PI / 2]} scale={[0.16, 0.3, 0.16]} />
      {/* carcaça do compressor parafuso com rotores internos */}
      <Part offset={[0, 1.4, 0]}>
        <mesh geometry={G.box} material={M.darkBlue} position={[0.65, 0.8, 0]} scale={[1.3, 0.8, 0.95]} castShadow />
        <mesh ref={rm} geometry={ROTOR_M} material={M.rotorM} position={[0.65, 0.8, 0.17]} />
        <mesh ref={rf} geometry={ROTOR_F} material={M.rotorF} position={[0.65, 0.8, -0.2]} />
        {/* bocais de sucção e descarga */}
        <mesh geometry={G.cyl} material={M.steel} position={[0.65, 0.8, 0.6]} rotation={[Math.PI / 2, 0, 0]} scale={[0.14, 0.3, 0.14]} />
        <mesh geometry={G.cyl} material={M.steel} position={[0.85, 1.45, 0]} scale={[0.1, 0.5, 0.1]} />
      </Part>
      {/* separador de óleo (vaso horizontal acima) */}
      <Part offset={[0, 1.2, -1.2]} position={[0.9, 1.75, 0]}>
        <HVessel length={2.2} r={0.32} material={M.vessel} level={0.25} liquid={M.oil} />
      </Part>
      {/* painel local e manômetros */}
      <mesh geometry={G.box} material={M.screen} position={[1.6, 0.7, 0.55]} scale={[0.35, 0.45, 0.06]} />
    </group>
  );
}

export function Condenser({ e }: { e: Equip }) {
  const [w, , d] = e.size; // 3 x 6
  const legs = 1.2;
  const coilTubes = useMemo(() => {
    const out: [number, number][] = [];
    for (let row = 0; row < 7; row++) for (let c = 0; c < 9; c++) out.push([-w / 2 + 0.35 + (c * (w - 0.7)) / 8, legs + 1.3 + row * 0.17 + (c % 2) * 0.08]);
    return out;
  }, [w]);
  return (
    <group>
      {/* estrutura metálica de apoio */}
      {[-1, 1].flatMap((sx) => [-1, 1].map((sz) => <mesh key={`${sx}${sz}`} geometry={G.box} material={M.galv} position={[sx * (w / 2 - 0.1), legs / 2, sz * (d / 2 - 0.1)]} scale={[0.15, legs, 0.15]} />))}
      {/* bacia de água em PRFV */}
      <Part offset={[0, -1.5, 0]}>
        <mesh geometry={G.box} material={M.frp} position={[0, legs + 0.35, 0]} scale={[w, 0.7, d]} castShadow />
        <mesh geometry={G.box} material={M.water} position={[0, legs + 0.3, 0]} scale={[w - 0.1, 0.45, d - 0.1]} />
        {/* bomba de recirculação */}
        <group position={[w / 2 + 0.35, legs + 0.3, d / 2 - 0.8]}>
          <mesh geometry={G.cyl} material={M.blue} scale={[0.18, 0.5, 0.18]} position={[0, 0.25, 0]} />
          <mesh geometry={G.cyl} material={M.steel} scale={[0.06, 2.4, 0.06]} position={[0, 1.6, 0]} />
        </group>
      </Part>
      {/* gabinete com venezianas de entrada de ar */}
      <Part offset={[0, 0, 0]}>
        <mesh geometry={G.box} material={M.frp} position={[0, legs + 2.0, 0]} scale={[w, 2.6, d]} castShadow />
      </Part>
      {/* serpentina (feixe de tubos) */}
      <Part offset={[2.2, 0, 0]}>
        {coilTubes.map(([x, y], i) => <mesh key={i} geometry={G.cylLow} material={M.galv} position={[x, y, 0]} rotation={[Math.PI / 2, 0, 0]} scale={[0.045, d - 0.4, 0.045]} />)}
        <mesh geometry={G.cyl} material={M.steel} position={[w / 2 - 0.25, legs + 2.3, -d / 2 + 0.35]} scale={[0.1, 1.3, 0.1]} />
        <mesh geometry={G.cyl} material={M.steel} position={[w / 2 - 0.25, legs + 1.4, d / 2 - 0.35]} scale={[0.1, 0.6, 0.1]} />
      </Part>
      {/* distribuidores de água (bicos) */}
      <Part offset={[0, 1.2, 0]}>
        {[-0.8, 0, 0.8].map((x) => <Segment key={x} a={[x, legs + 2.75, -d / 2 + 0.3]} b={[x, legs + 2.75, d / 2 - 0.3]} r={0.05} material={M.stainless} />)}
        <Spray w={w} d={d} y0={legs + 2.7} y1={legs + 0.6} />
      </Part>
      {/* eliminador de gotas */}
      <Part offset={[0, 2.2, 0]}>
        {Array.from({ length: 12 }, (_, i) => <mesh key={i} geometry={G.box} material={M.graphite} position={[0, legs + 3.05, -d / 2 + 0.3 + (i * (d - 0.6)) / 11]} rotation={[0.6, 0, 0]} scale={[w - 0.2, 0.25, 0.02]} />)}
      </Part>
      {/* ventiladores no topo */}
      <Part offset={[0, 3, 0]}>
        <mesh geometry={G.box} material={M.frp} position={[0, legs + 3.55, 0]} scale={[w, 0.5, d]} />
        {[-d / 4, d / 4].map((z) => (
          <group key={z} position={[0, legs + 3.9, z]}>
            <mesh geometry={G.cyl} material={M.frp} scale={[1.2, 0.5, 1.2]} />
            <group position={[0, 0.2, 0]}><Fan r={1.05} blades={6} /></group>
          </group>
        ))}
      </Part>
      <RisingAir w={w} d={d} y0={legs + 4.2} />
    </group>
  );
}

/** Gotas de água pulverizada caindo sobre a serpentina. */
function Spray({ w, d, y0, y1 }: { w: number; d: number; y0: number; y1: number }) {
  const n = useStore((s) => (s.view.quality === 'alta' ? 260 : s.view.quality === 'media' ? 120 : 40));
  const ref = useRef<THREE.InstancedMesh>(null);
  const seeds = useMemo(() => Array.from({ length: n }, () => [Math.random(), Math.random(), Math.random()]), [n]);
  const tmp = useMemo(() => new THREE.Object3D(), []);
  const t = useRef(0);
  useFrame((_, dt) => {
    t.current += dt * animK();
    const im = ref.current; if (!im) return;
    seeds.forEach(([a, b, c], i) => {
      const f = (c + t.current * 0.8) % 1;
      tmp.position.set(-w / 2 + 0.2 + a * (w - 0.4), y0 - f * (y0 - y1), -d / 2 + 0.2 + b * (d - 0.4));
      tmp.scale.set(0.025, 0.06, 0.025);
      tmp.updateMatrix(); im.setMatrixAt(i, tmp.matrix);
    });
    im.instanceMatrix.needsUpdate = true;
  });
  const mat = useMemo(() => clipped(new THREE.MeshBasicMaterial({ color: '#5fb4e8', transparent: true, opacity: 0.8 })), []);
  return <instancedMesh ref={ref} args={[G.sphereLow, mat, n]} frustumCulled={false} />;
}

/** Ar quente e úmido saindo pelos ventiladores (rejeição de calor). */
function RisingAir({ w, d, y0 }: { w: number; d: number; y0: number }) {
  const show = useStore((s) => s.view.showHeat);
  const n = 50;
  const ref = useRef<THREE.InstancedMesh>(null);
  const seeds = useMemo(() => Array.from({ length: n }, () => [Math.random(), Math.random(), Math.random()]), []);
  const tmp = useMemo(() => new THREE.Object3D(), []);
  const t = useRef(0);
  useFrame((_, dt) => {
    t.current += dt * animK();
    const im = ref.current; if (!im) return;
    seeds.forEach(([a, b, c], i) => {
      const f = (c + t.current * 0.35) % 1;
      const z = (b < 0.5 ? -d / 4 : d / 4) + (a - 0.5) * 1.6;
      tmp.position.set((a - 0.5) * w * 0.6, y0 + f * 4, z + Math.sin(f * 6 + a * 9) * 0.2);
      const s = 0.12 + f * 0.25;
      tmp.scale.set(s, s, s);
      tmp.updateMatrix(); im.setMatrixAt(i, tmp.matrix);
    });
    im.instanceMatrix.needsUpdate = true;
  });
  const mat = useMemo(() => clipped(new THREE.MeshBasicMaterial({ color: '#ff8a5c', transparent: true, opacity: 0.28, depthWrite: false })), []);
  if (!show) return null;
  return <instancedMesh ref={ref} args={[G.sphereLow, mat, n]} frustumCulled={false} />;
}

export function Evaporator({ e }: { e: Equip }) {
  const [len, h, dep] = e.size;
  const fins = Math.round(len / 0.06);
  const finRef = useRef<THREE.InstancedMesh>(null);
  const finMat = M.fin;
  useLayoutEffect(() => {
    const im = finRef.current; if (!im) return;
    const t = new THREE.Object3D();
    for (let i = 0; i < fins; i++) { t.position.set(-len / 2 + 0.1 + (i * (len - 0.2)) / fins, 0, -0.1); t.scale.set(0.004, h * 0.75, dep * 0.55); t.updateMatrix(); im.setMatrixAt(i, t.matrix); }
    im.instanceMatrix.needsUpdate = true;
  }, [fins, len, h, dep]);
  const nFans = Math.max(1, Math.round(len / 0.9));
  return (
    <group>
      {/* gabinete em chapa galvanizada pré-pintada */}
      <Part offset={[0, 1.0, 0]}>
        <mesh geometry={G.box} material={M.painted} position={[0, h / 2 - 0.04, 0]} scale={[len, 0.08, dep]} castShadow />
        <mesh geometry={G.box} material={M.painted} position={[-len / 2, 0, 0]} scale={[0.05, h, dep]} />
        <mesh geometry={G.box} material={M.painted} position={[len / 2, 0, 0]} scale={[0.05, h, dep]} />
      </Part>
      {/* bateria aletada: tubos inox e aletas de alumínio */}
      <Part offset={[0, 0, -1.0]}>
        <instancedMesh ref={finRef} args={[G.box, finMat, fins]} />
        {[-0.25, -0.08, 0.09, 0.26].flatMap((y) => [-0.25, 0.05].map((z) => (
          <mesh key={`${y}${z}`} geometry={G.cylLow} material={M.stainless} position={[0, y * h, z]} rotation={[0, 0, Math.PI / 2]} scale={[0.02, len - 0.15, 0.02]} />
        )))}
      </Part>
      {/* ventiladores frontais */}
      <Part offset={[0, 0, 1.2]}>
        <mesh geometry={G.box} material={M.painted} position={[0, 0, dep / 2]} scale={[len, h, 0.04]} />
        {Array.from({ length: nFans }, (_, i) => (
          <group key={i} position={[-len / 2 + (len * (i + 0.5)) / nFans, 0, dep / 2 + 0.06]}>
            <Fan r={Math.min(0.32, (len / nFans) * 0.38)} axis="z" speed={1.4} />
          </group>
        ))}
      </Part>
      {/* bandeja dupla de dreno */}
      <Part offset={[0, -0.9, 0]}>
        <mesh geometry={G.box} material={M.galv} position={[0, -h / 2 - 0.06, 0]} scale={[len + 0.1, 0.1, dep + 0.1]} />
      </Part>
      <AirThrough len={len} dep={dep} />
    </group>
  );
}

/** Ar da câmara atravessando a serpentina: entra mais quente (atrás) e sai frio (frente). */
function AirThrough({ len, dep }: { len: number; dep: number }) {
  const show = useStore((s) => s.view.showHeat);
  const n = 36;
  const ref = useRef<THREE.InstancedMesh>(null);
  const seeds = useMemo(() => Array.from({ length: n }, () => [Math.random(), Math.random(), Math.random()]), []);
  const tmp = useMemo(() => new THREE.Object3D(), []);
  const col = useMemo(() => new THREE.Color(), []);
  const t = useRef(0);
  const warm = new THREE.Color('#ffb070'), cold = new THREE.Color('#7cc8ff');
  useFrame((_, dt) => {
    t.current += dt * animK();
    const im = ref.current; if (!im) return;
    seeds.forEach(([a, b, c], i) => {
      const f = (c + t.current * 0.4) % 1;
      tmp.position.set((a - 0.5) * len * 0.9, (b - 0.5) * 0.6, -dep / 2 - 0.6 + f * (dep + 3.5));
      tmp.scale.setScalar(0.05);
      tmp.updateMatrix(); im.setMatrixAt(i, tmp.matrix);
      im.setColorAt(i, col.copy(warm).lerp(cold, Math.min(1, Math.max(0, (f - 0.15) * 3))));
    });
    im.instanceMatrix.needsUpdate = true;
    if (im.instanceColor) im.instanceColor.needsUpdate = true;
  });
  const mat = useMemo(() => clipped(new THREE.MeshBasicMaterial({ transparent: true, opacity: 0.6, depthWrite: false })), []);
  if (!show) return null;
  return <instancedMesh ref={ref} args={[G.sphereLow, mat, n]} frustumCulled={false} />;
}

export function Vessel({ e }: { e: Equip }) {
  const [len, d] = [e.size[0], e.size[1]];
  const level = e.kind === 'recipiente' ? 0.55 : 0.3;
  return (
    <group>
      <Part offset={[0, 0.8, 0]}>
        <HVessel length={len} r={d / 2} level={level} />
        {/* visor de nível reflex */}
        <mesh geometry={G.box} material={M.glass} position={[len / 2 - 0.4, 0, d / 2 + 0.05]} scale={[0.06, d * 0.8, 0.06]} />
        {/* válvula de segurança dupla */}
        {[-0.15, 0.15].map((x) => <mesh key={x} geometry={G.cyl} material={M.alert} position={[-len / 4 + x, d / 2 + 0.2, 0]} scale={[0.06, 0.35, 0.06]} />)}
        <mesh geometry={G.cyl} material={M.steel} position={[len / 4, d / 2 + 0.12, 0]} scale={[0.07, 0.25, 0.07]} />
      </Part>
      {/* berços */}
      {[-len / 3, len / 3].map((x) => <mesh key={x} geometry={G.box} material={M.graphite} position={[x, -d / 2 - (e.pos[1] - d / 2) / 2 + 0.02, 0]} scale={[0.25, Math.max(0.1, e.pos[1] - d / 2), d * 0.8]} />)}
    </group>
  );
}

export function Intercooler({ e }: { e: Equip }) {
  const [r, h] = [e.size[0] / 2, e.size[1]];
  return (
    <group>
      <mesh geometry={G.cyl} material={M.vessel} position={[0, h / 2 + 0.3, 0]} scale={[r, h - 0.6, r]} castShadow />
      <mesh geometry={G.sphere} material={M.vessel} position={[0, h, 0]} scale={[r, r * 0.5, r]} />
      <mesh geometry={G.sphere} material={M.vessel} position={[0, 0.6, 0]} scale={[r, r * 0.5, r]} />
      <mesh geometry={G.cyl} material={M.nh3Liquid} position={[0, 1.0, 0]} scale={[r * 0.92, 0.9, r * 0.92]} />
      <mesh geometry={G.cyl} material={M.nh3Vapor} position={[0, 2.2, 0]} scale={[r * 0.9, 1.4, r * 0.9]} />
      {[0, 1, 2].map((i) => <mesh key={i} geometry={G.box} material={M.graphite} position={[Math.cos(i * 2.1) * r * 0.8, 0.3, Math.sin(i * 2.1) * r * 0.8]} scale={[0.1, 0.6, 0.1]} />)}
    </group>
  );
}

export function Pump({ e }: { e: Equip }) {
  void e;
  return (
    <group>
      <mesh geometry={G.box} material={M.graphite} position={[0, 0.05, 0]} scale={[0.9, 0.1, 0.5]} />
      <mesh geometry={G.cyl} material={M.blue} position={[-0.15, 0.35, 0]} rotation={[0, 0, Math.PI / 2]} scale={[0.17, 0.45, 0.17]} />
      <mesh geometry={G.cyl} material={M.steel} position={[0.25, 0.35, 0]} rotation={[Math.PI / 2, 0, 0]} scale={[0.2, 0.18, 0.2]} />
      <mesh geometry={G.cyl} material={M.steel} position={[0.25, 0.6, 0]} scale={[0.07, 0.3, 0.07]} />
    </group>
  );
}

export function PlateHX({ e }: { e: Equip }) {
  const [w, h, d] = e.size;
  return (
    <group>
      <mesh geometry={G.box} material={M.blue} position={[0, h / 2, -d / 2]} scale={[w + 0.1, h, 0.08]} />
      <mesh geometry={G.box} material={M.blue} position={[0, h / 2, d / 2]} scale={[w + 0.1, h, 0.08]} />
      <Part offset={[0, 0, 0.6]}>
        {Array.from({ length: 14 }, (_, i) => <mesh key={i} geometry={G.box} material={i % 2 ? M.stainless : M.steel} position={[0, h / 2, -d / 2 + 0.07 + (i * (d - 0.14)) / 13]} scale={[w - 0.05, h - 0.2, 0.02]} />)}
      </Part>
      <mesh geometry={G.cyl} material={M.steel} position={[0, h + 0.1, 0]} rotation={[Math.PI / 2, 0, 0]} scale={[0.03, d + 0.4, 0.03]} />
    </group>
  );
}

export function ControlPanel({ e }: { e: Equip }) {
  const [w, h, d] = e.size;
  return (
    <group>
      <mesh geometry={G.box} material={M.painted} position={[0, h / 2, 0]} scale={[w, h, d]} castShadow />
      <mesh geometry={G.box} material={M.screen} position={[-w / 4, h * 0.68, d / 2 + 0.01]} scale={[0.6, 0.4, 0.02]} />
      {[0, 1, 2, 3].map((i) => <mesh key={i} geometry={G.sphereLow} material={i === 3 ? M.alert : M.blue} position={[w / 4 + (i - 1.5) * 0.15, h * 0.7, d / 2 + 0.02]} scale={0.04} />)}
      <mesh geometry={G.box} material={M.blue} position={[0, h + 0.05, 0]} scale={[w + 0.05, 0.1, d + 0.05]} />
    </group>
  );
}

export function ValveStation({ e }: { e: Equip }) {
  const [, h, d] = e.size;
  return (
    <group>
      <mesh geometry={G.box} material={M.galv} position={[0, 0, 0]} scale={[0.08, h, d]} />
      {[-0.6, 0, 0.6].flatMap((z) => [-0.4, 0.3].map((y) => (
        <group key={`${z}${y}`} position={[0.15, y, z]}>
          <mesh geometry={G.box} material={M.steel} scale={[0.14, 0.14, 0.14]} />
          <mesh geometry={G.torus} material={M.alert} position={[0.12, 0, 0]} rotation={[0, Math.PI / 2, 0]} scale={[0.09, 0.09, 0.5]} />
        </group>
      )))}
    </group>
  );
}

export function Sensor({ e }: { e: Equip }) {
  const ref = useRef<THREE.Mesh>(null);
  useFrame(({ clock }) => { if (ref.current) (ref.current.material as THREE.MeshBasicMaterial).color.setHSL(0.33, 1, 0.35 + 0.2 * Math.sin(clock.elapsedTime * 3)); });
  void e;
  return (
    <group>
      <mesh geometry={G.box} material={M.painted} scale={[0.25, 0.18, 0.25]} />
      <mesh ref={ref} geometry={G.sphereLow} position={[0, -0.1, 0.1]} scale={0.03}><meshBasicMaterial color="#2bd16b" /></mesh>
    </group>
  );
}

export function Exhaust({ e }: { e: Equip }) {
  void e;
  return (
    <group rotation={[Math.PI / 2, 0, 0]}>
      <mesh geometry={G.box} material={M.galv} scale={[1.1, 0.25, 1.1]} />
      <group position={[0, 0.15, 0]}><Fan r={0.45} blades={5} speed={0.6} /></group>
    </group>
  );
}

export function IceBank({ e }: { e: Equip }) {
  const [w, h, d] = e.size;
  const agit = useRef<THREE.Group>(null);
  useFrame((_, dt) => { if (agit.current) agit.current.rotation.y += dt * 2 * animK(); });
  const tubes = useMemo(() => {
    const t: [number, number][] = [];
    for (let i = 0; i < 8; i++) for (let j = 0; j < 4; j++) t.push([-w / 2 + 0.6 + (i * (w - 1.6)) / 7, 0.4 + j * 0.42]);
    return t;
  }, [w]);
  return (
    <group>
      {/* tanque isotérmico com painéis de 100 mm */}
      <mesh geometry={G.box} material={M.panel} position={[0, h / 2, -d / 2]} scale={[w, h, 0.1]} castShadow />
      <mesh geometry={G.box} material={M.panel} position={[0, h / 2, d / 2]} scale={[w, h, 0.1]} castShadow />
      <mesh geometry={G.box} material={M.panel} position={[-w / 2, h / 2, 0]} scale={[0.1, h, d]} />
      <mesh geometry={G.box} material={M.panel} position={[w / 2, h / 2, 0]} scale={[0.1, h, d]} />
      <Part offset={[0, 2.5, 0]}><mesh geometry={G.box} material={M.panel} position={[0, h + 0.05, 0]} scale={[w, 0.1, d]} /></Part>
      <mesh geometry={G.box} material={M.water} position={[0, h * 0.42, 0]} scale={[w - 0.2, h * 0.8, d - 0.2]} />
      {/* serpentinas com camada de gelo */}
      <Part offset={[0, 0, 0]}>
        {tubes.map(([x, y], i) => (
          <group key={i} position={[x, y, 0]}>
            <mesh geometry={G.cylLow} material={M.steel} rotation={[Math.PI / 2, 0, 0]} scale={[0.04, d - 0.6, 0.04]} />
            <mesh geometry={G.cylLow} material={M.ice} rotation={[Math.PI / 2, 0, 0]} scale={[0.13, d - 0.65, 0.13]} />
          </group>
        ))}
      </Part>
      {/* divisória vertical e agitador */}
      <mesh geometry={G.box} material={M.steel} position={[w / 2 - 0.6, h * 0.45, 0]} scale={[0.03, h * 0.85, d - 0.6]} />
      <group position={[w / 2 - 0.3, 0, 0]}>
        <mesh geometry={G.cyl} material={M.blue} position={[0, h + 0.35, 0]} scale={[0.15, 0.5, 0.15]} />
        <mesh geometry={G.cylLow} material={M.steel} position={[0, h / 2, 0]} scale={[0.03, h, 0.03]} />
        <group ref={agit} position={[0, 0.4, 0]}>
          {[0, 1, 2].map((i) => <mesh key={i} geometry={G.box} material={M.steel} rotation={[0.4, (i * Math.PI * 2) / 3, 0]} scale={[0.35, 0.02, 0.1]} />)}
        </group>
      </group>
    </group>
  );
}
