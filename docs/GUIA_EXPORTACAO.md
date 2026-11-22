# Guia de aplicação: padrão de exportação ENGEFRIL 3D (PDF A4 e planilhas)

Guia curto para replicar o padrão em outros repositórios da família ENGEFRIL 3D. O padrão não declara normas oficiais da Engefril: as cores são medições do site e valores provisórios, com status "a validar".

## 1. Tokens de identidade
- Fonte única: [`src/design/design-tokens.json`](../src/design/design-tokens.json). Copie o arquivo e o acessor [`src/design/tokens.ts`](../src/design/tokens.ts).
- Cada cor traz `status`: `medido` (extraída do favicon ou logotipo publicados), `provisório` (documento mestre interno) ou `derivado` (interface). Não chame de "oficial" nenhuma cor que não tenha sido confirmada no manual de marca.
- Decisão registrada: o azul principal adotado é `#0069AE` (medido no favicon). O `#145078` do documento mestre fica como alternativa não adotada, conforme a regra do próprio documento de priorizar o que foi extraído do site.
- Interface web: `applyCssTokens()` aplica as cores como variáveis CSS. PDF: `rgb(token)`. Planilha: `argb(token)`.
- Tipografia: Aptos/Segoe UI/Arial na web, Helvetica no PDF (fonte padrão, sem incorporar arquivos), Arial na planilha.
- Logotipo: o símbolo vetorizado é desenhado com `drawLogo()` (mesmos vértices do favicon), uma vez por página. Ele nunca é redesenhado, esticado ou recolorido. Não há versão negativa oficial pública: sobre fundo escuro usa-se o símbolo original, até a arte oficial ser fornecida.

## 2. Componentes PDF ([`src/report/kit.ts`](../src/report/kit.ts))
| Componente | Uso |
|---|---|
| `PdfComposer` | Documento A4 com orientação por página (`auto`: texto em retrato, desenhos em paisagem), metadados, idioma pt-BR e marcadores |
| `PDFHeader` / `PDFFooter` | Cabeçalho discreto nas páginas de texto; rodapé com classificação, revisão, data e numeração (o rodapé não entra nas folhas de desenho) |
| `Cover` | Capa com símbolo, título, projeto, cliente (se informado), classificação "Estudo preliminar" e quadro de identificação |
| `SectionTitle` / `SubTitle` | Seções numeradas (página nova) registradas no sumário e nos marcadores |
| `TechnicalTable` | Cabeçalho azul repetido a cada página, linhas alternadas, alinhamento por coluna, linha de total |
| `Disclaimer` | Aviso de pré-dimensionamento orientativo (sem assinatura, CREA, ART ou validação) |
| `frame`, `drawingArea`, `sheetHead`, `titleBlock`, `dimH`/`dimV`, `scaleBar` | Primitivas de TechnicalDrawing: moldura (margens da NBR 10068), legenda (carimbo), cotas (NBR 10126), escala gráfica (NBR 8196) |
| `finalize(tocPage?)` | Rodapés, legendas, sumário com links e marcadores |

Exemplos completos: [`technical.ts`](../src/report/technical.ts) (Relatório Técnico Completo com seções selecionáveis) e [`pdf.ts`](../src/report/pdf.ts) (Relatório Comercial).

## 3. Planilhas ([`src/report/spreadsheet.ts`](../src/report/spreadsheet.ts))
- Abas: Sobre, Resumo, Entradas, Cálculos, Equipamentos, Cenários, Fontes e Premissas (ajuste ao projeto).
- `SpreadsheetTheme`: cabeçalho azul-escuro, linhas alternadas, formatos numéricos (o Excel exibe o separador pt-BR conforme a localidade), data `dd/mm/aaaa`.
- Cada valor traz a coluna **Tipo** (Entrada, Fórmula, Resultado do motor, Referência), além do estilo: entradas com fundo amarelo e negrito, fórmulas em itálico azul. A distinção não depende só de cor.
- Cabeçalhos congelados, filtros e validação de dados nas entradas editáveis. Sem macros e sem vínculos externos.
- As fórmulas da aba Cálculos referenciam a aba Entradas e são verificadas por teste: um avaliador recalcula as fórmulas e compara com o motor, para que planilha e PDF mostrem os mesmos números.
- CSV: UTF-8 com BOM, separador `;`, decimal com vírgula.

## 4. Diálogo e nomes de arquivo
- [`ExportDialog`](../src/ui/ExportDialog.tsx): formato (PDF A4 ou planilha), tipo de relatório, seções, orientação, revisão, cliente, comparação A×B, pré-visualização e botões "Exportar PDF", "Exportar planilha (XLSX)" e "CSV", com estado de carregamento e mensagem de erro.
- Nome padronizado (`standardFileName`): `ENGEFRIL3D_<projeto>_<tipo>_<revisão>_<AAAAMMDD>.<ext>`, sem acentos.
- Os documentos são gerados dos dados do projeto e do motor de cálculo, nunca de números fixos. A única captura de tela é a perspectiva 3D opcional, identificada como ilustrativa.

## 5. Verificação mínima ao replicar
1. Gerar o PDF em retrato, paisagem e automático, com seções omitidas, cliente preenchido e caracteres acentuados.
2. Conferir que todas as páginas são A4, que há sumário, marcadores, metadados e texto selecionável, e que não há cortes nem sobreposições.
3. Abrir a planilha, editar uma entrada (tarifa) e conferir a propagação; comparar os totais com o PDF.
4. Testes de referência: [`report.test.ts`](../src/report/report.test.ts) e [`spreadsheet.test.ts`](../src/report/spreadsheet.test.ts).
