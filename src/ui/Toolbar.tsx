import { useState } from 'react';
import { useStore, type CutMode } from '../state/store';
import { I } from './Icons';
import { Check, Seg, Slider } from './common';
import { captureScene } from '../scene/sceneUtils';

type Pop = null | 'camera' | 'corte' | 'opacidade' | 'config';

export default function Toolbar() {
  const s = useStore();
  const v = s.view;
  const [pop, setPop] = useState<Pop>(null);
  const toggle = (p: Pop) => setPop(pop === p ? null : p);
  const snap = () => {
    const url = captureScene();
    if (!url) return;
    const a = document.createElement('a');
    a.href = url; a.download = `${s.project.name.replace(/[^\w-]+/g, '_')}_3d.png`; a.click();
    s.showToast('Imagem PNG da instalação gerada.');
  };
  const cuts: { value: CutMode; label: string }[] = [
    { value: 'nenhum', label: 'Vista externa completa' }, { value: 'longitudinal', label: 'Corte longitudinal' }, { value: 'transversal', label: 'Corte transversal' },
    { value: 'horizontal', label: 'Corte horizontal' }, { value: 'parcial', label: 'Corte parcial (quadrante)' },
  ];
  const cams = [
    ['geral', 'Visão geral'], ['sala', 'Dentro da sala de máquinas'], ['camara', 'Dentro da câmara'], ['externa', 'Área externa e condensador'],
    ['topo', 'Vista superior'], ['lateral', 'Vista lateral'], ['condensador', 'Condensador evaporativo'], ['compressor-1', 'Compressores'],
  ];
  if (s.presentation) return null;
  return (
    <>
      <div className="toolbar" role="toolbar" aria-label="Controles da cena 3D">
        {s.mode !== 'home' && !s.menuOpen && <button className="ib" data-tip="Abrir menu" aria-label="Abrir menu" onClick={() => s.setMenuOpen(true)}><I.menu /></button>}
        <button className={`ib ${pop === 'camera' ? 'on' : ''}`} data-tip="Câmera e perspectivas" aria-label="Câmera" onClick={() => toggle('camera')}><I.camera /></button>
        <button className={`ib ${v.cut !== 'nenhum' || pop === 'corte' ? 'on' : ''}`} data-tip="CORTE 3D" aria-label="Corte 3D" onClick={() => toggle('corte')}><I.cut /></button>
        <button className={`ib ${v.opacity < 1 || pop === 'opacidade' ? 'on' : ''}`} data-tip="Transparência" aria-label="Transparência" onClick={() => toggle('opacidade')}><I.opacity /></button>
        <button className={`ib ${v.explode > 0 ? 'on' : ''}`} data-tip="Vista explodida" aria-label="Vista explodida" onClick={() => s.setView({ explode: v.explode > 0 ? 0 : 1 })}><I.explode /></button>
        <button className={`ib ${v.technical ? 'on' : ''}`} data-tip="Vista técnica (aramado)" aria-label="Vista técnica" onClick={() => s.setView({ technical: !v.technical })}><I.tech /></button>
        <button className={`ib ${v.hideBuilding ? 'on' : ''}`} data-tip={v.hideBuilding ? 'Mostrar edificações' : 'Ocultar edificações'} aria-label="Ocultar estruturas" onClick={() => s.setView({ hideBuilding: !v.hideBuilding })}><I.building /></button>
        <button className={`ib ${v.isolate ? 'on' : ''}`} data-tip={v.selected ? 'Isolar equipamento selecionado' : 'Selecione um equipamento para isolar'} aria-label="Isolar" disabled={!v.selected} onClick={() => s.setView({ isolate: !v.isolate })}><I.isolate /></button>
        <span className="tool-sep" />
        <button className={`ib ${v.doorsOpen ? 'on' : ''}`} data-tip={v.doorsOpen ? 'Fechar portas' : 'Abrir portas'} aria-label="Abrir ou fechar portas" onClick={() => s.setView({ doorsOpen: !v.doorsOpen })}><I.door /></button>
        <button className={`ib ${v.showFlow ? 'on' : ''}`} data-tip="Fluxo de refrigerante" aria-label="Mostrar fluxo" onClick={() => s.setView({ showFlow: !v.showFlow })}><I.flow /></button>
        <button className={`ib ${v.showHeat ? 'on' : ''}`} data-tip="Calor e fluxo de ar" aria-label="Mostrar calor" onClick={() => s.setView({ showHeat: !v.showHeat })}><I.heat /></button>
        <button className="ib" data-tip={v.anim === 'pausada' ? 'Retomar animações' : 'Pausar animações'} aria-label="Pausar animações" onClick={() => s.setView({ anim: v.anim === 'pausada' ? 'normal' : 'pausada' })}>{v.anim === 'pausada' ? <I.play /> : <I.pause />}</button>
        <button className="ib" data-tip="Tour guiado pelo ciclo" aria-label="Tour guiado" onClick={() => { s.setTour({ active: true, step: 0, playing: true, kind: 'ciclo' }); }}><I.snow /></button>
        <span className="tool-sep" />
        <button className={`ib ${pop === 'config' ? 'on' : ''}`} data-tip="Configurações gráficas" aria-label="Configurações" onClick={() => toggle('config')}><I.settings /></button>
        {s.scenarioB && <button className={`ib ${v.split ? 'on' : ''}`} data-tip={v.split ? 'Voltar à vista única' : 'Comparar A e B lado a lado'} aria-label="Vista lado a lado" onClick={() => s.setView({ split: !v.split })}><I.compare /></button>}
        <button className="ib" data-tip="Capturar imagem PNG" aria-label="Capturar imagem" onClick={snap}><I.image /></button>
        <button className="ib" data-tip="Modo apresentação" aria-label="Modo apresentação" onClick={() => { s.setPresentation(true); document.documentElement.requestFullscreen?.().catch(() => {}); }}><I.present /></button>
        <button className="ib" data-tip="Restaurar visualização" aria-label="Restaurar visualização" onClick={() => { s.resetView(); setPop(null); }}><I.reset /></button>
      </div>
      {pop === 'camera' && (
        <div className="popover">
          <h4>Perspectivas</h4>
          <div className="btns">{cams.map(([id, l]) => <button key={id} className="btn sm" onClick={() => s.goCamera(id)}>{l}</button>)}</div>
          {v.split && <Check label="Sincronizar câmeras A e B" checked={v.syncCameras} onChange={(syncCameras) => s.setView({ syncCameras })} />}
          <p className="small muted" style={{ marginBottom: 0 }}>Mouse: arraste para girar, botão direito para mover, roda para zoom. Toque: um dedo gira, dois dedos aproximam e movem.</p>
        </div>
      )}
      {pop === 'corte' && (
        <div className="popover">
          <h4>CORTE 3D {v.selected ? <span className="small muted">· no equipamento selecionado</span> : <span className="small muted">· na instalação inteira</span>}</h4>
          <div className="btns" style={{ marginBottom: 10 }}>{cuts.map((c) => <button key={c.value} className={`btn sm ${v.cut === c.value ? 'primary' : ''}`} onClick={() => s.setView({ cut: c.value })}>{c.label}</button>)}</div>
          {v.cut !== 'nenhum' && <Slider label="Posição do plano" min={-1} max={1} step={0.02} value={v.cutPos} onChange={(cutPos) => s.setView({ cutPos })} format={(x) => `${Math.round(x * 100)}%`} />}
          <p className="small muted" style={{ margin: 0 }}>Planos de corte reais (clipping). As faces seccionadas aparecem preenchidas, sem superfícies abertas. Selecione um equipamento para cortá-lo pelo centro.</p>
        </div>
      )}
      {pop === 'opacidade' && (
        <div className="popover">
          <h4>Transparência das carcaças</h4>
          <Slider label="Opacidade" min={0.1} max={1} step={0.05} value={v.opacity} onChange={(opacity) => s.setView({ opacity })} format={(x) => `${Math.round(x * 100)}%`} />
          <Slider label="Vista explodida" min={0} max={1.5} step={0.05} value={v.explode} onChange={(explode) => s.setView({ explode })} format={(x) => `${Math.round(x * 100)}%`} />
        </div>
      )}
      {pop === 'config' && (
        <div className="popover">
          <h4>Gráficos e animações</h4>
          <div className="field"><span>Qualidade gráfica</span><Seg value={v.quality} onChange={(quality) => s.setView({ quality })} options={[{ value: 'alta', label: 'Alta' }, { value: 'media', label: 'Média' }, { value: 'baixa', label: 'Baixa' }]} /></div>
          <div className="field"><span>Animações</span><Seg value={v.anim} onChange={(anim) => s.setView({ anim })} options={[{ value: 'normal', label: 'Normais' }, { value: 'reduzida', label: 'Reduzidas' }, { value: 'pausada', label: 'Desativadas' }]} /></div>
          <Slider label="Velocidade do fluxo" min={0.2} max={3} step={0.1} value={v.flowSpeed} onChange={(flowSpeed) => s.setView({ flowSpeed })} format={(x) => `${x.toFixed(1)}×`} />
          <Check label="Rótulos dos equipamentos" checked={v.showLabels} onChange={(showLabels) => s.setView({ showLabels })} />
        </div>
      )}
    </>
  );
}
