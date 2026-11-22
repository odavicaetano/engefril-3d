import { useRef, useState, type ReactNode } from 'react';
import { useStore, listSaved, deleteSaved, type Saved } from '../state/store';
import { SOURCES, ORIGIN_LABEL, type Origin } from '../data/sources';
import { GLOSSARY } from '../data/glossary';
import { SAFETY } from '../data/safety';
import { EQUIPMENT, ALTERNATIVES } from '../data/equipment';
import { DEMOS } from '../data/scenarios';
import { R717_META } from '../engine/r717';
import type { Project } from '../engine/types';
import { I } from './Icons';
import { OriginChip } from './common';
import ExportDialog from './ExportDialog';

function Shell({ title, children, wide }: { title: string; children: ReactNode; wide?: boolean }) {
  const close = useStore((s) => s.setModal);
  return (
    <div className="modal-bg" onClick={() => close(null)}>
      <div className={`modal ${wide ? 'wide' : ''}`} role="dialog" aria-modal aria-label={title} onClick={(e) => e.stopPropagation()}>
        <div className="modal-head"><h2>{title}</h2><button className="ib" aria-label="Fechar" onClick={() => close(null)}><I.close /></button></div>
        <div className="modal-body">{children}</div>
      </div>
    </div>
  );
}

export default function Modals() {
  const m = useStore((s) => s.modal);
  if (!m) return null;
  if (m === 'sobre') return <Shell title="Sobre a plataforma"><About /></Shell>;
  if (m === 'fontes') return <Shell title="Fontes e referências"><Sources /></Shell>;
  if (m === 'controles') return <Shell title="Controles e ajuda"><Controls /></Shell>;
  if (m === 'glossario') return <Shell title="Glossário técnico"><dl>{Object.values(GLOSSARY).map((g) => <div key={g.term} style={{ marginBottom: 10 }}><dt><b>{g.term}</b></dt><dd style={{ margin: '2px 0 0' }}>{g.def}{g.ex && <i className="muted"> Ex.: {g.ex}</i>}</dd></div>)}</dl></Shell>;
  if (m === 'seguranca') return <Shell title="Segurança em sistemas com amônia"><Safety /></Shell>;
  if (m === 'projetos') return <Shell title="Projetos, importação e exportação"><Projects /></Shell>;
  if (m === 'exportar') return <ExportDialog />;
  if (m === 'biblioteca') return <Shell title="Biblioteca de equipamentos e tecnologias" wide><Library /></Shell>;
  return null;
}

function About() {
  const setModal = useStore((s) => s.setModal);
  return (
    <div>
      <p><b>ENGEFRIL 3D</b> é um <b>protótipo demonstrativo</b> de visualização, ensino e pré-dimensionamento de refrigeração industrial por amônia (R717). Usa a Engefril (Santa Luzia, MG) como referência de equipamentos, aplicações e linguagem visual.</p>
      <div className="insight warn"><b>Sem vínculo oficial.</b> Esta plataforma não é um produto da Engefril, não tem parceria, aprovação nem endosso da empresa, e não emite propostas comerciais. O símbolo do floco de neve foi vetorizado do favicon público do site e é marca de seu titular; o uso em produção requer autorização. As fotografias oficiais não foram reproduzidas.</div>
      <h3>Origem de cada informação</h3>
      <div className="btns">{(Object.keys(ORIGIN_LABEL) as Origin[]).map((o) => <OriginChip key={o} o={o} />)}</div>
      <ul className="clean small">
        <li><b>Dado oficial Engefril</b>: transcrito das páginas públicas de engefril.com.br, consultadas em 22/11/2026.</li>
        <li><b>Referência técnica externa</b>: ASHRAE, IIAR, normas e literatura (valores típicos).</li>
        <li><b>Estimativa calculada</b>: resultado do motor de cálculo desta plataforma.</li>
        <li><b>Hipótese demonstrativa</b>: valor assumido por falta de dado e editável pelo usuário.</li>
      </ul>
      <h3>Síntese da pesquisa</h3>
      <ul className="clean small">
        <li>Equipamentos com especificação pública: evaporadores (tubos inox Ø15,87 mm, aletas com passo de 5, 8 e 11,2 mm), condensador evaporativo (serpentina galvanizada Ø25,4 mm ou inox Ø22,22 mm, PRFV), reservatório de amônia (ASME VIII Div. 1, NR-13), sistema chiller, tanque de água gelada de NH₃ (+1 a +2 °C), portas (correr, giratória, seccional, portinhola, Officedoor) e painel termoisolante (EPS de 15 kg/m³, chapas de 0,50 mm, classe R1).</li>
        <li>Itens apenas listados, sem especificação: separadores de líquido, depósitos de NH₃, máquinas de gelo, purgador de ar, desumidificador, quadro de válvulas, painel elétrico e extrator de ar.</li>
        <li><b>Não publicados:</b> capacidades (kW/TR), modelos, dimensões e preços. As tabelas de capacidade do condensador estão em imagem e não foram transcritas. Por isso o simulador indica <i>categorias</i> de equipamentos e nunca atribui capacidade a modelos.</li>
      </ul>
      <h3>Metodologia</h3>
      <ul className="clean small">
        <li>Propriedades do R717: tabelas geradas com {R717_META.source}, interpoladas e validadas por testes automáticos (erro de entalpia menor que 0,1%).</li>
        <li>Cargas térmicas: ASHRAE Refrigeration, cap. 24 (transmissão U·A·ΔT, infiltração por portas de Gosney & Olama com fatores Dt, Df e E, pessoas, iluminação, motores, ventiladores e degelo); produtos pelo cap. 19 (equações de Siebel).</li>
        <li>Psicrometria: ASHRAE Fundamentals, cap. 1 (Hyland & Wexler).</li>
        <li>Ciclos: simples (DX, gravidade, bombeado), duplo estágio com intercooler aberto e indireto com fluido secundário. A energia é verificada pelo balanço da 1ª lei.</li>
      </ul>
      <h3>Limitações</h3>
      <ul className="clean small">
        <li>Pré-dimensionamento em regime permanente na condição de projeto. Não substitui projeto executivo, seleção de catálogo, análise de risco nem a responsabilidade técnica de um profissional habilitado (ART).</li>
        <li>Consumo anual calculado na condição de verão (conservador); a condensação flutuante e a carga parcial não foram modeladas.</li>
        <li>Perdas de carga em tubulações estão representadas por penalidades equivalentes, e a inércia térmica não é modelada.</li>
        <li>As partículas e as cores são representações educativas.</li>
      </ul>
      <h3>Recursos que exigem conexão</h3>
      <p className="small">Depois da primeira visita, tudo funciona offline (PWA): cena 3D, cálculos, modo educativo e relatório PDF. Só os links para fontes externas exigem internet.</p>
      <button className="btn" onClick={() => setModal('fontes')}><I.book /> Ver todas as fontes</button>
    </div>
  );
}

function Sources() {
  return <div>{SOURCES.map((s) => <div key={s.id} className="card"><b>{s.title}</b>{s.url && <> · <a href={s.url} target="_blank" rel="noopener noreferrer">{s.url}</a></>}<div className="small muted">{s.note}</div></div>)}</div>;
}

function Controls() {
  return (
    <div className="small">
      <h3>Navegação 3D</h3>
      <ul className="clean">
        <li><b>Mouse:</b> arrastar com o botão esquerdo gira; o botão direito (ou Shift+arrastar) move; a roda aproxima e afasta.</li>
        <li><b>Toque:</b> um dedo gira; dois dedos aproximam e movem.</li>
        <li><b>Clique em um equipamento</b> para abrir o painel técnico; clique no vazio para desmarcar. <b>Esc</b> limpa a seleção.</li>
        <li>A câmera tem limites: não passa abaixo do piso nem se afasta demais.</li>
      </ul>
      <h3>Barra de ferramentas</h3>
      <ul className="clean">
        <li><b>Câmera:</b> perspectivas prontas, inclusive dentro da sala de máquinas e da câmara.</li>
        <li><b>Corte 3D:</b> longitudinal, transversal, horizontal e parcial, com posição ajustável.</li>
        <li><b>Transparência</b> e <b>vista explodida</b> das carcaças; <b>vista técnica</b> (aramado).</li>
        <li><b>Ocultar edificações</b> e <b>isolar</b> o equipamento selecionado.</li>
        <li><b>Portas</b>, <b>fluxo</b>, <b>calor</b>, pausa das animações, <b>tour guiado</b>, captura PNG, modo apresentação e restauração da vista.</li>
      </ul>
      <h3>Atalhos</h3>
      <ul className="clean"><li>Ctrl+Z / Ctrl+Y: desfazer e refazer alterações do projeto.</li><li>Esc: fechar diálogo, sair da apresentação ou limpar a seleção.</li></ul>
    </div>
  );
}

function Safety() {
  return (
    <div>
      <div className="insight warn">Conteúdo <b>educativo</b>. Não contém procedimentos de intervenção. Instalações de amônia devem ser projetadas, operadas e mantidas por profissionais habilitados, seguindo a legislação (NR-13, NR-15, NR-36) e as normas técnicas aplicáveis.</div>
      {SAFETY.map((sec) => (
        <div key={sec.title}>
          <h3>{sec.title}</h3>
          <ul className="clean small">{sec.items.map((it, i) => <li key={i}>{it.text} {it.kind === 'legal' && <span className="chip o-oficial">Requisito legal</span>} {it.kind === 'boa-pratica' && <span className="chip o-referencia">Boa prática</span>} <OriginChip o={it.origin} /></li>)}</ul>
        </div>
      ))}
      <p className="small muted">No modelo 3D, os detectores de NH₃ (luz verde piscando) ficam no teto da sala de máquinas e da câmara, e o exaustor de emergência fica na parte alta da parede da sala de máquinas.</p>
    </div>
  );
}

function Projects() {
  const s = useStore();
  const [saved, setSaved] = useState<Saved[]>(listSaved());
  const file = useRef<HTMLInputElement>(null);
  const exportJson = () => {
    const blob = new Blob([JSON.stringify(s.project, null, 2)], { type: 'application/json' });
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = `${s.project.name.replace(/[^\w-]+/g, '_')}.json`; a.click();
  };
  const importJson = async (f: File) => {
    try {
      const p = JSON.parse(await f.text()) as Project;
      if (p.version !== 1 || !p.room || !p.system) throw new Error('formato');
      s.setProject(p); s.setModal(null); s.showToast(`Cenário “${p.name}” importado.`);
    } catch { s.showToast('Arquivo inválido: esperado um cenário ENGEFRIL 3D em JSON.'); }
  };
  return (
    <div>
      <h3>Cenários de demonstração</h3>
      <div className="app-grid">{DEMOS.map((d) => <button key={d.id} onClick={() => { s.setProject(d.build()); s.setModal(null); }}><b>{d.title}</b><span>{d.desc}</span></button>)}</div>
      <h3>Projetos salvos neste navegador</h3>
      {saved.length === 0 && <p className="muted small">Nenhum projeto salvo. Use o ícone de disquete na barra superior.</p>}
      {saved.map((x) => (
        <div key={x.id} className="row card" style={{ justifyContent: 'space-between' }}>
          <div><b>{x.name}</b><div className="small muted">{x.date}</div></div>
          <div className="btns">
            <button className="btn sm" onClick={() => { s.setProject(x.project); s.setModal(null); }}>Abrir</button>
            <button className="btn sm" aria-label="Excluir" onClick={() => { deleteSaved(x.id); setSaved(listSaved()); }}><I.trash /></button>
          </div>
        </div>
      ))}
      <h3>Importar e exportar (JSON)</h3>
      <div className="btns">
        <button className="btn" onClick={exportJson}><I.download /> Exportar cenário atual</button>
        <button className="btn" onClick={() => file.current?.click()}><I.upload /> Importar cenário</button>
        <input ref={file} type="file" accept="application/json,.json" hidden onChange={(e) => e.target.files?.[0] && importJson(e.target.files[0])} />
      </div>
    </div>
  );
}

function Library() {
  const s = useStore();
  return (
    <div>
      <p className="small muted">Clique em uma família para localizá-la na instalação 3D. Os dados técnicos trazem a origem de cada informação.</p>
      <div className="app-grid" style={{ gridTemplateColumns: 'repeat(auto-fill,minmax(230px,1fr))' }}>
        {Object.entries(EQUIPMENT).map(([k, e]) => (
          <button key={k} onClick={() => {
            const id = { compressor: 'compressor-1', evaporador: 'evaporador-1', bomba: 'bomba-1', sensor: 'sensor-sala' }[k] ?? k;
            s.setModal(null); s.setView({ selected: id }); s.goCamera(id === 'camara' ? 'camara-externa' : id);
          }}>
            <b>{e.name}</b><span>{e.fn}</span><br />{e.engefril ? <span className="chip o-oficial">Catálogo Engefril</span> : <span className="chip o-referencia">Componente de terceiros</span>}
          </button>
        ))}
      </div>
      <h3>Fluidos e tecnologias alternativas</h3>
      <div style={{ overflowX: 'auto' }}>
        <table className="t" style={{ minWidth: 760 }}>
          <thead><tr><th>Tecnologia</th><th style={{ textAlign: 'left' }}>Aplicação</th><th style={{ textAlign: 'left' }}>Eficiência</th><th style={{ textAlign: 'left' }}>Segurança</th><th style={{ textAlign: 'left' }}>Ambiental</th><th style={{ textAlign: 'left' }}>Complexidade</th><th style={{ textAlign: 'left' }}>Observação</th></tr></thead>
          <tbody>{ALTERNATIVES.map((a) => <tr key={a.name}>{[a.name, a.app, a.eff, a.safety, a.env, a.complexity, a.note].map((x, i) => <td key={i} style={{ textAlign: 'left', verticalAlign: 'top' }}>{i === 0 ? <b>{x}</b> : x}</td>)}</tr>)}</tbody>
        </table>
      </div>
      <p className="small muted">Comparação qualitativa com base na literatura <OriginChip o="referencia" />. Fluidos e equipamentos não são intercambiáveis sem análise de compatibilidade (materiais, óleo, pressões, normas e carga).</p>
    </div>
  );
}
