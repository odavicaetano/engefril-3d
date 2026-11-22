import type { AppId, Door, Project } from '../engine/types';

let seq = 0;
export const uid = () => `d${Date.now().toString(36)}${(seq++).toString(36)}`;

export function makeDoor(over: Partial<Door> = {}): Door {
  return {
    id: uid(), type: 'correr', width: 1.5, height: 2.4, count: 1, wall: 'frente', position: 0.5,
    passagesPerHour: 6, hoursPerDay: 10, secondsPerPassage: 20, minutesOpenPerHour: 0,
    adjacentT: 25, adjacentRH: 0.6, protection: 'pvc', traffic: 'paleteira', sealGood: true, ...over,
  };
}

export function baseProject(): Project {
  return {
    version: 1, name: 'Novo projeto', application: 'resfriamento',
    room: { length: 20, width: 12, height: 6, count: 1, Tin: 2, RHin: 0.85, areaMode: 'dims', area: 240, aspect: 1.6 },
    climate: { label: 'Clima de projeto genérico (verão)', Tout: 32, RHout: 0.55, Tground: 20, solarWalls: 'nenhuma', solarRoof: 'clara' },
    envelope: { insulation: 'eps-engefril', wallThk: 100, roofThk: 100, floorThk: 75, floorInsulated: true, thermalBridgePct: 5, lambdaOverride: null },
    doors: [makeDoor()],
    product: { typeId: 'carne-bovina', storedMass: 60000, dailyMass: 8000, Tenter: 7, Tfinal: 2, coolingHours: 20, packaging: 'papelao', packagingFraction: 0.08, turnoverDays: 7 },
    internal: { people: 2, peopleHours: 8, lightingWm2: 8, lightingHours: 10, equipmentKW: 3, equipmentHours: 4, otherKW: 0 },
    system: {
      architecture: 'bombeado', runHours: 18, safetyFactor: 0.1, defrost: 'agua', evapTD: 6, condApproach: 11, etaIs: 0.75, etaMotor: 0.94,
      superheat: 2, subcool: 3, fanDp: 150, fanEta: 0.45, airDT: 4, defrostEff: 0.4, condAuxPct: 2.5, frameHeaterWm: 40,
    },
    process: { flow: 20, Tin: 12, Tout: 2, hoursPerDay: 8, strategy: 'banco-gelo' },
    finance: { tariff: 0.75, operatingDays: 365, investment: null, investmentSource: '', maintenance: null },
    confirmed: {},
  };
}

export interface AppPreset { id: AppId; name: string; desc: string; apply: (p: Project) => void }
/** Parâmetros iniciais sugeridos por aplicação (hipóteses editáveis, não dados de projeto). */
export const APPLICATIONS: AppPreset[] = [
  { id: 'resfriamento', name: 'Câmara de resfriamento', desc: 'Produtos resfriados, de 0 a +5 °C', apply: (p) => { p.room.Tin = 2; p.room.RHin = 0.85; p.system.defrost = 'ar'; p.system.runHours = 18; p.system.evapTD = 6; } },
  { id: 'congelamento', name: 'Câmara de congelamento', desc: 'Congela produtos recebidos frescos', apply: (p) => { p.room.Tin = -25; p.room.RHin = 0.9; p.product.Tenter = 5; p.product.Tfinal = -18; p.product.coolingHours = 20; p.system.defrost = 'gas-quente'; p.system.runHours = 20; p.envelope.wallThk = 150; p.envelope.roofThk = 150; p.envelope.floorInsulated = true; p.envelope.floorThk = 150; p.climate.Tground = 10; p.system.evapTD = 7; } },
  { id: 'conservacao', name: 'Câmara de conservação', desc: 'Estocagem de congelados a −20 °C', apply: (p) => { p.room.Tin = -20; p.room.RHin = 0.9; p.product.typeId = 'congelados'; p.product.Tenter = -15; p.product.Tfinal = -20; p.system.defrost = 'gas-quente'; p.system.runHours = 20; p.envelope.wallThk = 150; p.envelope.roofThk = 150; p.envelope.floorInsulated = true; p.envelope.floorThk = 150; p.climate.Tground = 10; } },
  { id: 'tunel', name: 'Túnel de congelamento', desc: 'Congelamento rápido em lotes', apply: (p) => { p.room = { ...p.room, length: 12, width: 6, height: 4.5, Tin: -35, RHin: 0.9 }; p.product.Tenter = 7; p.product.Tfinal = -18; p.product.coolingHours = 6; p.product.dailyMass = 20000; p.product.storedMass = 5000; p.system.architecture = 'duplo-estagio'; p.system.defrost = 'gas-quente'; p.system.runHours = 20; p.system.airDT = 3; p.system.fanDp = 250; p.envelope.wallThk = 200; p.envelope.roofThk = 200; p.envelope.floorInsulated = true; p.envelope.floorThk = 150; p.climate.Tground = 10; p.doors = [makeDoor({ passagesPerHour: 1, hoursPerDay: 16, protection: 'nenhuma', adjacentT: 12 })]; } },
  { id: 'frigorifico', name: 'Frigorífico (carcaças)', desc: 'Resfriamento de carcaças bovinas', apply: (p) => { p.room.Tin = 0; p.room.RHin = 0.9; p.product.typeId = 'carne-bovina'; p.product.Tenter = 38; p.product.Tfinal = 7; p.product.coolingHours = 20; p.product.dailyMass = 30000; p.product.packaging = 'nenhuma'; p.system.defrost = 'agua'; p.doors = [makeDoor({ type: 'correr-trilho', passagesPerHour: 10, adjacentT: 15, protection: 'nenhuma' })]; } },
  { id: 'laticinio', name: 'Laticínio', desc: 'Resfriamento de leite e derivados', apply: (p) => { p.room.Tin = 4; p.room.RHin = 0.85; p.product.typeId = 'leite'; p.product.Tenter = 10; p.product.Tfinal = 4; p.product.packaging = 'plastico'; p.system.defrost = 'ar'; } },
  { id: 'cd', name: 'Centro de distribuição', desc: 'Muitas docas e alta movimentação', apply: (p) => { p.room = { ...p.room, length: 60, width: 40, height: 10, Tin: -20, RHin: 0.9 }; p.product.typeId = 'congelados'; p.product.Tenter = -12; p.product.Tfinal = -20; p.product.dailyMass = 150000; p.product.storedMass = 3000000; p.product.packaging = 'madeira'; p.product.packagingFraction = 0.05; p.internal = { people: 8, peopleHours: 16, lightingWm2: 6, lightingHours: 20, equipmentKW: 24, equipmentHours: 16, otherKW: 0 }; p.system.defrost = 'gas-quente'; p.system.runHours = 20; p.envelope.wallThk = 150; p.envelope.roofThk = 200; p.envelope.floorInsulated = true; p.envelope.floorThk = 150; p.climate.Tground = 10; p.climate.solarRoof = 'media'; p.doors = [0.2, 0.4, 0.6, 0.8].map((pos) => makeDoor({ type: 'seccional', width: 2.5, height: 3, wall: 'frente', position: pos, passagesPerHour: 12, hoursPerDay: 16, adjacentT: 10, adjacentRH: 0.7, protection: 'pvc', traffic: 'empilhadeira', secondsPerPassage: 25 })); } },
  { id: 'alimenticia', name: 'Indústria alimentícia', desc: 'Câmara de matéria-prima a +2 °C', apply: (p) => { p.room.Tin = 2; p.product.typeId = 'outros'; p.system.defrost = 'ar'; } },
  { id: 'farmaceutica', name: 'Indústria farmacêutica', desc: 'Armazenagem de +2 a +8 °C', apply: (p) => { p.room.Tin = 5; p.room.RHin = 0.6; p.product.typeId = 'medicamentos'; p.product.Tenter = 20; p.product.Tfinal = 5; p.product.dailyMass = 2000; p.product.storedMass = 20000; p.system.defrost = 'ar'; p.system.architecture = 'indireto'; } },
  { id: 'agua-gelada', name: 'Processo com água gelada', desc: 'Chiller ou banco de gelo', apply: (p) => { p.system.architecture = 'indireto'; p.doors = []; p.product.dailyMass = 0; } },
  { id: 'personalizado', name: 'Sistema personalizado', desc: 'Partir de valores genéricos', apply: () => {} },
];

export function projectFor(app: AppId, name?: string): Project {
  const p = baseProject();
  p.application = app;
  APPLICATIONS.find((a) => a.id === app)?.apply(p);
  p.name = name ?? APPLICATIONS.find((a) => a.id === app)?.name ?? p.name;
  return p;
}

/** Cenários de demonstração completos. As premissas estão em cada campo e podem ser editadas. */
export const DEMOS: { id: string; title: string; desc: string; build: () => Project }[] = [
  {
    id: 'conservacao', title: 'Câmara de conservação de resfriados', desc: '20 × 12 × 6 m a +2 °C, carnes embaladas e uma porta de correr com cortina de PVC.',
    build: () => { const p = projectFor('resfriamento', 'Demo 1 · Câmara de conservação (+2 °C)'); p.confirmed = { dimensoes: true, temperaturas: true }; return p; },
  },
  {
    id: 'congelados', title: 'Câmara de congelados', desc: '30 × 20 × 8 m a −22 °C, painéis de 150 mm e piso aquecido.',
    build: () => { const p = projectFor('conservacao', 'Demo 2 · Câmara de congelados (−22 °C)'); p.room = { ...p.room, length: 30, width: 20, height: 8, Tin: -22 }; p.product.dailyMass = 20000; p.product.storedMass = 600000; p.doors = [makeDoor({ width: 2, height: 3, adjacentT: 10, passagesPerHour: 10, hoursPerDay: 14, traffic: 'empilhadeira' })]; p.internal.equipmentKW = 8; p.internal.equipmentHours = 8; p.confirmed = { dimensoes: true, temperaturas: true, isolamento: true }; return p; },
  },
  {
    id: 'laticinio', title: 'Laticínio', desc: 'Câmara de produtos lácteos a +4 °C, com recebimento diário de 12 t.',
    build: () => { const p = projectFor('laticinio', 'Demo 3 · Laticínio (+4 °C)'); p.room = { ...p.room, length: 25, width: 15, height: 6 }; p.product.dailyMass = 12000; p.product.storedMass = 50000; p.doors = [makeDoor({ passagesPerHour: 15, hoursPerDay: 12 }), makeDoor({ type: 'portinhola', width: 0.8, height: 0.8, wall: 'esquerda', passagesPerHour: 20, hoursPerDay: 10, secondsPerPassage: 8, protection: 'nenhuma', traffic: 'pessoas' })]; p.confirmed = { dimensoes: true, temperaturas: true, produto: true }; return p; },
  },
  {
    id: 'cd', title: 'Centro de distribuição', desc: '60 × 40 × 10 m a −20 °C, com 4 docas seccionais e empilhadeiras.',
    build: () => { const p = projectFor('cd', 'Demo 4 · Centro de distribuição (−20 °C)'); p.confirmed = { dimensoes: true, temperaturas: true, portas: true }; return p; },
  },
  {
    id: 'agua', title: 'Sistema de água gelada', desc: 'Processo de 20 m³/h de 12 para 2 °C durante 8 h/dia, com banco de gelo.',
    build: () => { const p = projectFor('agua-gelada', 'Demo 5 · Água gelada com banco de gelo'); p.room = { ...p.room, length: 8, width: 4, height: 3, Tin: 2 }; p.confirmed = { temperaturas: true, operacao: true }; return p; },
  },
];
