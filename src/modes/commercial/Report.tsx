import { useStore } from '../../state/store';
import { I } from '../../ui/Icons';

export default function Report() {
  const s = useStore();
  return (
    <div>
      <div className="card">
        <h3>Exportar Projeto em PDF</h3>
        <p className="small">Gere um documento A4 com pré-visualização antes de baixar. Há dois tipos:</p>
        <ul className="clean small">
          <li><b>Relatório Técnico Completo</b>, para análise preliminar por engenheiros: capa técnica, memorial descritivo, memorial de cálculo com fórmulas, desenhos vetoriais cotados (plantas, cortes, vista e diagrama do circuito), especificação de equipamentos, quadro de dimensionamento, análise energética e conclusões.</li>
          <li><b>Relatório Comercial</b>, para apresentação ao cliente: capacidade, principais cargas, soluções sugeridas, comparação de cenários e premissas.</li>
        </ul>
        <p className="small muted">Orientação retrato, paisagem ou automática (texto em retrato e desenhos em paisagem), sempre em A4. A imagem 3D opcional usa a vista atual da câmera.</p>
        <button className="btn primary" onClick={() => s.setModal('exportar')}><I.report /> Exportar Projeto em PDF</button>
      </div>
      <div className="card"><p className="small muted" style={{ margin: 0 }}>Os documentos são pré-dimensionamentos orientativos para apoio à decisão. Não são propostas contratuais nem projetos executivos e não contêm assinatura, ART ou validação profissional.</p></div>
    </div>
  );
}
