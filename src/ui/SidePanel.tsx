import { useStore } from '../state/store';
import { I } from './Icons';
import Commercial from '../modes/commercial/Commercial';
import Learning from '../modes/learning/Learning';
import Technical from '../modes/technical/Technical';

const TITLES = { comercial: 'Pré-dimensionamento comercial', aprendizado: 'Como funciona a refrigeração', tecnico: 'Laboratório técnico' } as const;

export default function SidePanel() {
  const mode = useStore((s) => s.mode);
  const open = useStore((s) => s.menuOpen);
  const setOpen = useStore((s) => s.setMenuOpen);
  if (mode === 'home') return null;
  return (
    <>
      <aside className={`side ${open ? '' : 'closed'}`} aria-label="Menu lateral">
        <div className="side-head" onClick={() => innerWidth <= 820 && setOpen(!open)}>
          <h2>{TITLES[mode]}</h2>
          <button className="ib" aria-label={open ? 'Recolher menu' : 'Expandir menu'} onClick={(e) => { e.stopPropagation(); setOpen(!open); }}>{open ? <I.close /> : <I.menu />}</button>
        </div>
        <div className="side-body">
          {mode === 'comercial' && <Commercial />}
          {mode === 'aprendizado' && <Learning />}
          {mode === 'tecnico' && <Technical />}
        </div>
      </aside>
    </>
  );
}
