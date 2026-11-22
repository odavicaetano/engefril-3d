import { useEffect, useMemo, useRef } from 'react';
import { useStore } from '../../state/store';
import { useEvaluation } from '../../state/useEvaluation';
import { cycleTour, LINE_INFO } from '../../scene/layout';
import { useLayout } from '../../scene/sceneUtils';
import { I } from '../../ui/Icons';
import { fmt } from '../../ui/common';

/** Reprodução automática do circuito frigorífico: câmera, destaque, fluxo e estados termodinâmicos sincronizados. */
export default function TourOverlay() {
  const tour = useStore((s) => s.tour);
  const setTour = useStore((s) => s.setTour);
  const l = useLayout();
  const ev = useEvaluation();
  const stops = useMemo(() => cycleTour(l), [l]);
  const stop = stops[Math.min(tour.step, stops.length - 1)];
  const timer = useRef<number>(0);

  useEffect(() => {
    if (!tour.active || !stop) return;
    const s = useStore.getState();
    s.setView({ selected: stop.target, showFlow: true, isolate: false });
    s.goCamera(stop.target);
    if (tour.narrate && 'speechSynthesis' in window) {
      speechSynthesis.cancel();
      const u = new SpeechSynthesisUtterance(stop.title.replace(/^\d+\.\s*/, '') + '. ' + stop.text);
      u.lang = 'pt-BR'; u.rate = Math.min(1.6, 0.95 * tour.speed);
      const v = speechSynthesis.getVoices().find((x) => x.lang.startsWith('pt'));
      if (v) u.voice = v;
      speechSynthesis.speak(u);
    }
  }, [tour.active, tour.step, stop?.target, tour.narrate]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    clearTimeout(timer.current);
    if (!tour.active || !tour.playing) return;
    const dur = (6500 + (stop?.text.length ?? 0) * 35) / tour.speed;
    timer.current = window.setTimeout(() => {
      if (tour.step < stops.length - 1) setTour({ step: tour.step + 1 });
      else setTour({ playing: false });
    }, dur);
    return () => clearTimeout(timer.current);
  }, [tour.active, tour.playing, tour.step, tour.speed, stops.length]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => () => { if ('speechSynthesis' in window) speechSynthesis.cancel(); }, []);
  if (!tour.active || !stop) return null;
  const close = () => { setTour({ active: false, playing: false }); if ('speechSynthesis' in window) speechSynthesis.cancel(); useStore.getState().setView({ selected: null }); };
  const st = Object.fromEntries(ev.cycle.states.map((s) => [s.id, s]));
  const phase = (x: number | null, ph: string) => (ph === 'bifasico' ? `mistura (título ${fmt((x ?? 0) * 100, 0)}% vapor)` : ph === 'liquido' ? 'líquido' : 'vapor');
  return (
    <div className="tour" role="region" aria-live="polite" aria-label="Tour guiado do ciclo frigorífico">
      <div className="prog"><i style={{ width: `${((tour.step + 1) / stops.length) * 100}%` }} /></div>
      <h3>{stop.title}</h3>
      <p>{stop.text}</p>
      {stop.stateIds && !ev.cycle.errors.length && (
        <div className="state-pills">
          {stop.stateIds.map((id) => st[id] && <span key={id}><b>{id}</b>: {fmt(st[id].P / 100, 2)} bar · {fmt(st[id].T, 0)} °C · {phase(st[id].x, st[id].phase)}</span>)}
          {stop.stateIds.join() === '4,1' && <span>Calor absorvido: {fmt(ev.cycle.qe, 0)} kJ por kg de NH₃</span>}
          {stop.stateIds.join() === '1,2' && <span>Trabalho de compressão: {fmt(ev.cycle.W / Math.max(1e-9, ev.cycle.mdot), 0)} kJ/kg</span>}
          {stop.stateIds.join() === '2,3' && <span>Calor rejeitado: {fmt(ev.cycle.Qc, 0)} kW</span>}
        </div>
      )}
      {stop.line && <div className="small" style={{ marginBottom: 8, color: '#9fb3c8' }}><i style={{ display: 'inline-block', width: 14, height: 6, borderRadius: 3, background: LINE_INFO[stop.line].color, marginRight: 6 }} />{LINE_INFO[stop.line].name}</div>}
      <div className="ctrl">
        <button className="ib" aria-label="Anterior" disabled={tour.step === 0} onClick={() => setTour({ step: tour.step - 1 })}><I.prev /></button>
        <button className="ib" aria-label={tour.playing ? 'Pausar' : 'Continuar'} onClick={() => setTour({ playing: !tour.playing })}>{tour.playing ? <I.pause /> : <I.play />}</button>
        <button className="ib" aria-label="Próximo" disabled={tour.step >= stops.length - 1} onClick={() => setTour({ step: tour.step + 1 })}><I.next /></button>
        <button className="ib" aria-label="Reiniciar" onClick={() => setTour({ step: 0, playing: true })}><I.restart /></button>
        <select aria-label="Velocidade" value={tour.speed} onChange={(e) => setTour({ speed: Number(e.target.value) })} style={{ background: 'transparent', color: '#fff', border: '1px solid rgba(255,255,255,.3)', borderRadius: 6, padding: '3px 4px' }}>
          {[0.5, 0.75, 1, 1.5, 2].map((v) => <option key={v} value={v} style={{ color: '#000' }}>{v}×</option>)}
        </select>
        <button className={`ib ${tour.narrate ? 'on' : ''}`} aria-label="Narração" title="Narração em português (voz do navegador)" onClick={() => setTour({ narrate: !tour.narrate })}>{tour.narrate ? <I.speaker /> : <I.volumeOff />}</button>
        <span className="spacer" />
        <span className="small" style={{ color: '#9fb3c8' }}>{tour.step + 1}/{stops.length}</span>
        <button className="btn sm" onClick={close}>Encerrar</button>
      </div>
    </div>
  );
}
