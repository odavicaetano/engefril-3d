import { useState } from 'react';
import { useStore } from '../../state/store';
import { useEvaluationA, evalCached } from '../../state/useEvaluation';
import { satT } from '../../engine/r717';
import type { Project } from '../../engine/types';
import { BreakdownBars } from '../../ui/Charts';
import { Slider, Term, fmt } from '../../ui/common';
import { I } from '../../ui/Icons';

export default function Learning() {
  const [tab, setTab] = useState<'intro' | 'experimentos' | 'quiz'>('intro');
  return (
    <div>
      <div className="tabs">{(['intro', 'experimentos', 'quiz'] as const).map((t) => <button key={t} className={tab === t ? 'on' : ''} onClick={() => setTab(t)}>{{ intro: 'Fundamentos', experimentos: 'Experimentos', quiz: 'Teste-se' }[t]}</button>)}</div>
      {tab === 'intro' && <Intro />}
      {tab === 'experimentos' && <Experiments />}
      {tab === 'quiz' && <Quiz />}
    </div>
  );
}

function Intro() {
  const s = useStore();
  const ev = useEvaluationA();
  const p = s.project;
  return (
    <div>
      <div className="card dark">
        <h3 style={{ fontSize: 16 }}>Como uma indústria consegue manter um ambiente a −18 °C mesmo quando lá fora está fazendo 35 °C?</h3>
        <p style={{ margin: 0 }}>O sistema <b>não fabrica frio</b>. Ele <b>remove calor</b> de dentro da câmara e o <b>transporta</b> para fora, como uma bomba que leva água de um lugar baixo para um alto. Quem carrega esse calor é a <b>amônia</b>, que evapora dentro da câmara e condensa do lado de fora.</p>
      </div>
      <button className="btn primary" style={{ width: '100%', marginBottom: 10 }} onClick={() => s.setTour({ active: true, step: 0, playing: true, kind: 'ciclo' })}><I.play /> PLAY: percorrer o circuito frigorífico</button>
      <div className="card">
        <h3>1. Evaporar absorve calor</h3>
        <p className="small" style={{ margin: 0 }}>Quando um líquido evapora, ele absorve muita energia sem mudar de temperatura: é o <Term id="calor-latente">calor latente</Term>. É o mesmo motivo de sentirmos frio ao sair molhados do banho. Na pressão atmosférica, a amônia ferve a <b>−33 °C</b>; por isso, dentro do evaporador ela “ferve” absorvendo o calor do ar da câmara.</p>
      </div>
      <div className="card">
        <h3>2. A pressão controla a temperatura de ebulição</h3>
        <p className="small">A temperatura em que a amônia ferve depende da pressão (<Term id="saturacao">saturação</Term>). Baixa pressão: ela ferve frio. Alta pressão: ela condensa mesmo em um dia quente. Valores calculados (CoolProp):</p>
        <table className="t"><thead><tr><th>Temperatura de saturação</th><th>Pressão absoluta</th></tr></thead>
          <tbody>{[-33.3, -10, 0, 35].map((t) => <tr key={t}><td>{fmt(t, 1)} °C</td><td>{fmt(satT(t).P / 100, 2)} bar</td></tr>)}</tbody></table>
      </div>
      <div className="card">
        <h3>3. O compressor “bombeia” o calor</h3>
        <p className="small" style={{ margin: 0 }}>O compressor eleva a pressão do vapor; no condensador, a amônia condensa a cerca de {fmt(ev.temps.Tc, 0)} °C, acima da temperatura do ar externo, e o calor flui naturalmente para fora. A válvula de expansão faz o caminho inverso: derruba a pressão, e a amônia volta a ficar fria.</p>
      </div>
      <div className="card">
        <h3>4. Neste cenário ({p.name})</h3>
        <p className="small">Cada kg de amônia que evapora retira <b>{fmt(ev.cycle.qe, 0)} kJ</b>. Para remover {fmt(ev.loads.nominal.requiredKW, 0)} kW, circulam cerca de <b>{fmt(ev.cycle.mdot * 3600, 0)} kg/h</b> de NH₃. Para cada 1 kW de energia elétrica, o sistema move cerca de <b>{fmt(ev.cycle.COP, 1)} kW</b> de calor (<Term id="cop">COP</Term>).</p>
        <p className="small" style={{ margin: 0 }}>De onde vem o calor que precisa ser removido:</p>
        <BreakdownBars items={ev.breakdown.slice(0, 5)} />
      </div>
      <div className="card">
        <h3>5. Visão molecular</h3>
        <p className="small">Aproxime-se até as moléculas de NH₃ e veja a diferença entre líquido e vapor, a vaporização e a condensação.</p>
        <button className="btn" onClick={() => s.setModal('molecular')}><I.atom /> Abrir visualização molecular</button>
      </div>
      <div className="card">
        <h3>Explore os equipamentos</h3>
        <p className="small">Clique em qualquer equipamento da cena e use “Como funciona?”. Os botões de corte e de vista explodida mostram o interior.</p>
        <button className="btn" onClick={() => s.setModal('biblioteca')}><I.equip /> Biblioteca de equipamentos</button>
      </div>
    </div>
  );
}

type Exp = { label: string; explain: (d: number) => string; apply: (p: Project, v: number) => void; min: number; max: number; step: number; get: (p: Project) => number; unit: string };
const EXPS: Exp[] = [
  { label: 'Temperatura externa', unit: '°C', min: 20, max: 42, step: 1, get: (p) => p.climate.Tout, apply: (p, v) => { const d = v - p.climate.Tout; p.climate.Tout = v; p.doors.forEach((x) => (x.adjacentT += d)); },
    explain: (d) => d > 0 ? 'Com mais calor lá fora, mais calor atravessa as paredes (U·A·ΔT) e o ar que entra pelas portas traz mais energia. Além disso, a condensação sobe, e o compressor trabalha mais para cada kW de frio.' : 'Com menos calor externo, a transmissão e a infiltração diminuem e o compressor trabalha com menor diferença de pressão.' },
  { label: 'Temperatura desejada na câmara', unit: '°C', min: -30, max: 10, step: 1, get: (p) => p.room.Tin, apply: (p, v) => { p.room.Tin = v; },
    explain: (d) => d < 0 ? 'Uma câmara mais fria aumenta a diferença de temperatura com o exterior: entra mais calor. A evaporação também precisa ser mais fria, em pressão mais baixa, e o COP cai.' : 'Uma câmara menos fria reduz os ganhos de calor e permite evaporar em pressão mais alta, o que melhora a eficiência.' },
  { label: 'Aberturas de porta por hora', unit: '/h', min: 0, max: 60, step: 1, get: (p) => p.doors[0]?.passagesPerHour ?? 0, apply: (p, v) => { if (p.doors[0]) p.doors[0].passagesPerHour = v; },
    explain: (d) => d > 0 ? 'Cada abertura troca ar: o ar frio e denso sai por baixo e o ar quente e úmido entra por cima. Essa umidade ainda vira gelo no evaporador, o que exige mais degelo.' : 'Menos aberturas reduzem a troca de ar e a formação de gelo.' },
  { label: 'Espessura do isolamento', unit: 'mm', min: 50, max: 250, step: 25, get: (p) => p.envelope.wallThk, apply: (p, v) => { p.envelope.wallThk = v; p.envelope.roofThk = v; },
    explain: (d) => d > 0 ? 'O fluxo de calor por condução é inversamente proporcional à espessura do isolante. Dobrar a espessura praticamente reduz a transmissão à metade.' : 'Com isolamento mais fino, o calor atravessa as paredes com mais facilidade.' },
  { label: 'Produto recebido por dia', unit: 't/dia', min: 0, max: 60, step: 1, get: (p) => p.product.dailyMass / 1000, apply: (p, v) => { p.product.dailyMass = v * 1000; },
    explain: (d) => d > 0 ? 'Cada kg de produto que entra quente precisa perder calor sensível e, se congelar, também o calor latente da água que contém.' : 'Menos produto entrando significa menos calor a remover.' },
  { label: 'Umidade do ar externo', unit: '%', min: 20, max: 95, step: 5, get: (p) => Math.round((p.doors[0]?.adjacentRH ?? p.climate.RHout) * 100), apply: (p, v) => { p.climate.RHout = v / 100; p.doors.forEach((x) => (x.adjacentRH = v / 100)); },
    explain: (d) => d > 0 ? 'O ar úmido carrega mais energia (entalpia): o vapor de água condensa e congela no evaporador e libera calor latente. A carga de infiltração e o degelo aumentam.' : 'Ar mais seco carrega menos energia e forma menos gelo.' },
];

function Experiments() {
  const s = useStore();
  const p = s.project;
  const [base, setBase] = useState<Project>(() => p);
  const e0 = evalCached(base), e1 = evalCached(p);
  const [last, setLast] = useState<{ i: number; d: number } | null>(null);
  const dCap = e1.loads.nominal.requiredKW - e0.loads.nominal.requiredKW;
  const dE = e1.energy.kWhYear - e0.energy.kWhYear;
  return (
    <div>
      <p className="small" style={{ marginTop: 0 }}>Mova os controles e veja o que muda na cena 3D e nos números. Os resultados são <b>calculados</b> pelo mesmo motor do modo comercial, não são animações decorativas.</p>
      <button className={`btn ${s.view.doorsOpen ? 'primary' : ''}`} style={{ marginBottom: 10 }} onClick={() => s.setView({ doorsOpen: !s.view.doorsOpen, showHeat: true })}><I.door /> {s.view.doorsOpen ? 'Fechar a porta' : 'Abrir uma porta frigorífica'}</button>
      {EXPS.map((x, i) => (
        <Slider key={x.label} label={x.label} unit={x.unit} min={x.min} max={x.max} step={x.step} value={x.get(p)} onChange={(v) => { const d = v - x.get(p); s.update((q) => x.apply(q, v), 'exp' + i); setLast({ i, d }); }} />
      ))}
      <div className="card dark">
        <h3>Antes × depois</h3>
        <table className="t" style={{ color: '#e7eef6' }}>
          <thead><tr><th style={{ color: '#9fb3c8' }}></th><th style={{ color: '#9fb3c8' }}>Antes</th><th style={{ color: '#9fb3c8' }}>Agora</th></tr></thead>
          <tbody>
            <tr><td>Capacidade necessária</td><td>{fmt(e0.loads.nominal.requiredKW, 1)} kW</td><td><b>{fmt(e1.loads.nominal.requiredKW, 1)} kW</b></td></tr>
            <tr><td>Infiltração</td><td>{fmt((e0.breakdown.find((b) => b.key === 'infiltracao')?.kWhDay ?? 0) / 24, 2)} kW</td><td>{fmt((e1.breakdown.find((b) => b.key === 'infiltracao')?.kWhDay ?? 0) / 24, 2)} kW</td></tr>
            <tr><td>Transmissão</td><td>{fmt((e0.breakdown.find((b) => b.key === 'transmissao')?.kWhDay ?? 0) / 24, 1)} kW</td><td>{fmt((e1.breakdown.find((b) => b.key === 'transmissao')?.kWhDay ?? 0) / 24, 1)} kW</td></tr>
            <tr><td>COP</td><td>{fmt(e0.cycle.COP, 2)}</td><td>{fmt(e1.cycle.COP, 2)}</td></tr>
            <tr><td>Energia anual</td><td>{fmt(e0.energy.kWhYear / 1000, 0)} MWh</td><td>{fmt(e1.energy.kWhYear / 1000, 0)} MWh</td></tr>
          </tbody>
        </table>
        <p className="small" style={{ marginBottom: 0 }}>Variação: <b>{dCap >= 0 ? '+' : ''}{fmt(dCap, 1)} kW</b> de capacidade e <b>{dE >= 0 ? '+' : ''}{fmt(dE / 1000, 1)} MWh/ano</b>.</p>
      </div>
      {last && Math.abs(last.d) > 0 && <div className="insight"><b>Por quê?</b> {EXPS[last.i].explain(last.d)}</div>}
      <div className="btns">
        <button className="btn sm" onClick={() => { s.setProject(base); setLast(null); }}><I.reset /> Restaurar o “antes”</button>
        <button className="btn sm" onClick={() => setBase(p)}>Fixar o estado atual como “antes”</button>
      </div>
    </div>
  );
}

const QUIZ = [
  { q: 'O sistema de refrigeração “produz frio”?', a: ['Sim, o compressor gera frio', 'Não: ele transporta calor de dentro para fora', 'Sim, o evaporador cria frio a partir da eletricidade'], ok: 1, why: 'A refrigeração remove calor da câmara e o rejeita no condensador. Frio é apenas ausência de calor.' },
  { q: 'Por que a amônia evapora dentro do evaporador mesmo a −30 °C?', a: ['Porque a pressão ali é baixa, e sua temperatura de ebulição também', 'Porque ela é aquecida por resistências', 'Porque o ventilador a evapora'], ok: 0, why: 'A temperatura de saturação depende da pressão. Em baixa pressão, a amônia ferve em temperaturas muito baixas.' },
  { q: 'O calor rejeitado no condensador é…', a: ['Menor que o calor retirado da câmara', 'Igual ao calor retirado da câmara', 'O calor da câmara mais a energia do compressor'], ok: 2, why: 'Pela conservação de energia (1ª lei), tudo o que entra (calor da câmara + trabalho do compressor) sai no condensador.' },
  { q: 'Abrir a porta com mais frequência…', a: ['Não muda nada, o ar é o mesmo', 'Aumenta a infiltração de ar quente e úmido e a formação de gelo', 'Reduz a carga, porque o ar circula'], ok: 1, why: 'O ar externo tem mais entalpia. Mais tempo aberto significa mais troca de ar, mais carga e mais gelo nas aletas.' },
  { q: 'Para que serve o separador de líquido?', a: ['Enviar apenas vapor ao compressor e líquido aos evaporadores', 'Armazenar óleo', 'Resfriar a água do condensador'], ok: 0, why: 'Compressores não podem aspirar líquido. O separador protege o compressor e alimenta os evaporadores com líquido.' },
];

function Quiz() {
  const [ans, setAns] = useState<Record<number, number>>({});
  const score = Object.entries(ans).filter(([i, a]) => QUIZ[+i].ok === a).length;
  return (
    <div>
      {QUIZ.map((q, i) => (
        <div key={i} className="card">
          <h3>{i + 1}. {q.q}</h3>
          {q.a.map((a, k) => (
            <button key={k} className="btn sm" style={{ display: 'flex', width: '100%', justifyContent: 'flex-start', marginBottom: 4, ...(ans[i] === k ? { borderColor: k === q.ok ? 'var(--ok)' : 'var(--err)', color: k === q.ok ? 'var(--ok)' : 'var(--err)' } : {}) }} onClick={() => setAns({ ...ans, [i]: k })}>{a}</button>
          ))}
          {ans[i] !== undefined && <div className={`insight ${ans[i] === q.ok ? '' : 'warn'}`}>{ans[i] === q.ok ? 'Correto. ' : 'Ainda não. '}{q.why}</div>}
        </div>
      ))}
      <p><b>{score}/{QUIZ.length}</b> acertos.</p>
    </div>
  );
}
