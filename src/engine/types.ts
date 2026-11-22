import type { Architecture } from './cycle';
import type { DoorTypeId, ProtectionKey, SolarKey } from '../data/materials';

export type Wall = 'frente' | 'fundo' | 'esquerda' | 'direita';
export interface Door {
  id: string;
  type: DoorTypeId;
  width: number; height: number; // m
  count: number;
  wall: Wall; position: number; // 0..1 ao longo da parede
  passagesPerHour: number; // aberturas (passagens) por hora durante a operação
  hoursPerDay: number; // horas de operação com tráfego
  secondsPerPassage: number; // θp: tempo de abertura+fechamento por passagem [s]
  minutesOpenPerHour: number; // θo: tempo em que a porta fica simplesmente aberta [min/h]
  adjacentT: number; adjacentRH: number; // ambiente do lado de fora da porta
  protection: ProtectionKey;
  traffic: 'pessoas' | 'paleteira' | 'empilhadeira';
  sealGood: boolean;
}

export type AppId =
  | 'resfriamento' | 'congelamento' | 'conservacao' | 'tunel' | 'frigorifico' | 'laticinio'
  | 'cd' | 'alimenticia' | 'farmaceutica' | 'agua-gelada' | 'personalizado';

export interface Project {
  version: 1;
  name: string;
  application: AppId;
  room: { length: number; width: number; height: number; count: number; Tin: number; RHin: number; areaMode: 'dims' | 'area'; area: number; aspect: number };
  climate: { label: string; Tout: number; RHout: number; Tground: number; solarWalls: SolarKey; solarRoof: SolarKey };
  envelope: { insulation: string; wallThk: number; roofThk: number; floorThk: number; floorInsulated: boolean; thermalBridgePct: number; lambdaOverride: number | null };
  doors: Door[];
  product: { typeId: string; storedMass: number; dailyMass: number; Tenter: number; Tfinal: number; coolingHours: number; packaging: string; packagingFraction: number; turnoverDays: number };
  internal: { people: number; peopleHours: number; lightingWm2: number; lightingHours: number; equipmentKW: number; equipmentHours: number; otherKW: number };
  system: {
    architecture: Architecture; runHours: number; safetyFactor: number; defrost: 'nenhum' | 'ar' | 'agua' | 'gas-quente' | 'eletrico';
    evapTD: number; condApproach: number; etaIs: number; etaMotor: number; superheat: number; subcool: number;
    fanDp: number; fanEta: number; airDT: number; defrostEff: number; condAuxPct: number; frameHeaterWm: number;
  };
  process: { flow: number; Tin: number; Tout: number; hoursPerDay: number; strategy: 'chiller' | 'banco-gelo' };
  finance: { tariff: number; operatingDays: number; investment: number | null; investmentSource: string; maintenance: number | null };
  confirmed: Partial<Record<ConfirmKey, boolean>>;
  /** Origem da geometria quando importada de arquivo CAD (DWG/BAK/DXF). */
  cadImport?: CadImportRecord;
}

export interface CadImportRecord {
  fileName: string;
  format: 'dwg' | 'dxf' | 'bak';
  version: string; // ex.: AC1032 (AutoCAD 2018)
  unit: string; // unidade adotada para o desenho (mm, cm, m, in, ft)
  scale: number; // fator do desenho para metros
  rotationDeg: number;
  importedAt: string;
  layers: string[]; // camadas importadas
  mapping: Record<string, string>; // camada -> categoria
  /** Linhas de referência 2D (metros, coordenadas da câmara: x ao longo do comprimento, z da frente para o fundo), [x1, z1, x2, z2, ...] */
  ref: number[];
  /** Origem de cada parâmetro preenchido pela importação. */
  provenance: Record<string, string>;
  warnings: string[];
}
export type ConfirmKey = 'dimensoes' | 'temperaturas' | 'portas' | 'produto' | 'isolamento' | 'internas' | 'clima' | 'operacao';
