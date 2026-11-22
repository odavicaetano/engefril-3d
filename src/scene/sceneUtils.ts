import { useMemo } from 'react';
import type { WebGLRenderer, Scene, Camera } from 'three';
import { useActiveProject } from '../state/store';
import { computeLayout, type Layout } from './layout';

/** Referências da cena ativa, para captura de imagem sem acoplar a interface ao módulo 3D (carregado sob demanda). */
export const sceneRef: { gl: WebGLRenderer | null; scene: Scene | null; camera: Camera | null } = { gl: null, scene: null, camera: null };

/** Cena do cenário B na vista dividida. */
export const sceneRefB: typeof sceneRef = { gl: null, scene: null, camera: null };

export function captureScene(side: 'A' | 'B' = 'A'): string | null {
  const { gl, scene, camera } = side === 'B' ? sceneRefB : sceneRef;
  if (!gl || !scene || !camera) return null;
  gl.render(scene, camera);
  return gl.domElement.toDataURL('image/png');
}

export function useLayout(): Layout {
  const p = useActiveProject();
  return useMemo(() => computeLayout(p), [p]);
}

if (import.meta.env.DEV) (window as any).__sceneRefs = { sceneRef, sceneRefB, captureScene };

