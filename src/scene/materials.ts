/**
 * Materiais compartilhados com planos de corte. As faces internas expostas pelo corte recebem uma cor de
 * "seção" (tampa), via gl_FrontFacing. O sólido cortado parece fechado, sem superfícies abertas.
 */
import * as THREE from 'three';

export const clipPlanes = [new THREE.Plane(new THREE.Vector3(0, -1, 0), 1e6), new THREE.Plane(new THREE.Vector3(0, -1, 0), 1e6)];
const all: THREE.Material[] = [];
const shells: THREE.MeshStandardMaterial[] = [];

function withCap(m: THREE.MeshStandardMaterial, cap: string) {
  const capColor = new THREE.Color(cap);
  m.side = THREE.DoubleSide;
  m.clippingPlanes = clipPlanes;
  m.clipShadows = true;
  m.onBeforeCompile = (sh) => {
    sh.uniforms.capColor = { value: capColor };
    sh.fragmentShader = sh.fragmentShader
      .replace('void main() {', 'uniform vec3 capColor;\nvoid main() {')
      .replace('#include <dithering_fragment>', '#include <dithering_fragment>\n if (!gl_FrontFacing) { gl_FragColor = vec4(capColor * 0.9, 1.0); }');
  };
  m.customProgramCacheKey = () => 'cap' + cap;
  all.push(m);
  return m;
}
function mat(color: string, opts: THREE.MeshStandardMaterialParameters = {}, cap = '#c9d3dd', shell = false) {
  const m = withCap(new THREE.MeshStandardMaterial({ color, roughness: 0.55, metalness: 0.2, ...opts }), cap);
  if (shell) shells.push(m);
  return m;
}

export const M = {
  steel: mat('#9aa6b2', { metalness: 0.6, roughness: 0.35 }, '#b8c2cc', true),
  galv: mat('#c3ccd4', { metalness: 0.5, roughness: 0.4 }, '#dfe5ea', true),
  painted: mat('#e9edf1', { roughness: 0.6 }, '#cfd8e0', true),
  blue: mat('#0069ae', { roughness: 0.45 }, '#5f9fcb', true),
  darkBlue: mat('#163a5c', { roughness: 0.5 }, '#4a6c8c', true),
  graphite: mat('#3f454c', { roughness: 0.6 }, '#6c747c', true),
  vessel: mat('#d8dde2', { metalness: 0.35, roughness: 0.4 }, '#f1c27d', true),
  frp: mat('#dfe6ec', { roughness: 0.7 }, '#bcc8d2', true),
  panel: mat('#f4f6f8', { roughness: 0.7 }, '#f2e6a6', true), // núcleo EPS visível no corte
  floor: mat('#8c939a', { roughness: 0.9 }, '#6d747b'),
  concrete: mat('#b9bec3', { roughness: 0.95 }, '#9aa0a6', true),
  copper: mat('#c9874b', { metalness: 0.7, roughness: 0.35 }, '#a76a35'),
  stainless: mat('#cfd6dc', { metalness: 0.8, roughness: 0.25 }, '#e1e6ea'),
  fin: mat('#d7dde2', { metalness: 0.6, roughness: 0.4 }, '#d7dde2'),
  rotorM: mat('#7c8794', { metalness: 0.8, roughness: 0.3 }, '#a8b2bd'),
  rotorF: mat('#5f6b78', { metalness: 0.8, roughness: 0.3 }, '#8e99a5'),
  rubber: mat('#2a2e33', { roughness: 0.9 }, '#2a2e33'),
  insulation: mat('#f7f7f2', { roughness: 0.85 }, '#e7e2c6'),
  nh3Liquid: mat('#1f6fd1', { roughness: 0.2, transparent: true, opacity: 0.85 }, '#1f6fd1'),
  nh3Vapor: mat('#8fd3f4', { roughness: 0.2, transparent: true, opacity: 0.35 }, '#8fd3f4'),
  water: mat('#5fb4e8', { roughness: 0.1, transparent: true, opacity: 0.55 }, '#5fb4e8'),
  ice: mat('#e8f6ff', { roughness: 0.2, transparent: true, opacity: 0.8 }, '#e8f6ff'),
  oil: mat('#b9892f', { roughness: 0.2, transparent: true, opacity: 0.85 }, '#b9892f'),
  alert: mat('#f2b705', { emissive: '#7a5c00', emissiveIntensity: 0.4 }, '#f2b705'),
  screen: mat('#0e2a44', { emissive: '#0a6bc2', emissiveIntensity: 0.6 }, '#0e2a44'),
  glass: mat('#cfe8ff', { transparent: true, opacity: 0.25, roughness: 0.05 }, '#cfe8ff'),
};

/** Registra um material avulso (ex.: partículas) para respeitar os planos de corte. */
export function clipped<T extends THREE.Material>(m: T): T {
  m.clippingPlanes = clipPlanes;
  m.clipIntersection = lastIntersect;
  all.push(m);
  return m;
}

const lineMats = new Map<string, THREE.MeshStandardMaterial>();
export function lineMat(color: string) {
  let m = lineMats.get(color);
  if (!m) { m = mat(color, { roughness: 0.4, metalness: 0.2 }, color); lineMats.set(color, m); }
  return m;
}

let lastIntersect = false;
/** Aplica o corte: modo, posição e centro (do equipamento selecionado ou da cena). */
export function applyCut(mode: string, pos: number, center: THREE.Vector3, extent: THREE.Vector3) {
  const [a, b] = clipPlanes;
  const off = { normal: new THREE.Vector3(0, -1, 0), c: 1e6 };
  const intersect = mode === 'parcial';
  if (mode === 'longitudinal') { a.normal.set(0, 0, -1); a.constant = center.z + pos * extent.z; }
  else if (mode === 'transversal') { a.normal.set(-1, 0, 0); a.constant = center.x + pos * extent.x; }
  else if (mode === 'horizontal') { a.normal.set(0, -1, 0); a.constant = center.y + (pos * 0.5 + 0.5) * extent.y * 0.95 + 0.02; }
  else if (mode === 'parcial') {
    // remove um quadrante (canto frontal-direito) do conjunto
    a.normal.set(1, 0, 0); a.constant = -(center.x + pos * extent.x);
    b.normal.set(0, 0, 1); b.constant = -center.z;
  } else { a.normal.copy(off.normal); a.constant = off.c; }
  if (!intersect) { b.normal.copy(off.normal); b.constant = off.c; }
  for (const m of all) m.clipIntersection = intersect;
  if (intersect !== lastIntersect) { all.forEach((m) => (m.needsUpdate = true)); lastIntersect = intersect; }
}

let lastOpacity = 1;
export function applyOpacity(o: number) {
  if (o === lastOpacity) return;
  const t = o < 0.999;
  for (const m of shells) {
    const changed = m.transparent !== t;
    m.transparent = t; m.opacity = o; m.depthWrite = !t;
    if (changed) m.needsUpdate = true;
  }
  lastOpacity = o;
}
let lastWire = false;
export function applyTechnical(on: boolean) {
  if (on === lastWire) return;
  for (const m of shells) m.wireframe = on;
  lastWire = on;
}
