/// <reference lib="webworker" />
/**
 * Leitura CAD isolada em Web Worker: o arquivo nunca sai do navegador, nada é executado (somente leitura),
 * e a thread principal encerra o worker se o tempo limite for excedido.
 */
// o pacote não exporta o .wasm no campo exports: importa-se pelo caminho de arquivo (o bundler copia com hash)
import wasmUrl from '../../node_modules/@mlightcad/libredwg-web/wasm/libredwg-web.wasm?url';
import { readCad } from './read';

self.onmessage = async (e: MessageEvent<{ name: string; bytes: ArrayBuffer }>) => {
  const { name, bytes } = e.data;
  const post = (m: unknown) => (self as unknown as DedicatedWorkerGlobalScope).postMessage(m);
  try {
    post({ type: 'progress', step: 'Lendo e interpretando o desenho…' });
    const model = await readCad(new Uint8Array(bytes), name, new URL(wasmUrl, self.location.href).href);
    post({ type: 'done', model });
  } catch (err) {
    post({ type: 'error', message: (err as Error).message || String(err) });
  }
};
