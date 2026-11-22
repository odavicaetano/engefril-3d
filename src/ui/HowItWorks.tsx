import { useEffect, useState } from 'react';
import { useStore } from '../state/store';
import { infoFor } from '../data/equipment';
import { I } from './Icons';

/** Pequena animação explicativa: aplica corte, transparência e explosão em sequência, com legenda. */
export default function HowItWorks() {
  const id = useStore((s) => s.howItWorks);
  const s = useStore.getState;
  const [step, setStep] = useState(0);
  const info = infoFor(id);
  useEffect(() => {
    if (!id) return;
    setStep(0);
    s().setView({ selected: id, isolate: true, cut: 'nenhum', explode: 0, opacity: 1 });
    s().goCamera(id === 'camara' ? 'camara-externa' : id);
  }, [id]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (!id || !info) return;
    const h = info.how[step];
    if (!h) return;
    s().setView({ cut: h.cut ?? 'nenhum', explode: h.explode ?? 0, opacity: h.opacity ?? s().view.opacity });
    const t = setTimeout(() => step < info.how.length - 1 && setStep(step + 1), 5200);
    return () => clearTimeout(t);
  }, [id, step, info]); // eslint-disable-line react-hooks/exhaustive-deps
  if (!id || !info) return null;
  const close = () => { s().setHowItWorks(null); s().setView({ isolate: false, cut: 'nenhum', explode: 0, opacity: 1 }); };
  return (
    <div className="tour" role="dialog" aria-label="Como funciona">
      <div className="prog"><i style={{ width: `${((step + 1) / info.how.length) * 100}%` }} /></div>
      <h3>Como funciona: {info.name}</h3>
      <p>{info.how[step]?.text}</p>
      <div className="ctrl">
        <button className="ib" aria-label="Anterior" disabled={step === 0} onClick={() => setStep(step - 1)}><I.prev /></button>
        <button className="ib" aria-label="Próximo" disabled={step >= info.how.length - 1} onClick={() => setStep(step + 1)}><I.next /></button>
        <button className="ib" aria-label="Reiniciar" onClick={() => setStep(0)}><I.restart /></button>
        <span className="spacer" />
        <button className="btn sm" onClick={close}>Concluir</button>
      </div>
    </div>
  );
}
