import * as THREE from 'three';
import { Suspense, useEffect, useMemo, useRef } from 'react';
import { Canvas, useFrame, useThree, type ThreeEvent } from '@react-three/fiber';
import { CameraControls, Html } from '@react-three/drei';
import { useActiveProject, useStore } from '../state/store';
import type { Project } from '../engine/types';
import { computeLayout, type Equip, type Layout } from './layout';
import { sceneRef, sceneRefB } from './sceneUtils';
import { applyCut, applyOpacity, applyTechnical } from './materials';
import { Pipe, Flow } from './parts';
import { Compressor, Condenser, ControlPanel, Evaporator, Exhaust, IceBank, Intercooler, PlateHX, Pump, Sensor, ValveStation, Vessel } from './equipment';
import { ColdRoom, Ground, MachineRoom } from './buildings';
import { evalCached } from '../state/useEvaluation';

/** Controles da cena principal (A), lidos pela cena B quando as câmeras estão sincronizadas. */
let primaryControls: CameraControls | null = null;


const MODELS: Record<string, (p: { e: Equip }) => React.ReactNode> = {
  compressor: Compressor, condensador: Condenser, evaporador: Evaporator, recipiente: Vessel, separador: Vessel, bomba: Pump,
  intercooler: Intercooler, trocador: PlateHX, painel: ControlPanel, valvulas: ValveStation, sensor: Sensor, exaustor: Exhaust, tanque: IceBank,
};


export function equipBox(l: Layout, id: string): THREE.Box3 | null {
  const e = l.equips.find((x) => x.id === id);
  if (!e) return null;
  const [x, y, z] = e.pos, [sx, sy, sz] = e.size;
  const centered = e.kind === 'recipiente' || e.kind === 'separador' || e.kind === 'evaporador' || e.kind === 'sensor' || e.kind === 'exaustor' || e.kind === 'valvulas';
  const y0 = centered ? y - sy / 2 : y;
  return new THREE.Box3(new THREE.Vector3(x - sx / 2, y0, z - sz / 2), new THREE.Vector3(x + sx / 2, y0 + sy, z + sz / 2));
}

function Installation({ l, p }: { l: Layout; p: Project }) {
  const view = useStore((s) => s.view);
  const setView = useStore((s) => s.setView);
  const ev = evalCached(p);
  const mode = useStore((s) => s.mode);
  const visible = (id: string) => !view.isolate || !view.selected || view.selected === id || (view.selected.startsWith('compressor') && id.startsWith('compressor'));
  const onClick = (id: string) => (ev: ThreeEvent<MouseEvent>) => { ev.stopPropagation(); setView({ selected: id }); };
  const rate = Math.max(0.4, Math.min(2.5, Math.sqrt(ev.loads.nominal.requiredKW / 80)));
  return (
    <group>
      <Ground l={l} />
      {!view.isolate && <MachineRoom l={l} />}
      {l.equips.map((e) => {
        if (e.kind === 'camara') return visible('camara') ? <group key={e.id} onClick={onClick('camara')}><ColdRoom l={l} p={p} /></group> : null;
        const Model = MODELS[e.kind];
        if (!Model || !visible(e.id)) return null;
        return (
          <group key={e.id} position={e.pos} rotation={[0, e.rot ?? 0, 0]} onClick={onClick(e.id)}
            onPointerOver={(x) => { x.stopPropagation(); document.body.style.cursor = 'pointer'; }} onPointerOut={() => (document.body.style.cursor = '')}>
            <Model e={e} />
            {view.showLabels && !view.split && !view.isolate && mode !== 'home' && e.kind !== 'sensor' && !(e.kind === 'evaporador' && l.evaps.length > 4 && e.id !== 'evaporador-1') && (
              <Html position={[0, e.kind === 'condensador' ? 6.3 : e.size[1] + (e.kind === 'evaporador' ? 0.2 : 0.5), 0]} center zIndexRange={[10, 0]} className="scene-label-wrap">
                <div className={`scene-label ${view.selected === e.id ? 'on' : ''}`} onClick={() => setView({ selected: e.id })}>{e.label}</div>
              </Html>
            )}
          </group>
        );
      })}
      {!view.isolate && l.routes.map((r) => <Pipe key={r.id} route={r} />)}
      {!view.isolate && view.showFlow && l.routes.map((r) => <Flow key={'f' + r.id} route={r} rate={rate} />)}
      <SelectionBox l={l} />
    </group>
  );
}

function SelectionBox({ l }: { l: Layout }) {
  const sel = useStore((s) => s.view.selected);
  const ref = useRef<THREE.LineSegments>(null);
  const box = sel && sel !== 'camara' ? equipBox(l, sel) : null;
  const geo = useMemo(() => {
    if (!box) return null;
    const s = box.getSize(new THREE.Vector3()).addScalar(0.3);
    return new THREE.EdgesGeometry(new THREE.BoxGeometry(s.x, s.y, s.z));
  }, [box?.min.x, box?.min.y, box?.min.z, box?.max.x, box?.max.y, box?.max.z]);
  useFrame(({ clock }) => { if (ref.current) (ref.current.material as THREE.LineBasicMaterial).opacity = 0.5 + 0.4 * Math.sin(clock.elapsedTime * 4); });
  if (!box || !geo) return null;
  return <lineSegments ref={ref} geometry={geo} position={box.getCenter(new THREE.Vector3())}><lineBasicMaterial color="#0069ae" transparent /></lineSegments>;
}

/** Corte, transparência e modo técnico aplicados a cada quadro. */
function ViewEffects({ l }: { l: Layout }) {
  useFrame(() => {
    const v = useStore.getState().view;
    let center: THREE.Vector3, ext: THREE.Vector3;
    const b = v.selected ? (v.selected === 'camara' ? new THREE.Box3(new THREE.Vector3(0, 0, -l.W / 2), new THREE.Vector3(l.L, l.H, l.W / 2)) : equipBox(l, v.selected)) : null;
    if (b) { center = b.getCenter(new THREE.Vector3()); ext = b.getSize(new THREE.Vector3()).multiplyScalar(0.5); }
    else { center = new THREE.Vector3((l.bounds.min[0] + l.bounds.max[0]) / 2, 0, 0); ext = new THREE.Vector3((l.bounds.max[0] - l.bounds.min[0]) / 2, l.bounds.max[1], l.bounds.max[2]); }
    if (v.cut === 'horizontal') { center.y = b ? b.min.y : 0; ext.y = b ? b.max.y - b.min.y : 7; }
    applyCut(v.cut, v.cutPos, center, ext);
    applyOpacity(v.opacity);
    applyTechnical(v.technical);
  });
  return null;
}

function CameraRig({ l, secondary }: { l: Layout; secondary: boolean }) {
  const ref = useRef<CameraControls>(null);
  const cam = useStore((s) => s.camera);
  const sel = useStore((s) => s.view.selected);
  const isolate = useStore((s) => s.view.isolate);
  const { camera, gl, scene, size } = useThree();
  useEffect(() => {
    const r = secondary ? sceneRefB : sceneRef;
    // o canvas antigo do R3F é desmontado de forma assíncrona: só limpa se ainda for o registrado
    return () => { if (r.gl === gl) { r.gl = null; r.scene = null; r.camera = null; } if (!secondary && primaryControls === ref.current) primaryControls = null; };
  }, [gl, secondary]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    const c = ref.current; if (!c) return;
    const mn = l.bounds.min, mx = l.bounds.max;
    c.setBoundary(new THREE.Box3(new THREE.Vector3(mn[0] - 60, 0.4, mn[2] - 60), new THREE.Vector3(mx[0] + 60, 80, mx[2] + 60)));
  }, [l]);
  useEffect(() => {
    const c = ref.current; if (!c) return;
    const p = cam.preset;
    const cx = (l.bounds.min[0] + l.bounds.max[0]) / 2;
    const asp = size.width / Math.max(1, size.height);
    const span = (l.bounds.max[0] - l.bounds.min[0]) * (asp < 1 ? Math.min(2.2, 0.85 / asp) : 1);
    if (p === 'geral') c.setLookAt(cx + span * 0.15, span * 0.45 + 8, span * 0.75 + 10, cx, 1.5, 0, true);
    else if (p === 'sala') c.setLookAt(-9, 4.2, 6.2, -9, 1.2, -2, true);
    else if (p === 'camara') c.setLookAt(Math.min(3, l.L * 0.2), Math.min(2.2, l.H * 0.5), l.W / 2 - 1.2, l.L * 0.6, l.H * 0.55, -l.W / 2, true);
    else if (p === 'topo') c.setLookAt(cx, span * 0.9 + 15, 0.1, cx, 0, 0, true);
    else if (p === 'lateral') c.setLookAt(cx, 4, span * 0.9 + 10, cx, 3, 0, true);
    else if (p === 'externa') c.setLookAt(-38, 10, 24, -12, 2, 0, true);
    else {
      const b = p === 'camara-externa' ? new THREE.Box3(new THREE.Vector3(0, 0, -l.W / 2), new THREE.Vector3(l.L, l.H, l.W / 2)) : equipBox(l, p);
      if (b) {
        const ctr = b.getCenter(new THREE.Vector3());
        const r = Math.max(3, b.getSize(new THREE.Vector3()).length() * 1.25);
        c.setLookAt(ctr.x + r * 0.7, ctr.y + r * 0.55, ctr.z + r * 1.0, ctr.x, ctr.y, ctr.z, true);
      }
    }
  }, [cam.nonce]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { if (isolate && sel) useStore.getState().goCamera(sel === 'camara' ? 'camara-externa' : sel); }, [isolate, sel]);
  // Tela inicial: órbita lenta da instalação ao fundo
  useFrame((_, dt) => {
    const st = useStore.getState();
    // registro por quadro: sempre aponta para o canvas vivo (robusto a remontagens e ao HMR)
    const r = secondary ? sceneRefB : sceneRef;
    r.gl = gl; r.scene = scene; r.camera = camera;
    if (!secondary && ref.current) primaryControls = ref.current;
    if (st.mode === 'home' && st.view.anim !== 'pausada' && ref.current) ref.current.azimuthAngle += dt * 0.05;
    // Vista dividida: a cena B acompanha a câmera da cena A
    if (secondary && st.view.syncCameras && primaryControls && ref.current) {
      primaryControls.getPosition(tmpP); primaryControls.getTarget(tmpT);
      ref.current.setLookAt(tmpP.x, tmpP.y, tmpP.z, tmpT.x, tmpT.y, tmpT.z, false);
    }
  });
  return <CameraControls ref={ref} makeDefault minDistance={1.2} maxDistance={220} maxPolarAngle={Math.PI * 0.495} dollyToCursor smoothTime={0.6} />;
}

const tmpP = new THREE.Vector3(), tmpT = new THREE.Vector3();

function Lights({ l }: { l: Layout }) {
  const q = useStore((s) => s.view.quality);
  const span = Math.max(40, l.bounds.max[0] - l.bounds.min[0]);
  return (
    <>
      <hemisphereLight args={['#eef5ff', '#8d97a2', 1.1]} />
      <directionalLight position={[span * 0.4, span * 0.8, span * 0.5]} intensity={1.6} castShadow={q === 'alta'}
        shadow-mapSize={[2048, 2048]} shadow-camera-left={-span} shadow-camera-right={span} shadow-camera-top={span} shadow-camera-bottom={-span} shadow-camera-far={span * 4} shadow-bias={-0.0004} />
      <directionalLight position={[-span * 0.5, span * 0.3, -span * 0.4]} intensity={0.45} />
      <pointLight position={[-9, 5.8, 0]} intensity={8} distance={14} color="#fff4e0" />
    </>
  );
}

export default function Scene({ project, side }: { project?: Project; side?: 'A' | 'B' }) {
  const active = useActiveProject();
  const p = project ?? active;
  const l = useMemo(() => computeLayout(p), [p]);
  const secondary = side === 'B';
  const q = useStore((s) => s.view.quality);
  const anim = useStore((s) => s.view.anim);
  const setView = useStore((s) => s.setView);
  const presentation = useStore((s) => s.presentation);
  return (
    <Canvas
      shadows={q === 'alta'}
      dpr={q === 'alta' ? [1, 2] : q === 'media' ? [1, 1.5] : 1}
      frameloop={anim === 'pausada' ? 'demand' : 'always'}
      gl={{ preserveDrawingBuffer: true, antialias: q !== 'baixa', localClippingEnabled: true } as any}
      camera={{ position: [10, 28, 45], fov: 45, near: 0.1, far: 800 }}
      onPointerMissed={() => setView({ selected: null })}
      onCreated={({ gl }) => { gl.localClippingEnabled = true; gl.setClearColor('#e8edf2'); }}
      className={presentation ? 'canvas presenting' : 'canvas'}
    >
      <fog attach="fog" args={['#e8edf2', 120, 420]} />
      <Suspense fallback={null}>
        <Lights l={l} />
        <Installation l={l} p={p} />
        <ViewEffects l={l} />
        <CameraRig l={l} secondary={secondary} />
      </Suspense>
    </Canvas>
  );
}
