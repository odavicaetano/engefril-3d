# Importação de desenhos CAD (DWG, BAK, DXF)

## Decisões técnicas
| Tema | Decisão |
|---|---|
| Leitura de DWG | GNU LibreDWG compilado para WebAssembly (`@mlightcad/libredwg-web`, **GPL-3.0**), executado no navegador. O repositório passou a ser licenciado em GPL-3.0-or-later para cumprir a licença. |
| Leitura de DXF | `dxf-parser` (MIT), mais tolerante que o importador DXF do LibreDWG, que perdia definições de bloco nos testes. |
| Alternativas avaliadas | ODA SDK (licença comercial paga); Autodesk Platform Services (nuvem: exige conta e chave de API e envia o desenho a terceiros); outros leitores no npm são derivados do LibreDWG (GPL-2.0, GPL-3.0 ou AGPL). |
| Privacidade | O arquivo é lido localmente, num Web Worker. Nada é enviado a servidores. |
| Segurança | Conteúdo não confiável: apenas leitura, sem execução de macros ou scripts embutidos. Limites de 50 MB, 250 000 entidades, 4 níveis de blocos aninhados e 60 s (o worker é encerrado ao estourar o tempo). |
| Formatos | `.dwg` de AutoCAD 2000 a 2025 (AC1015 a AC1032). `.bak` somente se a assinatura for de DWG ou DXF. `.dxf` ASCII. Recusados com orientação: DXF binário, DWG R11/R12/R13, `.dwt`, `.dws` e extensões renomeadas sem assinatura válida. |

## Fluxo (Arquivo → Leitura → Unidades → Mapeamento → Prévia 3D → Confirmar)
1. **Arquivo:** seleção ou arraste, com ícones e explicações de DWG, BAK e DXF.
2. **Leitura:** formato identificado pelo conteúdo, versão, unidades ($INSUNITS), contagem de entidades, camadas e blocos, avisos (Xrefs ausentes, proxies AEC, geometria 3D, tipos não suportados).
3. **Unidades:** unidade (estimada e sinalizada quando não declarada), orientação da frente (0° ou 180°), seleção de camadas e prévia 2D com zoom e pan.
4. **Mapeamento:** camadas → categorias (sugestões por nome, editáveis); câmara reconhecida com grau de confiança; espessura de parede por contornos concêntricos; portas por arcos de abertura, vãos ou blocos; equipamentos apenas como indício "precisa de revisão".
5. **Prévia 3D:** comparação antes/depois, planta 2D e vista isométrica da câmara extrudada com a altura informada.
6. **Confirmar:** aplicar ao projeto (desfazível com Ctrl+Z) ou abrir como cenário B, lado a lado com o projeto atual.

## Regras de interpretação
- Blocos e nomes de camada são pistas, não provas. Nenhum equipamento é criado automaticamente.
- Diâmetros, materiais, pressões, capacidade frigorífica e requisitos de segurança não são inferidos do desenho.
- A altura não existe em planta: é sempre informada pelo usuário e registrada como tal.
- A origem de cada parâmetro importado fica em `project.cadImport.provenance` e aparece no memorial descritivo do PDF e na planilha.
- As linhas das camadas importadas aparecem como referência 2D no piso da cena 3D. Há um botão na barra de ferramentas para ocultá-las.

## Limitações conhecidas
- Objetos AEC proprietários (proxies), Xrefs não anexadas, fontes SHX e geometrias complexas (hachuras, sólidos ACIS) não são convertidos. São listados como não suportados ou como referência.
- O reconhecimento automático cobre câmaras retangulares (polilinha fechada ou quatro linhas encadeadas) e uma câmara por importação. Plantas com várias câmaras exigem escolher a câmara na etapa de mapeamento.
- A rotação é 0° ou 180°: por convenção, o comprimento é o maior lado.

## Testes ([`src/cad/cad.test.ts`](../src/cad/cad.test.ts))
DWG 2D (2000 e 2018), DWG 3D com blocos (2018), BAK válido, BAK inválido, extensão renomeada, DWT recusado, DWG truncado, DXF em mm com paredes, portas, bloco e linha duplicada, DXF sem unidade, escala errada, DXF 3D, Xref ausente, DXF corrompido, filtro por camada e aplicação não destrutiva com extrusão e uso no PDF.

Os DWG de teste (`test/fixtures/cad/sample_*.dwg`, `example_2018.dwg`) vêm do repositório do GNU LibreDWG (test/test-data, GPL-3.0). Os DXF são gerados por [`scripts/gen-cad-fixtures.mjs`](../scripts/gen-cad-fixtures.mjs).
