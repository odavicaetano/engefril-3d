# ENGEFRIL 3D: Refrigeração Industrial Interativa

Protótipo demonstrativo de visualização 3D, ensino e pré-dimensionamento de refrigeração industrial por amônia (R717), com a Engefril como referência.
**Não tem vínculo, parceria nem aprovação oficial da Engefril.** O símbolo do floco de neve foi vetorizado a partir do favicon público de engefril.com.br e é marca do seu titular; o uso em produção exige autorização.

## Executar

```powershell
npm install
npm run dev        # http://localhost:5173
npm test           # 28 testes do motor de cálculo
npm run build      # build de produção (PWA) em dist/
npm run gen:r717   # regenera as tabelas de propriedades da amônia com o CoolProp
npm run gen:icons  # regenera favicon.ico e os PNG a partir de public/favicon.svg
```

## 1. Síntese da pesquisa

### Engefril: páginas lidas em 22/11/2026 (todas carregaram)
Páginas lidas: home, A Engefril, Soluções, Portfólio, Produtos, Evaporadores, Condensador evaporativo, Reservatório de amônia, Sistema Chiller, Tanque de água gelada compacto de NH₃, as 6 páginas de portas, EPS e Painel termoisolante (as duas URLs).

| Dado oficial confirmado | Fonte |
|---|---|
| Evaporadores: tubos inox Ø15,87 mm (ASTM A-269), aletas de alumínio corrugadas com passo de 5, 8 ou 11,2 mm, teste a 25 kg/cm², gabinete galvanizado de 1,25 mm, degelo por ar (passo 5 mm, ambiente > 0 °C), por água ou por gás quente | /evaporadores/ |
| Condensador evaporativo: tubo de aço carbono Ø25,4 × 1,5 mm galvanizado a fogo ou inox 304 Ø22,22 × 1,0 mm, PRFV, ventiladores IP55, bomba monobloco | /condensador-evaporativo/ |
| Reservatório de amônia: ASME VIII Div. 1, NR-13, chapas ASTM A-516 Gr 60/70, válvula de segurança dupla, visor reflex | /reservatorio-de-amonia/ |
| Sistema Chiller: compressor, condensador, trocador a placas e separador em um único equipamento; água ou glicóis | /sistema-chiller/ |
| Tanque de água gelada de NH₃: banco de gelo, água a +1 a +2 °C, painéis de 100 mm, agitador | /tanque-de-agua-gelada-compacto-de-nh3/ |
| Portas: correr (com e sem trilho), giratória, seccional, portinhola, Officedoor; folhas de 35 a 250 mm com EPS; marco de 0,95 mm com resistência para congelados | /portas-de-refrigeracao/* |
| Painel: EPS auto-extinguível de 15 kg/m³, chapas de 0,50 mm, classe R1 (NBR 7358), encaixe macho-fêmea | /painel-termoisolante/ |
| Matriz em Santa Luzia (MG); segmentos: frigoríficos, laticínios, CDs, alimentícia, farmacêutica, pesqueira | /a-engefril/ |

**Não publicado (por isso o simulador não usa):** capacidades em kW ou TR, modelos, dimensões, preços e espessuras de painel. As tabelas de capacidade do condensador estão em imagem e não foram transcritas. Separadores, depósitos de NH₃, quadro de válvulas, painel elétrico e extrator de ar só aparecem listados. Pela lista consultada, a Engefril **não fabrica compressores**.

**Identidade visual:** azul `#0069AE` e cinza `#9C9AA0` foram medidos em pixels do favicon oficial; o grafite (~`#484848`) foi medido no logotipo. São medições, não códigos oficiais confirmados. A tipografia do site é Montserrat; o app usa fontes do sistema para funcionar offline.

### Referências externas
- **Consultada nesta sessão:** CoolProp 6.6 (pacote `coolprop-wasm`), executado para gerar as tabelas do R717 e os pontos psicrométricos de validação.
- **Citadas de conhecimento técnico, sem consulta online nesta sessão:** ASHRAE Handbook (Refrigeration, cap. 19 e 24; Fundamentals, cap. 1), IIAR, NR-13, NR-15, NR-36, ABNT NBR 16069 e EN 13163. Na interface, esses valores aparecem como “Referência técnica externa” e devem ser conferidos na edição vigente antes de qualquer uso de projeto. Exemplos: teor de água e ponto de congelamento dos produtos, correção solar, efetividade de cortinas, limites de exposição.

## 2. Metodologia (motor em `src/engine`, sem dependência da interface)
- **R717:** tabelas CoolProp de saturação (−70 a 120 °C) e vapor superaquecido (até +280 K), com referência IIR e interpolação cúbica/bilinear. Os testes medem desvio de entalpia menor que 1,5 kJ/kg contra o CoolProp em pontos fora da grade.
- **Psicrometria:** Hyland & Wexler e equações ASHRAE, validadas contra o HAPropsSI.
- **Cargas (ASHRAE cap. 24):** transmissão U·A·ΔT com correção solar e pontes térmicas; infiltração por porta pelo método de Gosney & Olama, com Dt, Df (0,7 a 1,1) e E da proteção (não é percentual arbitrário); produto por Siebel (sensível, latente, sub-congelamento, embalagem, respiração); pessoas (272 − 6t); iluminação; motores; ventiladores pela vazão de ar necessária (iterativo); degelo pela massa de gelo da umidade infiltrada; resistências de marco. Capacidade = maior entre a média diária e o pico de produto, mais o fator de segurança, sem dupla contagem.
- **Ciclos:** DX, gravidade, bombeado (com potência de bomba), duplo estágio com intercooler aberto e indireto com glicol. Balanço de energia verificado (erro menor que 1e-6).
- **Qualidade dos dados:** exploratório, preliminar ou detalhado, conforme as etapas confirmadas, com margem de ±20, ±10 ou ±5%. A faixa combina variantes baixa e alta das incertezas da literatura. Há sensibilidade (tornado) para 7 parâmetros.
- **Arquitetura:** `engine/` (cálculo) · `data/` (catálogo, fontes, cenários) · `state/` (zustand, desfazer/refazer, persistência) · `scene/` (R3F: layout puro, materiais com corte, equipamentos, edificações) · `modes/` (comercial, aprendizado, técnico) · `report/` (PDF) · `ui/`.

## 3. Estado de implementação

**Funcional e verificado no navegador:** tela inicial com cena animada; três modos integrados sem recarregar; cena 3D com sala de máquinas, compressores parafuso com rotores internos, condensador com serpentina, spray, eliminador e ventiladores, evaporadores aletados, vasos com nível de líquido, bombas, intercooler, trocador a placas, banco de gelo, painel, válvulas, detectores e exaustor; câmara com painéis na espessura real, portas por tipo com abertura animada e troca de ar por densidade, estocagem proporcional à massa; tubulação com isolamento e faixas de identificação; fluxo por fase; corte 3D real (longitudinal, transversal, horizontal, quadrante) com faces de seção preenchidas; transparência, vista explodida, aramado, ocultar e isolar; perspectivas e limites de câmera; assistente comercial em 10 etapas; resultados com faixa, gráficos, conclusões condicionadas e dados faltantes; famílias de equipamentos sem atribuir capacidade a modelos; troca de arquitetura com recálculo e mudança do circuito; comparador A/B com melhorias rápidas, vista 3D lado a lado (câmeras sincronizáveis, indicadores com variação percentual, empilhada no celular) e payback apenas com investimento informado; PDF institucional; tour PLAY com estados termodinâmicos, controles e narração pelo TTS do navegador; visão molecular com processos; experimentos com antes e depois; quiz; modo técnico com parâmetros, unidades, P-h, T-s, balanço, COP × Te e comparação de arquiteturas; biblioteca; segurança; salvar, importar e exportar JSON; link compartilhável (cenário no hash); PNG; apresentação; desfazer e refazer; PWA offline; favicons ICO, SVG e PNG.

**Limitações conhecidas:**
- A câmera tem limites de piso e distância, mas não colisão com equipamentos.
- N câmaras iguais aparecem como uma só (os cálculos multiplicam).
- A vista lado a lado usa dois contextos WebGL; em aparelhos modestos, prefira a qualidade gráfica média ou baixa.
- “Como funciona?” é uma sequência de corte, explosão e legenda, não uma animação dedicada por equipamento.
- Energia calculada só na condição de projeto (sem carga parcial ou sazonalidade).
- As perdas do tanque de água gelada não são calculadas.
- Em desenvolvimento, o React 19 emite avisos “synchronously unmount” vindos dos rótulos `Html` do drei. Não afetam o funcionamento.
