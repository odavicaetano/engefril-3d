import * as THREE from 'three';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { OrbitControls, Html } from '@react-three/drei';
import { useStore } from '../../state/store';
import { satT, statePh, tSat } from '../../engine/r717';
import { Slider, fmt } from '../../ui/common';
import { I } from '../../ui/Icons';

// Geometria do NH3: ligação N–H de 1,012 Å e ângulo H–N–H de 106,7° (piramidal trigonal)
const ALPHA = Math.acos(Math.sqrt((1 + 2 * Math.cos((106.7 * Math.PI) / 180)) / 3));
const H_DIRS = [0, 1, 2].map((i) => new THREE.Vector3(Math.sin(ALPHA) * Math.cos((i * 2 * Math.PI) / 3), -Math.cos(ALPHA), Math.sin(ALPHA) * Math.sin((i * 2 * Math.PI) / 3)));

type Proc = 'livre' | 'evaporador' | 'compressor' | 'condensador' | 'expansao';
const PROCS: Record<Proc, { name: string; text: string }> = {
  livre: { name: 'Exploração livre', text: 'Escolha a pressão e a energia (entalpia) da amônia. O estado (líquido, mistura ou vapor) e a temperatura vêm das tabelas termodinâmicas.' },
  evaporador: { name: 'Evaporador', text: 'Em pressão baixa e constante, a amônia recebe calor do ar. A temperatura não muda enquanto há líquido: a energia é usada para separar as moléculas (calor latente) e a fração de vapor cresce.' },
  compressor: { name: 'Compressor', text: 'O vapor é comprimido: a pressão sobe e, com o trabalho recebido, as moléculas passam a se mover mais rápido (temperatura maior).' },
  condensador: { name: 'Condensador', text: 'Em alta pressão, o vapor perde calor para a água e o ar. Primeiro esfria e depois condensa: as moléculas se reaproximam e liberam calor latente.' },
  expansao: { name: 'Expansão', text: 'Ao passar pela válvula, a pressão cai bruscamente sem troca de calor (entalpia constante). Parte do líquido vaporiza instantaneamente (flash) e a mistura esfria até a nova temperatura de saturação.' },
};

export default function Molecular() {
  const setModal = useStore((s) => s.setModal);
  const [view, setView] = useState<'molecula' | 'fases'>('molecula');
  const [P, setP] = useState(290); // kPa (≈ −10 °C)
  const [h, setH] = useState(800);
  const [proc, setProc] = useState<Proc>('livre');
  const [t, setT] = useState(0);
  // percursos dos processos (−10 °C / 35 °C)
  const pe = satT(-10).P, pc = satT(35).P;
  useEffect(() => {
    if (proc === 'livre') return;
    setView('fases');
    let raf = 0, start = performance.now();
    const loop = (now: number) => {
      const k = Math.min(1, (now - start) / 9000);
      setT(k);
      const sE = satT(-10), sC = satT(35);
      if (proc === 'evaporador') { setP(pe); setH(sC.hL + (sE.hV + 10 - sC.hL) * k); }
      if (proc === 'compressor') { setP(pe + (pc - pe) * k); setH(sE.hV + 10 + 260 * k); }
      if (proc === 'condensador') { setP(pc); setH(sE.hV + 270 - (sE.hV + 270 - sC.hL + 5) * k); }
      if (proc === 'expansao') { setP(pc - (pc - pe) * k); setH(sC.hL); }
      if (k < 1) raf = requestAnimationFrame(loop); else { start = now; raf = requestAnimationFrame(loop); }
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [proc]); // eslint-disable-line react-hooks/exhaustive-deps
  const st = useMemo(() => { try { return statePh(P, h); } catch { return null; } }, [P, h]);
  const x = st ? (st.phase === 'bifasico' ? st.x! : st.phase === 'vapor' ? 1 : 0) : 0;
  return (
    <div className="mol" role="dialog" aria-label="Visualização molecular">
      <Canvas camera={{ position: [0, 1.5, 7], fov: 45 }}>
        <ambientLight intensity={0.6} /><directionalLight position={[4, 6, 5]} intensity={1.4} /><pointLight position={[-4, -2, 3]} intensity={10} color="#4db0ff" />
        {view === 'molecula' ? <Molecule /> : <PhaseBox x={x} T={st?.T ?? 0} />}
        <OrbitControls enablePan={false} minDistance={3} maxDistance={14} />
      </Canvas>
      <div className="mol-panel">
        <h3 style={{ marginBottom: 6 }}>Amônia em escala molecular</h3>
        <div className="btns" style={{ marginBottom: 8 }}>
          <button className={`btn sm ${view === 'molecula' ? 'primary' : ''}`} onClick={() => { setView('molecula'); setProc('livre'); }}>Molécula NH₃</button>
          <button className={`btn sm ${view === 'fases' ? 'primary' : ''}`} onClick={() => setView('fases')}>Líquido e vapor</button>
        </div>
        {view === 'molecula' ? (
          <div className="small">
            <p>Um átomo de <b style={{ color: '#5b8cff' }}>nitrogênio</b> ligado a três de <b>hidrogênio</b>, em geometria <b>piramidal trigonal</b>: ângulo H–N–H ≈ 106,7° e ligação N–H ≈ 1,01 Å. O par de elétrons livre do nitrogênio (lobo translúcido) torna a molécula polar.</p>
            <p>Essa polaridade forma <b>ligações de hidrogênio</b> entre as moléculas, o que explica o calor latente elevado da amônia: é preciso muita energia para separá-las na vaporização. Esse é o motivo de a amônia ser um refrigerante tão eficiente.</p>
            <p className="muted">A vibração mostrada é ilustrativa.</p>
          </div>
        ) : (
          <div className="small">
            <div className="btns" style={{ marginBottom: 8 }}>{(Object.keys(PROCS) as Proc[]).map((k) => <button key={k} className={`btn sm ${proc === k ? 'primary' : ''}`} onClick={() => setProc(k)}>{PROCS[k].name}</button>)}</div>
            <p>{PROCS[proc].text}</p>
            {proc === 'livre' && <>
              <Slider label="Pressão" min={Math.log(50)} max={Math.log(2500)} step={0.01} value={Math.log(P)} onChange={(v) => setP(Math.exp(v))} format={() => `${fmt(P / 100, 2)} bar (saturação ${fmt(tSat(P), 1)} °C)`} />
              <Slider label="Energia da amônia (entalpia)" min={-50} max={1750} step={5} value={h} onChange={setH} format={(v) => `${fmt(v, 0)} kJ/kg`} />
            </>}
            {proc !== 'livre' && <div className="prog" style={{ height: 3, background: 'rgba(255,255,255,.2)', marginBottom: 8 }}><i style={{ display: 'block', height: '100%', width: `${t * 100}%`, background: '#4db0ff' }} /></div>}
            {st ? (
              <table className="t" style={{ color: '#e7eef6' }}><tbody>
                <tr><td>Estado</td><td><b>{st.phase === 'bifasico' ? `Mistura: ${fmt(x * 100, 0)}% vapor` : st.phase === 'vapor' ? 'Vapor' : 'Líquido'}</b></td></tr>
                <tr><td>Temperatura</td><td><b>{fmt(st.T, 1)} °C</b></td></tr>
                <tr><td>Pressão</td><td>{fmt(P / 100, 2)} bar abs</td></tr>
                <tr><td>Massa específica</td><td>{fmt(st.rho, 1)} kg/m³</td></tr>
              </tbody></table>
            ) : <p>Estado fora do domínio das tabelas.</p>}
            <p className="muted" style={{ marginTop: 8 }}><b>Movimento molecular</b> (agitação térmica, ligada à temperatura) é diferente do <b>escoamento</b> do refrigerante nos tubos, mostrado na cena principal, e da <b>transferência de calor</b>, que é energia passando do mais quente para o mais frio. As partículas são uma representação educativa, não uma simulação molecular quantitativa.</p>
          </div>
        )}
      </div>
      <button className="btn close" onClick={() => setModal(null)}><I.close /> Voltar à instalação</button>
    </div>
  );
}

function Molecule() {
  const g = useRef<THREE.Group>(null);
  useFrame(({ clock }) => { if (g.current) { g.current.rotation.y = clock.elapsedTime * 0.3; g.current.children.forEach((c, i) => i > 0 && i < 4 && c.position.copy(H_DIRS[i - 1]).multiplyScalar(1.6 + 0.05 * Math.sin(clock.elapsedTime * 12 + i))); } });
  return (
    <group ref={g}>
      <mesh><sphereGeometry args={[0.55, 40, 30]} /><meshStandardMaterial color="#3d6cf0" roughness={0.3} /></mesh>
      {H_DIRS.map((d, i) => <mesh key={i} position={d.clone().multiplyScalar(1.6)}><sphereGeometry args={[0.32, 32, 24]} /><meshStandardMaterial color="#f4f6f8" roughness={0.35} /></mesh>)}
      {H_DIRS.map((d, i) => {
        const q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), d);
        return <mesh key={'b' + i} position={d.clone().multiplyScalar(0.8)} quaternion={q}><cylinderGeometry args={[0.09, 0.09, 1.6, 16]} /><meshStandardMaterial color="#b8c2cc" /></mesh>;
      })}
      <mesh position={[0, 0.75, 0]} scale={[0.45, 0.7, 0.45]}><sphereGeometry args={[1, 24, 18]} /><meshStandardMaterial color="#9fd0f5" transparent opacity={0.25} /></mesh>
      <Html position={[0, 1.7, 0]} center><span className="scene-label">par de elétrons livre</span></Html>
      <Html position={[0.7, -0.1, 0]} center><span className="scene-label">N</span></Html>
      <Html position={[0, -1.9, 0]} center><span className="scene-label">106,7° · 1,01 Å</span></Html>
    </group>
  );
}

/** Caixa com moléculas: as do líquido ficam próximas e lentas no fundo; as do vapor, dispersas e rápidas. */
function PhaseBox({ x, T }: { x: number; T: number }) {
  const N = 140;
  const nRef = useRef<THREE.InstancedMesh>(null), hRef = useRef<THREE.InstancedMesh>(null);
  const mol = useMemo(() => Array.from({ length: N }, (_, i) => ({ p: new THREE.Vector3((Math.random() - 0.5) * 4, -1.6 + Math.random() * 0.8, (Math.random() - 0.5) * 2), v: new THREE.Vector3().randomDirection(), r: new THREE.Euler(Math.random() * 6, Math.random() * 6, 0), w: Math.random(), i })), []);
  const tmp = useMemo(() => new THREE.Object3D(), []);
  const hp = useMemo(() => new THREE.Vector3(), []);
  useFrame((_, dt) => {
    const nV = Math.round(x * N);
    const speed = Math.sqrt((T + 273.15) / 263) * 1.8;
    const liqTop = -1.6 + Math.max(0.25, (1 - x) * 0.9);
    mol.forEach((m, i) => {
      const isVapor = i < nV;
      if (isVapor) {
        m.p.addScaledVector(m.v, dt * speed);
        if (Math.abs(m.p.x) > 2) { m.v.x *= -1; m.p.x = Math.sign(m.p.x) * 2; }
        if (Math.abs(m.p.z) > 1) { m.v.z *= -1; m.p.z = Math.sign(m.p.z) * 1; }
        if (m.p.y > 1.6) { m.v.y = -Math.abs(m.v.y); }
        if (m.p.y < liqTop + 0.1) { m.v.y = Math.abs(m.v.y) + 0.2; m.p.y = Math.max(m.p.y, liqTop); }
      } else {
        m.p.x += (Math.random() - 0.5) * dt * speed * 0.6; m.p.z += (Math.random() - 0.5) * dt * speed * 0.6; m.p.y += (Math.random() - 0.5) * dt * speed * 0.6;
        m.p.x = THREE.MathUtils.clamp(m.p.x, -1.9, 1.9); m.p.z = THREE.MathUtils.clamp(m.p.z, -0.9, 0.9);
        if (m.p.y > liqTop) m.p.y -= dt * 2; if (m.p.y < -1.6) m.p.y = -1.6;
      }
      m.r.x += dt * speed * (isVapor ? 2 : 0.6); m.r.y += dt * speed * (isVapor ? 1.6 : 0.4);
      tmp.position.copy(m.p); tmp.rotation.copy(m.r); tmp.scale.setScalar(0.11); tmp.updateMatrix();
      nRef.current?.setMatrixAt(i, tmp.matrix);
      const rot = new THREE.Quaternion().setFromEuler(m.r);
      H_DIRS.forEach((d, k) => {
        hp.copy(d).applyQuaternion(rot).multiplyScalar(0.16).add(m.p);
        tmp.position.copy(hp); tmp.scale.setScalar(0.065); tmp.updateMatrix();
        hRef.current?.setMatrixAt(i * 3 + k, tmp.matrix);
      });
    });
    if (nRef.current) nRef.current.instanceMatrix.needsUpdate = true;
    if (hRef.current) hRef.current.instanceMatrix.needsUpdate = true;
  });
  return (
    <group>
      <mesh><boxGeometry args={[4.3, 3.5, 2.3]} /><meshStandardMaterial color="#9fd0f5" transparent opacity={0.06} side={THREE.BackSide} /></mesh>
      <lineSegments><edgesGeometry args={[new THREE.BoxGeometry(4.3, 3.5, 2.3)]} /><lineBasicMaterial color="#4db0ff" /></lineSegments>
      <instancedMesh ref={nRef} args={[undefined, undefined, N]}><sphereGeometry args={[1, 14, 10]} /><meshStandardMaterial color="#3d6cf0" /></instancedMesh>
      <instancedMesh ref={hRef} args={[undefined, undefined, N * 3]}><sphereGeometry args={[1, 10, 8]} /><meshStandardMaterial color="#f4f6f8" /></instancedMesh>
      <Html position={[0, 2.1, 0]} center><span className="scene-label">{x >= 1 ? 'vapor' : x <= 0 ? 'líquido' : `mistura: ${Math.round(x * 100)}% vapor (em massa)`}</span></Html>
    </group>
  );
}
