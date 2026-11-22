// Gera arquivos DXF de teste (ASCII, R2000) para a importação CAD. Executar: node scripts/gen-cad-fixtures.mjs
// Os desenhos são sintéticos e descrevem uma câmara retangular com paredes de painel, portas e blocos.
import { writeFileSync, mkdirSync } from 'node:fs';

const out = 'test/fixtures/cad';
mkdirSync(out, { recursive: true });

let handle = 0x100;
const h = () => (handle++).toString(16).toUpperCase();
const pairs = (arr) => arr.map(([c, v]) => `${String(c).padStart(3, ' ')}\n${v}`).join('\n');

function header(insunits) {
  return pairs([[0, 'SECTION'], [2, 'HEADER'], [9, '$ACADVER'], [1, 'AC1015'], [9, '$INSUNITS'], [70, insunits], [0, 'ENDSEC']]);
}
function tables(layers) {
  const rows = [[0, 'SECTION'], [2, 'TABLES'], [0, 'TABLE'], [2, 'LAYER'], [5, h()], [100, 'AcDbSymbolTable'], [70, layers.length]];
  for (const [name, color] of layers) rows.push([0, 'LAYER'], [5, h()], [100, 'AcDbSymbolTableRecord'], [100, 'AcDbLayerTableRecord'], [2, name], [70, 0], [62, color], [6, 'CONTINUOUS']);
  rows.push([0, 'ENDTAB'], [0, 'ENDSEC']);
  return pairs(rows);
}
const ent = (type, layer, body) => [[0, type], [5, h()], [100, 'AcDbEntity'], [8, layer], ...body];
const lwpoly = (layer, pts, closed = true) => ent('LWPOLYLINE', layer, [[100, 'AcDbPolyline'], [90, pts.length], [70, closed ? 1 : 0], ...pts.flatMap(([x, y]) => [[10, x], [20, y]])]);
const line = (layer, a, b) => ent('LINE', layer, [[100, 'AcDbLine'], [10, a[0]], [20, a[1]], [30, 0], [11, b[0]], [21, b[1]], [31, 0]]);
const arc = (layer, c, r, a0, a1) => ent('ARC', layer, [[100, 'AcDbCircle'], [10, c[0]], [20, c[1]], [30, 0], [40, r], [100, 'AcDbArc'], [50, a0], [51, a1]]);
const circle = (layer, c, r) => ent('CIRCLE', layer, [[100, 'AcDbCircle'], [10, c[0]], [20, c[1]], [30, 0], [40, r]]);
const text = (layer, p, ht, s) => ent('TEXT', layer, [[100, 'AcDbText'], [10, p[0]], [20, p[1]], [30, 0], [40, ht], [1, s], [100, 'AcDbText']]);
const face3d = (layer, pts) => ent('3DFACE', layer, [[100, 'AcDbFace'], ...pts.flatMap(([x, y, z], i) => [[10 + i, x], [20 + i, y], [30 + i, z]])]);
const rect = (layer, x0, y0, x1, y1) => lwpoly(layer, [[x0, y0], [x1, y0], [x1, y1], [x0, y1]]);

function doc(insunits, layers, entities, blocks = []) {
  const blk = blocks.length ? pairs([[0, 'SECTION'], [2, 'BLOCKS'], ...blocks.flat(), [0, 'ENDSEC']]) : '';
  return [header(insunits), tables(layers), blk, pairs([[0, 'SECTION'], [2, 'ENTITIES'], ...entities.flat(), [0, 'ENDSEC'], [0, 'EOF']])].filter(Boolean).join('\n') + '\n';
}

// 1) Câmara 20 × 12 m em milímetros, painel de 100 mm (contorno interno e externo), porta de 1,5 m na parede inferior,
//    porta de abrir (arco) na parede direita, bloco EVAPORADOR, cotas como texto e linha duplicada.
{
  const L = 20000, W = 12000, t = 100;
  const ents = [
    rect('PAREDE-INT', 0, 0, L, W),
    rect('PAREDE-EXT', -t, -t, L + t, W + t),
    line('PORTA', [5000, -t], [6500, -t]), line('PORTA', [5000, 0], [6500, 0]),
    arc('PORTA', [L, 3000], 1200, 90, 180),
    line('TUBULACAO', [-3000, 6000], [2000, 6000]), line('TUBULACAO', [-3000, 6000], [2000, 6000]),
    text('TEXTO', [8000, 6000], 300, 'CAMARA 01 - +2 C'),
    ent('INSERT', 'EQUIPAMENTOS', [[100, 'AcDbBlockReference'], [2, 'EVAPORADOR'], [10, 10000], [20, 11200], [30, 0], [41, 1], [42, 1], [43, 1], [50, 0]]),
  ];
  const blocks = [[[0, 'BLOCK'], [5, h()], [100, 'AcDbEntity'], [8, '0'], [100, 'AcDbBlockBegin'], [2, 'EVAPORADOR'], [70, 0], [10, 0], [20, 0], [30, 0], [3, 'EVAPORADOR'], [1, ''], ...rect('0', -1200, -500, 1200, 500), [0, 'ENDBLK'], [5, h()], [100, 'AcDbEntity'], [8, '0'], [100, 'AcDbBlockEnd']]];
  writeFileSync(`${out}/camara-mm.dxf`, doc(4, [['0', 7], ['PAREDE-INT', 1], ['PAREDE-EXT', 1], ['PORTA', 3], ['TUBULACAO', 5], ['TEXTO', 7], ['EQUIPAMENTOS', 4]], ents, blocks));
}
// 2) Mesma câmara em metros, sem unidade declarada (INSUNITS = 0), só o contorno interno
writeFileSync(`${out}/camara-m-sem-unidade.dxf`, doc(0, [['0', 7], ['CAMARA', 1]], [rect('CAMARA', 0, 0, 30, 18)]));
// 3) Desenho 3D (faces) para verificar o aviso de geometria 3D
writeFileSync(`${out}/faces-3d.dxf`, doc(6, [['0', 7], ['SOLIDOS', 2]], [face3d('SOLIDOS', [[0, 0, 0], [5, 0, 0], [5, 0, 3], [0, 0, 3]]), face3d('SOLIDOS', [[0, 0, 0], [0, 4, 0], [0, 4, 3], [0, 0, 3]]), circle('SOLIDOS', [2, 2], 0.5)]));
// 4) Arquivo com cabeçalho DXF mas truncado (corrompido)
writeFileSync(`${out}/corrompido.dxf`, doc(4, [['0', 7]], [rect('0', 0, 0, 10, 10)]).slice(0, 180));
// 5) "BAK" que não é desenho CAD
writeFileSync(`${out}/nao-cad.bak`, 'Backup de planilha qualquer, sem conteúdo CAD.\n'.repeat(20));
// 6) Referência externa (Xref) não incluída: bloco com flag 4 e caminho externo
{
  const blocks = [[[0, 'BLOCK'], [5, h()], [100, 'AcDbEntity'], [8, '0'], [100, 'AcDbBlockBegin'], [2, 'PLANTA-BASE'], [70, 4], [10, 0], [20, 0], [30, 0], [3, 'PLANTA-BASE'], [1, 'C:/obras/planta-base.dwg'], [0, 'ENDBLK'], [5, h()], [100, 'AcDbEntity'], [8, '0'], [100, 'AcDbBlockEnd']]];
  const ents = [rect('CAMARA', 0, 0, 15, 10), ent('INSERT', 'XREF', [[100, 'AcDbBlockReference'], [2, 'PLANTA-BASE'], [10, 0], [20, 0], [30, 0]])];
  writeFileSync(`${out}/xref-ausente.dxf`, doc(6, [['0', 7], ['CAMARA', 1], ['XREF', 8]], ents, blocks));
}
console.log('fixtures DXF geradas em', out);
