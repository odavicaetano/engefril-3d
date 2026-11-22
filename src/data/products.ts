/**
 * Propriedades térmicas de produtos. O teor de água e o ponto inicial de congelamento seguem valores
 * típicos da literatura (ASHRAE Handbook—Refrigeration, cap. 19). Calor específico e latente vêm das
 * equações de Siebel, uma aproximação que superestima o calor latente porque ignora a água não congelável.
 * A taxa de respiração (frutas e verduras) é uma ordem de grandeza com incerteza elevada.
 */
export interface ProductType {
  id: string; name: string;
  water: number; // fração mássica de água
  tFreeze: number | null; // °C (null = não se aplica / não congela no processo)
  resp0?: number; resp10?: number; // W/kg a 0 °C e 10 °C (respiração)
  cpOverride?: number; // kJ/kg.K, quando Siebel não se aplica
  note?: string;
}
export const PRODUCTS: ProductType[] = [
  { id: 'carne-bovina', name: 'Carnes bovinas (cortes)', water: 0.70, tFreeze: -1.7 },
  { id: 'carne-suina', name: 'Carnes suínas', water: 0.60, tFreeze: -2.2 },
  { id: 'aves', name: 'Aves (frango)', water: 0.66, tFreeze: -2.8 },
  { id: 'pescados', name: 'Pescados (peixe magro)', water: 0.81, tFreeze: -2.2 },
  { id: 'leite', name: 'Laticínios: leite', water: 0.88, tFreeze: -0.6 },
  { id: 'queijo', name: 'Laticínios: queijo maturado', water: 0.37, tFreeze: -12.9 },
  { id: 'frutas', name: 'Frutas (ex.: maçã)', water: 0.84, tFreeze: -1.1, resp0: 0.01, resp10: 0.04 },
  { id: 'verduras', name: 'Verduras (ex.: alface)', water: 0.95, tFreeze: -0.2, resp0: 0.04, resp10: 0.12 },
  { id: 'bebidas', name: 'Bebidas (cerveja, refrigerante)', water: 0.90, tFreeze: -2.2 },
  { id: 'sorvete', name: 'Sorvetes', water: 0.61, tFreeze: -5.6 },
  { id: 'congelados', name: 'Produtos congelados (diversos)', water: 0.70, tFreeze: -2.0 },
  { id: 'medicamentos', name: 'Medicamentos embalados', water: 0, tFreeze: null, cpOverride: 2.0, note: 'cp genérico hipotético; usar dados do fabricante.' },
  { id: 'outros', name: 'Outros (personalizado)', water: 0.75, tFreeze: -2.0 },
];
export const productById = (id: string) => PRODUCTS.find((p) => p.id === id) ?? PRODUCTS[PRODUCTS.length - 1];

export function productProps(p: ProductType) {
  const cpAbove = p.cpOverride ?? 3.349 * p.water + 0.837;
  const cpBelow = p.cpOverride ?? 1.256 * p.water + 0.837;
  const latent = p.tFreeze === null ? 0 : 334 * p.water;
  return { cpAbove, cpBelow, latent, tFreeze: p.tFreeze };
}
export function respiration(p: ProductType, T: number): number {
  if (p.resp0 === undefined || p.resp10 === undefined) return 0;
  if (T < -0.5) return 0;
  // interpolação exponencial entre 0 e 10 °C (Q10), limitada à faixa usual
  const q = p.resp10 / p.resp0;
  return p.resp0 * Math.pow(q, Math.min(20, T) / 10);
}

export const PACKAGING = [
  { id: 'nenhuma', name: 'Sem embalagem relevante', cp: 0 },
  { id: 'papelao', name: 'Caixas de papelão', cp: 1.4 },
  { id: 'plastico', name: 'Caixas plásticas', cp: 1.9 },
  { id: 'madeira', name: 'Paletes de madeira', cp: 2.5 },
];
