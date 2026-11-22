import type { Origin } from './sources';

export interface Insulation { id: string; name: string; lambda: number; lambdaRange: [number, number]; origin: Origin; note: string }
export const INSULATIONS: Insulation[] = [
  {
    id: 'eps-engefril', name: 'Painel Engefril: EPS 15 kg/m³', lambda: 0.038, lambdaRange: [0.036, 0.040], origin: 'referencia',
    note: 'Núcleo EPS auto-extinguível de 15 kg/m³ com chapas de 0,50 mm (dado oficial). A condutividade de 0,038 W/m·K é um valor típico de literatura para essa densidade (EN 13163), não um dado publicado pela Engefril.',
  },
  { id: 'eps-25', name: 'EPS 25–30 kg/m³ (genérico)', lambda: 0.034, lambdaRange: [0.032, 0.036], origin: 'referencia', note: 'Valor típico de literatura.' },
  { id: 'pur', name: 'PUR/PIR (genérico)', lambda: 0.023, lambdaRange: [0.021, 0.026], origin: 'referencia', note: 'Valor envelhecido típico. Não consta no catálogo Engefril consultado.' },
  { id: 'xps', name: 'XPS (genérico)', lambda: 0.034, lambdaRange: [0.032, 0.036], origin: 'referencia', note: 'Típico para pisos isolados.' },
];
export const insulationById = (id: string) => INSULATIONS.find((i) => i.id === id) ?? INSULATIONS[0];
/** Espessuras usuais de painéis. A Engefril informa folhas de porta de 35 a 250 mm; a espessura do painel em si não é publicada. */
export const PANEL_THICKNESSES = [50, 75, 100, 125, 150, 200, 250];

/** Correção solar de temperatura (K), ASHRAE Refrigeration cap. 24 (valores convertidos de °F). */
export const SOLAR = {
  nenhuma: { name: 'Sem exposição solar (interna)', wall: 0, roof: 0 },
  clara: { name: 'Superfície clara exposta', wall: 2.2, roof: 5.0 },
  media: { name: 'Superfície média exposta', wall: 3.3, roof: 8.3 },
  escura: { name: 'Superfície escura exposta', wall: 4.4, roof: 11.1 },
} as const;
export type SolarKey = keyof typeof SOLAR;

/** Efetividade de dispositivos de proteção de porta (E): faixas citadas na literatura (ASHRAE cap. 24). */
export const DOOR_PROTECTION = {
  nenhuma: { name: 'Nenhuma', E: 0, range: [0, 0] as [number, number] },
  pvc: { name: 'Cortina de tiras de PVC', E: 0.85, range: [0.6, 0.95] as [number, number] },
  ar: { name: 'Cortina de ar', E: 0.7, range: [0.5, 0.8] as [number, number] },
  antecamara: { name: 'Antecâmara refrigerada', E: 0.6, range: [0.4, 0.8] as [number, number] },
} as const;
export type ProtectionKey = keyof typeof DOOR_PROTECTION;

export const DOOR_TYPES = [
  { id: 'correr', name: 'Porta de correr (sem passagem de trilho)', url: 'https://engefril.com.br/produtos/portas-de-refrigeracao/porta-de-correr-sem-passagem-de-trilho/' },
  { id: 'correr-trilho', name: 'Porta de correr (com passagem de trilho)', url: 'https://engefril.com.br/produtos/portas-de-refrigeracao/porta-de-correr-com-passagem-de-trilho/' },
  { id: 'giratoria', name: 'Porta giratória', url: 'https://engefril.com.br/produtos/portas-de-refrigeracao/porta-giratoria-sem-passagem-de-trilho/' },
  { id: 'seccional', name: 'Porta seccional (docas)', url: 'https://engefril.com.br/produtos/portas-de-refrigeracao/porta-seccional/' },
  { id: 'portinhola', name: 'Portinhola', url: 'https://engefril.com.br/produtos/portas-de-refrigeracao/portinhola/' },
] as const;
export type DoorTypeId = (typeof DOOR_TYPES)[number]['id'];
