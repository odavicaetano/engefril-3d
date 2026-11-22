/**
 * Arranjo físico da instalação, derivado do projeto. É uma função pura, compartilhada pela cena,
 * pela câmera e pelo tour guiado. Coordenadas em metros, com y para cima. A câmara ocupa x∈[0,L],
 * a sala de máquinas x∈[-16,-2] e o condensador evaporativo fica do lado de fora, em x≈-21,5.
 */
import type { Project } from '../engine/types';
import type { Architecture } from '../engine/cycle';
import { roomGeometry } from '../engine/loads';

export type V3 = [number, number, number];
export type LineKind = 'descarga' | 'liquido-ap' | 'liquido-bp' | 'retorno' | 'succao' | 'intermediario' | 'secundario';
export const LINE_INFO: Record<LineKind, { name: string; color: string; radius: number; insulated: boolean; phase: 'vapor' | 'liquido' | 'mistura' }> = {
  descarga: { name: 'Descarga: vapor quente em alta pressão', color: '#e4572e', radius: 0.08, insulated: false, phase: 'vapor' },
  'liquido-ap': { name: 'Líquido em alta pressão', color: '#f0a202', radius: 0.05, insulated: false, phase: 'liquido' },
  'liquido-bp': { name: 'Líquido frio em baixa pressão', color: '#1f6fd1', radius: 0.06, insulated: true, phase: 'liquido' },
  retorno: { name: 'Retorno úmido: mistura líquido + vapor em baixa pressão', color: '#46b3e6', radius: 0.1, insulated: true, phase: 'mistura' },
  succao: { name: 'Sucção: vapor frio em baixa pressão', color: '#8fd3f4', radius: 0.11, insulated: true, phase: 'vapor' },
  intermediario: { name: 'Vapor em pressão intermediária', color: '#c38fff', radius: 0.09, insulated: true, phase: 'vapor' },
  secundario: { name: 'Fluido secundário (água/glicol)', color: '#2bb673', radius: 0.08, insulated: true, phase: 'liquido' },
};

export interface Equip { id: string; kind: string; pos: V3; size: V3; label: string; rot?: number; role?: string }
export interface Route { id: string; kind: LineKind; pts: V3[] }
export interface Layout {
  L: number; W: number; H: number; rack: number; arch: Architecture; water: boolean;
  equips: Equip[]; routes: Route[]; bounds: { min: V3; max: V3 };
  machineRoom: { min: V3; max: V3 }; evaps: Equip[];
}

export function computeLayout(p: Project, archOverride?: Architecture): Layout {
  const g = roomGeometry(p);
  const water = p.application === 'agua-gelada';
  const arch: Architecture = water ? 'indireto' : archOverride ?? p.system.architecture;
  const L = water ? 8 : g.L, W = water ? 5 : g.W, H = water ? 2.6 : g.H;
  const yr = water ? 3.2 : Math.min(5.4, H - 0.35);
  const equips: Equip[] = [];
  const routes: Route[] = [];
  const add = (e: Equip) => (equips.push(e), e);
  const route = (id: string, kind: LineKind, pts: V3[]) => routes.push({ id, kind, pts });
  const two = arch === 'duplo-estagio';

  add({ id: 'compressor-1', kind: 'compressor', pos: [-13, 0, -3.5], size: [3.6, 2.2, 1.4], label: two ? 'Compressor de baixa (booster)' : 'Compressor parafuso 1', role: two ? 'bp' : 'simples' });
  add({ id: 'compressor-2', kind: 'compressor', pos: [-8.5, 0, -3.5], size: [3.6, 2.2, 1.4], label: two ? 'Compressor de alta' : 'Compressor parafuso 2', role: two ? 'ap' : 'simples' });
  add({ id: 'condensador', kind: 'condensador', pos: [-21.5, 0, 0], size: [3, 5.4, 6], label: 'Condensador evaporativo' });
  add({ id: 'recipiente', kind: 'recipiente', pos: [-12, 1.0, 4], size: [3.6, 1.0, 1.0], label: 'Reservatório de amônia (recipiente de líquido)' });
  add({ id: 'painel', kind: 'painel', pos: [-15.2, 0, -6.5], size: [2.4, 2.1, 0.5], label: 'Painel elétrico e de controle' });
  add({ id: 'valvulas', kind: 'valvulas', pos: [-2.6, 2.2, -0.2], size: [0.5, 1.6, 2.2], label: 'Quadro de válvulas' });
  add({ id: 'exaustor', kind: 'exaustor', pos: [-9, 5.2, 7], size: [1.1, 1.1, 0.4], label: 'Exaustor de emergência da sala de máquinas' });
  add({ id: 'sensor-sala', kind: 'sensor', pos: [-9, 6.25, 0], size: [0.3, 0.2, 0.3], label: 'Detector de NH₃ (sala de máquinas)' });
  add({ id: 'sensor-sala-2', kind: 'sensor', pos: [-4, 6.25, -3], size: [0.3, 0.2, 0.3], label: 'Detector de NH₃ (sala de máquinas)' });

  // Separador de líquido conforme a arquitetura
  const sepPumped: V3 = [-6.5, 2.6, 3.8];
  let sep: Equip | null = null;
  if (arch === 'bombeado' || arch === 'indireto' || two) {
    sep = add({ id: 'separador', kind: 'separador', pos: sepPumped, size: [4, 1.3, 1.3], label: 'Separador de líquido (baixa pressão)' });
    add({ id: 'bomba-1', kind: 'bomba', pos: [-7.6, 0, 3.8], size: [0.9, 0.7, 0.5], label: 'Bomba de amônia 1' });
    add({ id: 'bomba-2', kind: 'bomba', pos: [-5.4, 0, 3.8], size: [0.9, 0.7, 0.5], label: 'Bomba de amônia 2 (reserva)' });
  } else if (arch === 'gravidade') {
    sep = add({ id: 'separador', kind: 'separador', pos: [Math.min(5, L * 0.3), H + 1.3, -W / 2 + 1.7], size: [3, 1.1, 1.1], label: 'Separador de líquido (alimentação por gravidade)' });
  }
  if (two) add({ id: 'intercooler', kind: 'intercooler', pos: [-4.6, 0, -4.8], size: [1.1, 3.2, 1.1], label: 'Resfriador intermediário (intercooler)' });
  const iceBank = water && p.process.strategy === 'banco-gelo';
  if (arch === 'indireto' && !iceBank) {
    add({ id: 'trocador', kind: 'trocador', pos: [-4.2, 0, -1.3], size: [0.7, 1.8, 0.6], label: water ? 'Trocador a placas NH₃ / água (chiller)' : 'Trocador a placas NH₃ / glicol (chiller)' });
    if (!water) add({ id: 'bomba-glicol', kind: 'bomba', pos: [-4.2, 0, 0.6], size: [0.9, 0.7, 0.5], label: 'Bomba de fluido secundário' });
  }

  // Ambiente refrigerado ou banco de gelo
  const evaps: Equip[] = [];
  if (water) {
    add({ id: 'tanque', kind: 'tanque', pos: [L / 2 + 0.5, 0, 0], size: [L - 1, H, W - 1], label: 'Tanque de água gelada / banco de gelo' });
  } else {
    add({ id: 'camara', kind: 'camara', pos: [L / 2, 0, 0], size: [L, H, W], label: 'Câmara frigorífica (painéis termoisolantes)' });
    const n = Math.max(1, Math.min(8, Math.ceil(L / 10)));
    for (let i = 0; i < n; i++) {
      evaps.push(add({ id: `evaporador-${i + 1}`, kind: 'evaporador', pos: [(L * (i + 0.5)) / n, H - 0.8, -W / 2 + 0.75], size: [Math.min(2.6, (L / n) * 0.8), 1.0, 1.0], label: `Evaporador ${i + 1}` }));
    }
    add({ id: 'sensor-camara', kind: 'sensor', pos: [L * 0.5, H - 0.15, W / 4], size: [0.3, 0.2, 0.3], label: 'Detector de NH₃ (câmara)' });
  }

  // ---------- Tubulações
  const disTop = 5.6;
  const cond = { inlet: [-20, 3.9, -2] as V3, outlet: [-20, 2.1, 2] as V3 };
  // descarga
  if (two) {
    route('desc-bp', 'intermediario', [[-13, 1.9, -3.5], [-13, 4.2, -3.5], [-13, 4.2, -5.6], [-4.6, 4.2, -5.6], [-4.6, 3.2, -5.6], [-4.6, 3.2, -4.8]]);
    route('ic-ap', 'intermediario', [[-4.6, 3.2, -4.8], [-4.6, 3.7, -4.8], [-6.5, 3.7, -4.8], [-6.5, 3.7, -2.4], [-8.5, 3.7, -2.4], [-8.5, 1.6, -2.4], [-8.5, 1.6, -2.8]]);
    route('desc-ap', 'descarga', [[-8.5, 1.9, -3.5], [-8.5, disTop, -3.5], [-18.5, disTop, -3.5], [-18.5, disTop, -2], [-18.5, 3.9, -2], cond.inlet]);
  } else {
    route('desc-1', 'descarga', [[-13, 1.9, -3.5], [-13, disTop, -3.5], [-18.5, disTop, -3.5], [-18.5, disTop, -2], [-18.5, 3.9, -2], cond.inlet]);
    route('desc-2', 'descarga', [[-8.5, 1.9, -3.5], [-8.5, disTop, -3.5], [-13, disTop, -3.5]]);
  }
  // condensado por gravidade até o recipiente
  route('condensado', 'liquido-ap', [cond.outlet, [-18.5, 2.1, 2], [-18.5, 2.1, 4], [-13.3, 2.1, 4], [-13.3, 1.5, 4]]);

  // linha de líquido de alta e expansão
  const recOut: V3 = [-10.6, 0.5, 4];
  const zL = -W / 2 + 1.9, zR = -W / 2 + 1.4;
  const xLast = evaps.length ? evaps[evaps.length - 1].pos[0] : L / 2;
  const evapBranches = (kind: LineKind, z: number, dir: 'in' | 'out') => {
    for (const e of evaps) {
      const top: V3 = [e.pos[0] + (dir === 'in' ? -0.4 : 0.4), e.pos[1] + 0.5, e.pos[2] + 0.2];
      const pts: V3[] = [[top[0], yr, z], [top[0], yr, top[2]], top];
      route(`${e.id}-${dir}`, kind, dir === 'in' ? pts : [...pts].reverse());
    }
  };
  if (arch === 'dx') {
    route('liq-ap', 'liquido-ap', [recOut, [-10.6, 0.25, 5.2], [-3, 0.25, 5.2], [-3, yr, 5.2], [-3, yr, zL], [xLast - 0.4, yr, zL]]);
    evapBranches('liquido-ap', zL, 'in');
    evapBranches('succao', zR, 'out');
    route('succao', 'succao', [[xLast + 0.4, yr, zR], [-3.6, yr, zR], [-3.6, 4.8, -1.8], [-13, 4.8, -1.8], [-13, 1.6, -1.8], [-13, 1.6, -2.8]]);
    route('succao-2', 'succao', [[-8.5, 4.8, -1.8], [-8.5, 1.6, -1.8], [-8.5, 1.6, -2.8]]);
  } else {
    const s = sep!;
    const sTop = s.pos[1] + s.size[1] / 2, sBot = s.pos[1] - s.size[1] / 2;
    const sx0 = s.pos[0] - s.size[0] / 2;
    if (two) {
      route('liq-ap', 'liquido-ap', [recOut, [-10.6, 0.25, 5.6], [-3.2, 0.25, 5.6], [-3.2, 0.25, -4.8], [-4.05, 0.25, -4.8], [-4.05, 1.2, -4.8]]);
      route('liq-pi', 'liquido-bp', [[-4.6, 0.3, -4.2], [-4.6, 0.3, 1.6], [-8.4, 0.3, 1.6], [-8.4, 3.6, 1.6], [-8, 3.6, 3.8], [-8, sTop, 3.8]]);
    } else if (arch === 'gravidade') {
      route('liq-ap', 'liquido-ap', [recOut, [-10.6, 0.25, 5.2], [-3, 0.25, 5.2], [-3, H + 2.4, 5.2], [-3, H + 2.4, s.pos[2]], [sx0 + 0.3, H + 2.4, s.pos[2]], [sx0 + 0.3, sTop, s.pos[2]]]);
    } else {
      route('liq-ap', 'liquido-ap', [recOut, [-10.6, 0.25, 5.2], [-9.2, 0.25, 5.2], [-9.2, 3.6, 5.2], [-8, 3.6, 5.2], [-8, 3.6, 3.8], [-8, sTop, 3.8]]);
    }
    // Alimentação dos consumidores
    if (arch === 'gravidade') {
      route('liq-bp', 'liquido-bp', [[s.pos[0] - 0.6, sBot, s.pos[2]], [s.pos[0] - 0.6, yr, s.pos[2]], [s.pos[0] - 0.6, yr, zL], [xLast - 0.4, yr, zL]]);
      route('ret', 'retorno', [[xLast + 0.4, yr, zR], [s.pos[0] + 0.6, yr, zR], [s.pos[0] + 0.6, sTop - 0.2, zR], [s.pos[0] + 0.6, sTop - 0.2, s.pos[2]]]);
      const yTop = Math.max(H + 2.9, 7.2);
      route('succao', 'succao', [[s.pos[0] + 1.2, sTop, s.pos[2]], [s.pos[0] + 1.2, yTop, s.pos[2]], [-7, yTop, s.pos[2]], [-7, yTop, -1.8], [-7, 4.8, -1.8], [-13, 4.8, -1.8], [-13, 1.6, -1.8], [-13, 1.6, -2.8]]);
      route('succao-2', 'succao', [[-8.5, 4.8, -1.8], [-8.5, 1.6, -1.8], [-8.5, 1.6, -2.8]]);
    } else {
      route('desce-bomba', 'liquido-bp', [[-6.5, sBot, 3.8], [-6.5, 0.9, 3.8], [-7.6, 0.9, 3.8], [-7.6, 0.6, 3.8]]);
      if (iceBank) {
        const tx = L / 2 + 0.5;
        route('liq-bp', 'liquido-bp', [[-5.4, 0.6, 3.8], [-5.4, 0.6, 2.4], [-3, 0.6, 2.4], [-3, yr, 2.4], [-3, yr, -1.2], [tx - 1.5, yr, -1.2], [tx - 1.5, H + 0.2, -1.2]]);
        route('ret', 'retorno', [[tx + 1.5, H + 0.2, 1.2], [tx + 1.5, yr + 0.4, 1.2], [-3.6, yr + 0.4, 1.2], [-3.6, yr + 0.4, 3.2], [-5, yr + 0.4, 3.2], [-5, sTop, 3.8]]);
      } else if (arch === 'indireto') {
        route('liq-bp', 'liquido-bp', [[-5.4, 0.6, 3.8], [-5.4, 0.6, 2.4], [-4.6, 0.6, 2.4], [-4.6, 0.6, -1.3], [-4.55, 0.6, -1.3]]);
        route('ret', 'retorno', [[-4.2, 1.8, -1.3], [-4.2, 3.6, -1.3], [-4.2, 3.6, 3.8], [-5, 3.6, 3.8], [-5, sTop, 3.8]]);
        if (water) {
          const tx = L / 2 + 0.5;
          route('sec-ida', 'secundario', [[-3.85, 1.2, -1.3], [-1, 1.2, -1.3], [-1, 1.2, -1.8], [tx - 2, 1.2, -1.8], [tx - 2, H + 0.3, -1.8]]);
          route('sec-volta', 'secundario', [[tx + 2, H + 0.3, 1.8], [tx + 2, 3.4, 1.8], [-1.5, 3.4, 1.8], [-1.5, 0.5, 1.8], [-3.85, 0.5, -1.3]]);
        } else {
          route('sec-ida', 'secundario', [[-3.85, 1.2, -1.3], [-3.4, 1.2, -1.3], [-3.4, 1.2, 0.6], [-3.75, 0.35, 0.6]]);
          route('sec-bomba', 'secundario', [[-3.75, 0.35, 0.6], [-3.1, 0.35, 0.6], [-3.1, yr, 0.6], [-3.1, yr, zL], [xLast - 0.4, yr, zL]]);
          evapBranches('secundario', zL, 'in');
          evapBranches('secundario', zR, 'out');
          route('sec-volta', 'secundario', [[xLast + 0.4, yr, zR], [-3.7, yr, zR], [-3.7, 1.6, zR], [-3.7, 1.6, -1.3], [-3.85, 1.6, -1.3]]);
        }
      } else {
        route('liq-bp', 'liquido-bp', [[-5.4, 0.6, 3.8], [-5.4, 0.6, 2.4], [-3, 0.6, 2.4], [-3, yr, 2.4], [-3, yr, zL], [xLast - 0.4, yr, zL]]);
        route('ret', 'retorno', [[xLast + 0.4, yr, zR], [-3.6, yr, zR], [-3.6, yr, 3.2], [-5, yr, 3.2], [-5, sTop, 3.8]]);
      }
      if (arch === 'bombeado' || two) { evapBranches('liquido-bp', zL, 'in'); evapBranches('retorno', zR, 'out'); }
      route('succao', 'succao', [[-7.2, sTop, 3.8], [-7.2, 4.8, 3.8], [-7.2, 4.8, -1.8], [-13, 4.8, -1.8], [-13, 1.6, -1.8], [-13, 1.6, -2.8]]);
      if (!two) route('succao-2', 'succao', [[-8.5, 4.8, -1.8], [-8.5, 1.6, -1.8], [-8.5, 1.6, -2.8]]);
    }
  }

  const maxX = Math.max(L, 8), halfZ = Math.max(W / 2, 7.5);
  return {
    L, W, H, rack: yr, arch, water, equips, routes, evaps,
    bounds: { min: [-24, 0, -halfZ - 1], max: [maxX + 1, Math.max(H, 7) + 2, halfZ + 1] },
    machineRoom: { min: [-16, 0, -7], max: [-2, 6.5, 7] },
  };
}

/** Sequência do tour do ciclo frigorífico, adaptada à arquitetura. */
export interface TourStop { target: string; title: string; text: string; line?: LineKind; stateIds?: string[] }
export function cycleTour(l: Layout): TourStop[] {
  const ev = l.water ? 'tanque' : l.evaps[0]?.id ?? 'camara';
  const stops: TourStop[] = [];
  const hasHX = l.equips.some((e) => e.id === 'trocador');
  if (hasHX) {
    stops.push({ target: ev, title: '1. Consumidor (fluido secundário)', text: l.water ? 'A água de processo volta aquecida do consumidor e passa pelo tanque de água gelada antes de ser resfriada no chiller.' : 'Neste sistema indireto, o evaporador da câmara é percorrido por glicol frio. O ar quente da câmara cede calor ao glicol, que volta aquecido para a sala de máquinas.', line: 'secundario' });
    stops.push({ target: 'trocador', title: '2. Trocador a placas', text: 'No trocador, o fluido secundário (água ou glicol) entrega esse calor à amônia, que evapora em baixa pressão. A amônia fica restrita à sala de máquinas.', line: 'retorno', stateIds: ['4', '1'] });
  } else {
    stops.push({ target: ev, title: '1. Evaporador', text: l.water
      ? 'No banco de gelo, a amônia evapora dentro das serpentinas mergulhadas no tanque. A água cede calor e forma gelo ao redor dos tubos, acumulando frio para os picos de consumo.'
      : 'O ar da câmara atravessa as aletas do evaporador. A amônia líquida, em baixa pressão e temperatura abaixo da do ar, absorve esse calor e evapora: é a mudança de fase que retira grande quantidade de energia (calor latente).', line: l.arch === 'dx' ? 'liquido-ap' : 'liquido-bp', stateIds: ['4', '1'] });
  }
  if (l.arch === 'bombeado' || l.arch === 'duplo-estagio' || l.arch === 'indireto') {
    stops.push({ target: 'separador', title: `${stops.length + 1}. Retorno úmido e separador de líquido`, text: 'A mistura de líquido e vapor volta ao separador de baixa pressão. O líquido fica no fundo e é bombeado novamente aos evaporadores; só vapor segue para o compressor, o que o protege contra golpe de líquido.', line: 'retorno' });
    stops.push({ target: 'bomba-1', title: `${stops.length + 1}. Bombas de amônia`, text: 'As bombas enviam ao evaporador mais líquido do que ele evapora (recirculação). Assim toda a superfície interna fica molhada, o que melhora a troca térmica.', line: 'liquido-bp' });
  } else if (l.arch === 'gravidade') {
    stops.push({ target: 'separador', title: `${stops.length + 1}. Separador por gravidade`, text: 'O separador fica acima dos evaporadores. O líquido desce por gravidade, e a mistura que retorna sobe por termossifão, sem bombas. O vapor seco segue para a sucção.', line: 'retorno' });
  } else {
    stops.push({ target: ev, title: `${stops.length + 1}. Linha de sucção`, text: 'Na expansão direta, o vapor sai do evaporador levemente superaquecido e segue direto para o compressor.', line: 'succao' });
  }
  stops.push({ target: 'compressor-1', title: `${stops.length + 1}. Compressor`, text: l.arch === 'duplo-estagio'
    ? 'O compressor de baixa eleva o vapor até a pressão intermediária. No intercooler, o vapor é resfriado e o compressor de alta completa a compressão. Dividir a compressão reduz a temperatura de descarga e melhora a eficiência.'
    : 'Os rotores helicoidais do compressor parafuso reduzem o volume do vapor. A pressão e a temperatura sobem; a energia elétrica do motor é somada ao calor que será rejeitado.', line: 'succao', stateIds: ['1', '2'] });
  stops.push({ target: 'condensador', title: `${stops.length + 1}. Linha de descarga e condensador evaporativo`, text: 'O vapor quente em alta pressão chega às serpentinas do condensador. A água pulverizada sobre os tubos evapora e o ar insuflado pelos ventiladores leva o calor embora. A amônia condensa e volta a ser líquida.', line: 'descarga', stateIds: ['2', '3'] });
  stops.push({ target: 'recipiente', title: `${stops.length + 1}. Reservatório de líquido`, text: 'O líquido condensado escoa por gravidade até o reservatório de alta pressão, que acumula a carga de amônia do sistema e alimenta os consumidores.', line: 'liquido-ap' });
  stops.push({ target: l.arch === 'dx' ? ev : l.arch === 'duplo-estagio' ? 'intercooler' : 'separador', title: `${stops.length + 1}. Expansão`, text: 'Ao passar pela válvula de expansão (ou de boia), a pressão cai bruscamente. Parte do líquido evapora instantaneamente (flash) e resfria o restante até a temperatura de evaporação.', line: 'liquido-ap', stateIds: ['3', '4'] });
  stops.push({ target: ev, title: `${stops.length + 1}. Retorno ao evaporador`, text: 'O líquido frio volta ao evaporador e o ciclo recomeça. O calor retirado da câmara mais a energia do compressor são rejeitados no condensador: o sistema transporta calor, ele não fabrica frio.', stateIds: ['4', '1'] });
  return stops;
}
