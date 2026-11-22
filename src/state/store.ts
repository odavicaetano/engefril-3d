import { create } from 'zustand';
import type { Project } from '../engine/types';
import type { Architecture } from '../engine/cycle';
import { DEMOS } from '../data/scenarios';

export type Mode = 'home' | 'comercial' | 'aprendizado' | 'tecnico';
export type CutMode = 'nenhum' | 'longitudinal' | 'transversal' | 'horizontal' | 'parcial';
export type Modal = null | 'sobre' | 'fontes' | 'controles' | 'glossario' | 'seguranca' | 'projetos' | 'molecular' | 'biblioteca' | 'exportar' | 'importarCad';

export interface ViewState {
  cut: CutMode; cutPos: number; opacity: number; explode: number; technical: boolean; hideBuilding: boolean;
  isolate: boolean; selected: string | null; anim: 'normal' | 'reduzida' | 'pausada'; flowSpeed: number;
  quality: 'alta' | 'media' | 'baixa'; split: boolean; syncCameras: boolean; showCadRef: boolean; showFlow: boolean; showHeat: boolean; showLabels: boolean; doorsOpen: boolean;
}
export interface TechParams { Te: number; Tc: number; superheat: number; subcool: number; etaIs: number; etaMotor: number; architecture: Architecture; capacity: number; pUnit: 'kPa' | 'bar'; tUnit: 'C' | 'K'; fromProject: boolean }

interface Store {
  mode: Mode; setMode: (m: Mode) => void;
  project: Project; past: Project[]; future: Project[]; lastTag: string; lastTime: number;
  update: (fn: (p: Project) => void, tag?: string) => void; setProject: (p: Project) => void; undo: () => void; redo: () => void;
  scenarioB: Project | null; setScenarioB: (p: Project | null) => void; updateB: (fn: (p: Project) => void) => void; editing: 'A' | 'B'; setEditing: (e: 'A' | 'B') => void;
  view: ViewState; setView: (v: Partial<ViewState>) => void; resetView: () => void;
  camera: { preset: string; nonce: number }; goCamera: (preset: string) => void;
  tech: TechParams; setTech: (t: Partial<TechParams>) => void;
  modal: Modal; setModal: (m: Modal) => void;
  menuOpen: boolean; setMenuOpen: (b: boolean) => void;
  presentation: boolean; setPresentation: (b: boolean) => void;
  tour: { active: boolean; step: number; playing: boolean; speed: number; narrate: boolean; kind: 'ciclo' | 'equipamentos' };
  setTour: (t: Partial<Store['tour']>) => void;
  howItWorks: string | null; setHowItWorks: (id: string | null) => void;
  toast: string | null; showToast: (s: string) => void;
}

export const DEFAULT_VIEW: ViewState = {
  cut: 'nenhum', cutPos: 0, opacity: 1, explode: 0, technical: false, hideBuilding: false, isolate: false, selected: null,
  anim: 'normal', flowSpeed: 1, quality: 'alta', split: false, syncCameras: true, showCadRef: true, showFlow: true, showHeat: true, showLabels: true, doorsOpen: false,
};

function initialProject(): Project {
  try {
    const hash = location.hash.startsWith('#cenario=') ? location.hash.slice(9) : '';
    if (hash) return JSON.parse(decodeURIComponent(escape(atob(hash))));
  } catch { /* link inválido: segue com demo */ }
  return DEMOS[0].build();
}
const lowEnd = typeof navigator !== 'undefined' && ((navigator as any).deviceMemory <= 4 || /Mobi|Android/i.test(navigator.userAgent));
const reduced = typeof matchMedia !== 'undefined' && matchMedia('(prefers-reduced-motion: reduce)').matches;

export const useStore = create<Store>((set, get) => ({
  mode: 'home',
  setMode: (mode) => set({ mode, tour: { ...get().tour, active: false, playing: false } }),
  project: initialProject(), past: [], future: [], lastTag: '', lastTime: 0,
  update: (fn, tag = '') => {
    const s = get();
    if (s.editing === 'B' && s.scenarioB) return s.updateB(fn);
    const next = structuredClone(s.project);
    fn(next);
    const now = Date.now();
    const coalesce = tag && tag === s.lastTag && now - s.lastTime < 800;
    set({ project: next, past: coalesce ? s.past : [...s.past.slice(-60), s.project], future: [], lastTag: tag, lastTime: now });
  },
  setProject: (p) => set((s) => ({ project: p, past: [...s.past.slice(-60), s.project], future: [], lastTag: '' })),
  undo: () => set((s) => (s.past.length ? { project: s.past[s.past.length - 1], past: s.past.slice(0, -1), future: [s.project, ...s.future], lastTag: '' } : {})),
  redo: () => set((s) => (s.future.length ? { project: s.future[0], future: s.future.slice(1), past: [...s.past, s.project], lastTag: '' } : {})),
  scenarioB: null, setScenarioB: (p) => set((s) => ({ scenarioB: p, editing: p ? s.editing : 'A', view: p ? s.view : { ...s.view, split: false } })),
  updateB: (fn) => { const b = get().scenarioB; if (!b) return; const n = structuredClone(b); fn(n); set({ scenarioB: n }); },
  editing: 'A', setEditing: (editing) => set({ editing }),
  view: { ...DEFAULT_VIEW, quality: lowEnd ? 'media' : 'alta', anim: reduced ? 'reduzida' : 'normal', showLabels: typeof innerWidth === 'undefined' || innerWidth > 820 },
  setView: (v) => set((s) => ({ view: { ...s.view, ...v } })),
  resetView: () => set((s) => ({ view: { ...DEFAULT_VIEW, quality: s.view.quality, anim: s.view.anim, split: s.view.split, syncCameras: s.view.syncCameras, showLabels: s.view.showLabels }, camera: { preset: 'geral', nonce: s.camera.nonce + 1 } })),
  camera: { preset: 'geral', nonce: 0 },
  goCamera: (preset) => set((s) => ({ camera: { preset, nonce: s.camera.nonce + 1 } })),
  tech: { Te: -10, Tc: 35, superheat: 2, subcool: 3, etaIs: 0.75, etaMotor: 0.94, architecture: 'bombeado', capacity: 100, pUnit: 'kPa', tUnit: 'C', fromProject: false },
  setTech: (t) => set((s) => ({ tech: { ...s.tech, ...t } })),
  modal: null, setModal: (modal) => set({ modal }),
  menuOpen: true, setMenuOpen: (menuOpen) => set({ menuOpen }),
  presentation: false, setPresentation: (presentation) => set({ presentation }),
  tour: { active: false, step: 0, playing: false, speed: 1, narrate: false, kind: 'ciclo' },
  setTour: (t) => set((s) => ({ tour: { ...s.tour, ...t } })),
  howItWorks: null, setHowItWorks: (howItWorks) => set({ howItWorks }),
  toast: null,
  showToast: (toast) => { set({ toast }); setTimeout(() => get().toast === toast && set({ toast: null }), 3500); },
}));

if (import.meta.env.DEV) (window as any).__store = useStore; // inspeção em desenvolvimento

/** Projeto ativo para edição (A ou B). */
export const useActiveProject = () => useStore((s) => (s.editing === 'B' && s.scenarioB ? s.scenarioB : s.project));

// ---- Persistência local de projetos
const KEY = 'engefril3d.projetos';
export interface Saved { id: string; name: string; date: string; project: Project }
export const listSaved = (): Saved[] => { try { return JSON.parse(localStorage.getItem(KEY) || '[]'); } catch { return []; } };
export const saveProject = (p: Project) => {
  const all = listSaved().filter((x) => x.name !== p.name);
  all.unshift({ id: Date.now().toString(36), name: p.name, date: new Date().toLocaleString('pt-BR'), project: p });
  localStorage.setItem(KEY, JSON.stringify(all.slice(0, 30)));
};
export const deleteSaved = (id: string) => localStorage.setItem(KEY, JSON.stringify(listSaved().filter((x) => x.id !== id)));
export const shareLink = (p: Project) => `${location.origin}${location.pathname}#cenario=${btoa(unescape(encodeURIComponent(JSON.stringify(p))))}`;
