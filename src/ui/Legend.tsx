import { useState } from 'react';
import { LINE_INFO } from '../scene/layout';
import { useLayout } from '../scene/sceneUtils';

export default function Legend() {
  const l = useLayout();
  const [open, setOpen] = useState(true);
  const kinds = [...new Set(l.routes.map((r) => r.kind))];
  return (
    <div className="legend" aria-label="Legenda de cores">
      <div style={{ justifyContent: 'space-between', cursor: 'pointer' }} onClick={() => setOpen(!open)}><b>Legenda</b><span className="muted">{open ? '–' : '+'}</span></div>
      {open && <>
        {kinds.map((k) => <div key={k}><i style={{ background: LINE_INFO[k].color }} />{LINE_INFO[k].name}</div>)}
        <div><i style={{ background: 'linear-gradient(90deg,#ffb070,#7cc8ff)' }} />Ar: quente → frio</div>
        <div><i style={{ background: '#ff6a3d' }} />Calor entrando ou rejeitado</div>
        <div className="note">As cores são recursos de visualização: a amônia é incolor. Partículas maiores representam líquido; as menores e translúcidas, vapor. Faixas coloridas sobre o isolamento identificam a linha.</div>
      </>}
    </div>
  );
}
