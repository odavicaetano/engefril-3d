/**
 * Modelo CAD normalizado (independente do leitor) e detecção de formato por conteúdo.
 * Arquivos CAD são tratados como não confiáveis: nada é executado, apenas lido, com limites de tamanho e entidades.
 */
export type CadFormat = 'dwg' | 'dxf' | 'bak';
export type Pt = [number, number];
export type Geo =
  | { kind: 'line'; a: Pt; b: Pt }
  | { kind: 'poly'; pts: Pt[]; closed: boolean }
  | { kind: 'arc'; c: Pt; r: number; a0: number; a1: number } // ângulos em radianos, sentido anti-horário
  | { kind: 'circle'; c: Pt; r: number }
  | { kind: 'text'; p: Pt; h: number; text: string }
  | { kind: 'insert'; name: string; p: Pt; rot: number; sx: number; sy: number }
  | { kind: 'face3d'; pts: Pt[] }
  | { kind: 'dim'; p: Pt; text: string };
export interface CadEntity { id: number; type: string; layer: string; block?: string; geo: Geo }
export interface CadLayer { name: string; count: number; color?: number; off?: boolean; frozen?: boolean }
export interface CadModel {
  fileName: string;
  format: CadFormat;
  sourceFormat: 'dwg' | 'dxf'; // conteúdo real (um BAK contém DWG)
  version: string; // AC1032…
  versionName: string; // "AutoCAD 2018–2025"
  insunits: number; // $INSUNITS
  extents: { min: Pt; max: Pt };
  layers: CadLayer[];
  entities: CadEntity[];
  blocks: string[];
  stats: Record<string, number>;
  unsupported: Record<string, number>;
  warnings: string[];
  has3d: boolean;
}

export const LIMITS = { maxBytes: 50 * 1024 * 1024, maxEntities: 250_000, maxBlockDepth: 4, timeoutMs: 60_000 };

/** Versões do formato DWG (assinatura dos 6 primeiros bytes). */
export const DWG_VERSIONS: Record<string, string> = {
  AC1009: 'AutoCAD R11/R12', AC1012: 'AutoCAD R13', AC1014: 'AutoCAD R14', AC1015: 'AutoCAD 2000–2002', AC1018: 'AutoCAD 2004–2006',
  AC1021: 'AutoCAD 2007–2009', AC1024: 'AutoCAD 2010–2012', AC1027: 'AutoCAD 2013–2017', AC1032: 'AutoCAD 2018–2025',
};
/** $INSUNITS → nome e fator para metros. */
export const UNITS: Record<number, { name: string; toM: number }> = {
  1: { name: 'in', toM: 0.0254 }, 2: { name: 'ft', toM: 0.3048 }, 4: { name: 'mm', toM: 0.001 }, 5: { name: 'cm', toM: 0.01 }, 6: { name: 'm', toM: 1 },
};
export const UNIT_CHOICES = [{ id: 'mm', toM: 0.001 }, { id: 'cm', toM: 0.01 }, { id: 'm', toM: 1 }, { id: 'in', toM: 0.0254 }, { id: 'ft', toM: 0.3048 }] as const;

export interface Detection {
  ok: boolean;
  declared: string; // extensão
  format?: CadFormat;
  sourceFormat?: 'dwg' | 'dxf';
  version?: string; versionName?: string;
  binaryDxf?: boolean;
  message: string;
}

/** Identifica o formato pelo conteúdo (não pela extensão). Um BAK só é aceito se contiver um DWG ou DXF válido. */
export function detectCad(name: string, bytes: Uint8Array): Detection {
  const ext = (name.split('.').pop() ?? '').toLowerCase();
  const head = new TextDecoder('latin1').decode(bytes.slice(0, 64));
  const declared = ext;
  if (bytes.length === 0) return { ok: false, declared, message: 'Arquivo vazio.' };
  if (bytes.length > LIMITS.maxBytes) return { ok: false, declared, message: `Arquivo de ${(bytes.length / 1048576).toFixed(1)} MB excede o limite de ${LIMITS.maxBytes / 1048576} MB.` };
  if (['dwt', 'dws'].includes(ext)) return { ok: false, declared, message: `Arquivos .${ext} (modelo/padrões do AutoCAD) não são suportados nesta versão. Salve o desenho como DWG ou DXF.` };
  const sig = head.slice(0, 6);
  if (/^AC\d{4}$/.test(sig)) {
    const versionName = DWG_VERSIONS[sig];
    if (!versionName) return { ok: false, declared, message: `Assinatura DWG ${sig} não reconhecida (versão antiga ou desconhecida).` };
    if (sig === 'AC1009' || sig === 'AC1012') return { ok: false, declared, version: sig, versionName, message: `${versionName} (${sig}) é anterior ao suporte do leitor. Salve como DWG 2000 ou mais recente, ou como DXF.` };
    const format: CadFormat = ext === 'bak' ? 'bak' : 'dwg';
    return { ok: true, declared, format, sourceFormat: 'dwg', version: sig, versionName, message: ext === 'bak' ? `Backup do AutoCAD contendo um DWG válido (${versionName}).` : ext === 'dwg' ? `DWG ${versionName}.` : `Conteúdo DWG (${versionName}) em arquivo .${ext}.` };
  }
  if (head.startsWith('AutoCAD Binary DXF')) return { ok: false, declared, binaryDxf: true, message: 'DXF binário não é suportado. Salve como DXF ASCII.' };
  const txt = new TextDecoder('utf-8').decode(bytes.slice(0, 4096));
  if (/^\s*(999\s*\r?\n[^\n]*\r?\n\s*)?0\s*\r?\nSECTION\s*\r?\n/i.test(txt)) {
    const ver = /\$ACADVER\s*\r?\n\s*1\s*\r?\n\s*(AC\d{4})/.exec(new TextDecoder('utf-8').decode(bytes.slice(0, 65536)))?.[1] ?? '';
    const format: CadFormat = ext === 'bak' ? 'bak' : 'dxf';
    return { ok: true, declared, format, sourceFormat: 'dxf', version: ver || 'DXF', versionName: ver ? `DXF ${DWG_VERSIONS[ver] ?? ver}` : 'DXF (versão não declarada)', message: ext === 'bak' ? 'Backup contendo DXF ASCII.' : 'DXF ASCII.' };
  }
  if (ext === 'bak') return { ok: false, declared, message: 'Este arquivo .bak não contém um desenho AutoCAD (assinatura DWG ou DXF ausente). Nem todo BAK é backup de desenho.' };
  return { ok: false, declared, message: `Formato não reconhecido para .${ext || 'sem extensão'}: assinatura DWG/DXF ausente. Renomear a extensão não converte o arquivo.` };
}

/** Converte unidades: fator para metros a partir de $INSUNITS ou estimativa pelas dimensões (sinalizada). */
export function unitGuess(model: CadModel): { unit: string; toM: number; confident: boolean; reason: string } {
  const u = UNITS[model.insunits];
  if (u) return { unit: u.name, toM: u.toM, confident: true, reason: `Declarada no arquivo ($INSUNITS = ${model.insunits}).` };
  const span = Math.max(model.extents.max[0] - model.extents.min[0], model.extents.max[1] - model.extents.min[1]);
  if (span > 2000) return { unit: 'mm', toM: 0.001, confident: false, reason: `Unidade não declarada; extensão de ${span.toFixed(0)} unidades sugere milímetros.` };
  if (span > 300) return { unit: 'cm', toM: 0.01, confident: false, reason: `Unidade não declarada; extensão de ${span.toFixed(0)} unidades sugere centímetros.` };
  return { unit: 'm', toM: 1, confident: false, reason: `Unidade não declarada; extensão de ${span.toFixed(1)} unidades sugere metros.` };
}
