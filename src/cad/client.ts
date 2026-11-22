/** Cliente do worker de leitura CAD, com tempo limite e cancelamento. */
import type { CadModel } from './model';
import { LIMITS, detectCad, type Detection } from './model';

export interface ReadJob { promise: Promise<CadModel>; cancel: () => void }

export async function sniff(file: File): Promise<{ det: Detection; bytes: ArrayBuffer }> {
  const bytes = await file.arrayBuffer();
  return { det: detectCad(file.name, new Uint8Array(bytes)), bytes };
}

export function readInWorker(name: string, bytes: ArrayBuffer, onProgress: (s: string) => void): ReadJob {
  const worker = new Worker(new URL('./cad.worker.ts', import.meta.url), { type: 'module' });
  let timer = 0;
  const cancel = () => { clearTimeout(timer); worker.terminate(); };
  const promise = new Promise<CadModel>((resolve, reject) => {
    timer = window.setTimeout(() => { cancel(); reject(new Error(`Tempo limite de ${LIMITS.timeoutMs / 1000} s excedido: o desenho é grande ou complexo demais para o navegador. Simplifique-o (camadas, blocos) ou exporte só a planta.`)); }, LIMITS.timeoutMs);
    worker.onmessage = (e) => {
      const m = e.data;
      if (m.type === 'progress') onProgress(m.step);
      else if (m.type === 'done') { cancel(); resolve(m.model); }
      else if (m.type === 'error') { cancel(); reject(new Error(m.message)); }
    };
    worker.onerror = (e) => { cancel(); reject(new Error(e.message || 'Falha no leitor CAD.')); };
    worker.postMessage({ name, bytes }, [bytes]);
  });
  return { promise, cancel };
}
