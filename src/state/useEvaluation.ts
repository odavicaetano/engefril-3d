import { useMemo } from 'react';
import { evaluate, type Evaluation } from '../engine/analysis';
import { computeCycle, type CycleResult } from '../engine/cycle';
import type { Project } from '../engine/types';
import { useActiveProject, useStore } from './store';

const cache = new WeakMap<Project, Evaluation>();
export function evalCached(p: Project): Evaluation {
  let e = cache.get(p);
  if (!e) { e = evaluate(p); cache.set(p, e); }
  return e;
}
export const useEvaluation = () => { const p = useActiveProject(); return useMemo(() => evalCached(p), [p]); };
export const useEvaluationA = () => { const p = useStore((s) => s.project); return useMemo(() => evalCached(p), [p]); };

/** Ciclo exibido no modo técnico: parâmetros livres do laboratório ou condições do projeto. */
export function useTechCycle(): CycleResult {
  const t = useStore((s) => s.tech);
  const ev = useEvaluationA();
  return useMemo(() => {
    if (t.fromProject) return ev.cycle;
    return computeCycle({ Te: t.Te, Tc: t.Tc, superheat: t.superheat, subcool: t.subcool, etaIs: t.etaIs, etaMotor: t.etaMotor, architecture: t.architecture, capacity: t.capacity });
  }, [t, ev]);
}
