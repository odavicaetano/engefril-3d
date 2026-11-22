import type { Origin } from './sources';

export interface Fact { text: string; origin: Origin }
export interface EquipInfo {
  kind: string; name: string; fn: string; principle: string; applications: string[];
  facts: Fact[]; variables: string[]; pros: string[]; cons: string[]; url?: string; engefril: boolean;
  how: { text: string; cut?: 'longitudinal' | 'transversal' | 'horizontal' | 'parcial'; explode?: number; opacity?: number }[];
}

export const EQUIPMENT: Record<string, EquipInfo> = {
  evaporador: {
    kind: 'evaporador', name: 'Evaporador (resfriador de ar)', engefril: true, url: 'https://engefril.com.br/produtos/equipamentos-frigorificos/evaporadores/',
    fn: 'Retira calor do ar da câmara. O refrigerante evapora dentro dos tubos enquanto os ventiladores forçam o ar através das aletas.',
    principle: 'O ar cede calor sensível (e latente, ao condensar umidade ou formar gelo) às aletas. A amônia, em temperatura de saturação abaixo da do ar, absorve esse calor como calor latente de vaporização.',
    applications: ['Túneis de congelamento e resfriamento', 'Câmaras de carcaças', 'Câmaras de estocagem', 'Ambientes climatizados e com controle de umidade'],
    facts: [
      { text: 'Tubos em aço inoxidável Ø 15,87 mm (ASTM A-269) com aletas de alumínio corrugadas', origin: 'oficial' },
      { text: 'Passo de aletas de 5, 8 e 11,2 mm; colarinho “full collar”; arranjo triangular', origin: 'oficial' },
      { text: 'Teste de pressão de fábrica a 25 kg/cm²', origin: 'oficial' },
      { text: 'Gabinete em chapa galvanizada pré-pintada de 1,25 mm (inox ou alumínio opcionais)', origin: 'oficial' },
      { text: 'Degelo natural por ar (passo de 5 mm, ambientes acima de 0 °C), água e/ou gás quente nos demais casos', origin: 'oficial' },
      { text: 'Fluidos: amônia (circulação forçada ou gravidade), halogenados, água e glicol', origin: 'oficial' },
      { text: 'A página não publica capacidades nem modelos: a seleção exige consulta técnica', origin: 'oficial' },
      { text: 'Aletas mais espaçadas toleram mais acúmulo de gelo entre degelos, o que é típico de baixas temperaturas', origin: 'referencia' },
    ],
    variables: ['Diferença de temperatura ar–evaporação (TD)', 'Vazão de ar e alcance do jato', 'Passo de aletas e frequência de degelo', 'Taxa de recirculação do refrigerante'],
    pros: ['Ampla faixa de capacidade e customização', 'Inox resiste à amônia e à limpeza sanitária'],
    cons: ['Formação de gelo reduz a troca térmica e exige degelo', 'Ventiladores dissipam calor dentro da câmara'],
    how: [
      { text: 'O ar quente da câmara é aspirado pela parte de trás do evaporador.', opacity: 1 },
      { text: 'O corte mostra o interior: o ar atravessa centenas de aletas finas de alumínio presas aos tubos de inox.', cut: 'longitudinal', opacity: 0.5 },
      { text: 'Dentro dos tubos, a amônia evapora em baixa pressão. A mudança de fase absorve o calor do ar.', cut: 'transversal' },
      { text: 'Na vista explodida aparecem o gabinete, a bateria aletada, os ventiladores e a bandeja de dreno.', explode: 1 },
    ],
  },
  condensador: {
    kind: 'condensador', name: 'Condensador evaporativo', engefril: true, url: 'https://engefril.com.br/produtos/equipamentos-frigorificos/condensador-evaporativo/',
    fn: 'Rejeita para a atmosfera o calor retirado da câmara somado à energia do compressor, condensando o vapor de amônia.',
    principle: 'A água pulverizada sobre a serpentina evapora em parte; o calor latente dessa evaporação resfria os tubos. Por isso o desempenho depende da temperatura de bulbo úmido do ar, e não da de bulbo seco.',
    applications: ['Sistemas industriais de amônia de médio e grande porte'],
    facts: [
      { text: 'Serpentina em aço carbono Ø 25,4 mm × 1,5 mm galvanizado a fogo, ou inox AISI 304 Ø 22,22 mm × 1,0 mm', origin: 'oficial' },
      { text: 'Teste de pressão da serpentina a 25 kgf/cm²', origin: 'oficial' },
      { text: 'Tubos com inclinação constante até o coletor de saída, para drenagem do óleo e menor retenção de refrigerante', origin: 'oficial' },
      { text: 'Gabinete e bacia em PRFV; ventiladores axiais com motores IP55; bomba centrífuga monobloco', origin: 'oficial' },
      { text: 'Opcionais: bomba reserva e circuito fechado para resfriamento dos cabeçotes dos compressores', origin: 'oficial' },
      { text: 'As tabelas de capacidade estão publicadas como imagem e não foram transcritas: os valores não são usados no simulador', origin: 'oficial' },
      { text: 'A temperatura de condensação de projeto costuma ficar alguns kelvins acima do bulbo úmido local', origin: 'referencia' },
    ],
    variables: ['Temperatura de bulbo úmido de projeto', 'Calor rejeitado (kW)', 'Qualidade e tratamento da água', 'Controle de capacidade dos ventiladores'],
    pros: ['Permite condensar mais baixo que condensadores a ar, o que melhora o COP', 'Equipamento compacto para grandes capacidades'],
    cons: ['Consome água (evaporação, purga e arraste)', 'Exige tratamento de água e controle microbiológico'],
    how: [
      { text: 'O vapor quente de amônia entra pela parte de cima da serpentina.' },
      { text: 'Os bicos pulverizam água sobre os tubos, enquanto os ventiladores puxam ar de baixo para cima.', cut: 'longitudinal', opacity: 0.4 },
      { text: 'A água que evapora retira calor dos tubos e a amônia condensa por dentro. O ar quente e úmido sai pelo topo.', cut: 'transversal' },
      { text: 'O eliminador de gotas retém a água arrastada. A bacia recolhe a água para a bomba recircular.', explode: 1 },
    ],
  },
  compressor: {
    kind: 'compressor', name: 'Compressor parafuso', engefril: false,
    fn: 'Aspira o vapor de baixa pressão e o comprime até a pressão de condensação.',
    principle: 'Dois rotores helicoidais engrenados (macho e fêmea) formam cavidades que diminuem de volume à medida que giram. Óleo injetado veda, lubrifica e resfria a compressão; um separador de óleo o recupera na descarga.',
    applications: ['Sistemas industriais de amônia de média e alta capacidade', 'Estágios de baixa (booster) e de alta'],
    facts: [
      { text: 'Na lista de produtos consultada, a Engefril não fabrica compressores. Ela projeta e executa a instalação com compressores de terceiros', origin: 'oficial' },
      { text: 'Na amônia, a temperatura de descarga é elevada; nos compressores parafuso, a injeção de óleo a controla', origin: 'referencia' },
      { text: 'Neste simulador, a potência vem do ciclo termodinâmico com eficiência isentrópica informada (padrão de 75%, hipótese)', origin: 'hipotese' },
    ],
    variables: ['Relação de compressão', 'Eficiência isentrópica e volumétrica', 'Controle de capacidade (válvula slide, inversor)', 'Temperatura de descarga'],
    pros: ['Operação contínua, robusta e com poucas peças móveis', 'Ampla faixa de capacidade'],
    cons: ['Eficiência em carga parcial depende do método de controle', 'Sistema de óleo exige separador e resfriamento'],
    how: [
      { text: 'O motor elétrico aciona o compressor pelo acoplamento.' },
      { text: 'Com a carcaça cortada, aparecem os dois rotores helicoidais girando em sentidos opostos.', cut: 'longitudinal', opacity: 0.35 },
      { text: 'Entre os lóbulos, o vapor é aprisionado e empurrado para regiões cada vez menores: a pressão sobe.', cut: 'horizontal' },
      { text: 'Na vista explodida: motor, compressor e separador de óleo.', explode: 1 },
    ],
  },
  recipiente: {
    kind: 'recipiente', name: 'Reservatório de amônia (recipiente de líquido)', engefril: true, url: 'https://engefril.com.br/produtos/equipamentos-frigorificos/reservatorio-de-amonia/',
    fn: 'Acumula o líquido condensado em alta pressão e absorve as variações de carga de refrigerante do sistema.',
    principle: 'O líquido drena do condensador por gravidade. O nível varia conforme a quantidade de amônia que está nos evaporadores.',
    applications: ['Todos os sistemas centrais de amônia'],
    facts: [
      { text: 'Projeto conforme ASME Seção VIII Div. 1 e NR-13', origin: 'oficial' },
      { text: 'Chapas ASTM A-516 Gr 60 e Gr 70; conexões SCH40/SCH80; berços de apoio', origin: 'oficial' },
      { text: 'Soldadores qualificados ASME IX; teste hidrostático e líquido penetrante; prontuário NR-13', origin: 'oficial' },
      { text: 'Acessórios: visor de nível tipo reflex com válvulas de bloqueio, válvula de segurança dupla, manômetro e dreno', origin: 'oficial' },
      { text: 'Volume e pressão de projeto não são publicados', origin: 'oficial' },
    ],
    variables: ['Carga total de amônia', 'Volume de bombeamento (pump-down)', 'Pressão de projeto'],
    pros: ['Estabiliza a alimentação dos consumidores'], cons: ['Concentra grande parte da carga de amônia: exige vaso de pressão inspecionado'],
    how: [{ text: 'O corte mostra o nível de líquido (azul) e o espaço de vapor acima.', cut: 'longitudinal', opacity: 0.6 }],
  },
  separador: {
    kind: 'separador', name: 'Separador de líquido', engefril: true, url: 'https://engefril.com.br/a-engefril/',
    fn: 'Separa líquido e vapor na baixa pressão: envia só vapor ao compressor e mantém líquido para alimentar os evaporadores.',
    principle: 'A mistura que volta dos evaporadores perde velocidade no vaso; as gotas caem por gravidade. Nos sistemas bombeados, as bombas aspiram o líquido do fundo.',
    applications: ['Recirculação bombeada', 'Sistemas inundados por gravidade', 'Estágio de baixa em duplo estágio'],
    facts: [
      { text: '“Separadores de líquido” e “depósitos de NH3” constam na lista de produtos da Engefril; a página consultada não traz especificações técnicas', origin: 'oficial' },
      { text: 'O dimensionamento segue a velocidade de vapor que permite a separação das gotas, conforme a literatura (ASHRAE, IIAR)', origin: 'referencia' },
    ],
    variables: ['Vazão de vapor de sucção', 'Taxa de recirculação', 'Nível de operação (NPSH das bombas)'],
    pros: ['Protege o compressor contra golpe de líquido', 'Permite evaporadores inundados, com melhor troca térmica'],
    cons: ['Aumenta a carga de amônia do sistema'],
    how: [{ text: 'O corte mostra o líquido no fundo e o vapor acima, que segue para a sucção.', cut: 'longitudinal', opacity: 0.6 }],
  },
  bomba: {
    kind: 'bomba', name: 'Bomba de amônia', engefril: false, fn: 'Recircula o líquido frio do separador até os evaporadores (overfeed).',
    principle: 'Bomba centrífuga ou de rotor blindado que envia várias vezes a vazão evaporada, mantendo os tubos do evaporador molhados.',
    applications: ['Sistemas de recirculação bombeada'],
    facts: [
      { text: 'Neste simulador, a potência é estimada pela vazão recirculada (taxa 4) com Δp de 200 kPa e eficiência global de 50% (hipóteses)', origin: 'hipotese' },
    ],
    variables: ['Taxa de recirculação', 'NPSH disponível', 'Perda de carga até o evaporador mais distante'], pros: ['Distribuição uniforme em instalações extensas'], cons: ['Exige NPSH adequado e manutenção da vedação'],
    how: [{ text: 'A bomba aspira líquido do separador e o envia aos evaporadores.' }],
  },
  intercooler: {
    kind: 'intercooler', name: 'Resfriador intermediário', engefril: false, fn: 'Em sistemas de duplo estágio, resfria o vapor de descarga do compressor de baixa e sub-resfria o líquido.',
    principle: 'Vaso aberto (flash) na pressão intermediária. O vapor quente borbulha no líquido saturado e sai como vapor saturado para o estágio de alta.',
    applications: ['Congelamento e túneis com evaporação abaixo de cerca de −30 °C'],
    facts: [{ text: 'A pressão intermediária usada no simulador é a média geométrica √(Pe·Pc), a aproximação clássica para trabalho mínimo', origin: 'referencia' }],
    variables: ['Pressão intermediária', 'Vazão do estágio de alta'], pros: ['Reduz a temperatura de descarga e melhora o COP'], cons: ['Mais equipamentos e mais controle'],
    how: [{ text: 'O corte mostra o nível de líquido onde o vapor da baixa é resfriado.', cut: 'longitudinal', opacity: 0.6 }],
  },
  trocador: {
    kind: 'trocador', name: 'Trocador a placas (chiller)', engefril: true, url: 'https://engefril.com.br/produtos/equipamentos-frigorificos/sistema-chiller/',
    fn: 'Transfere calor do fluido secundário (água ou glicol) para a amônia, que evapora.',
    principle: 'Placas corrugadas formam canais alternados; a turbulência e a grande área permitem aproximações de temperatura pequenas.',
    applications: ['Laticínios, frigoríficos e indústria alimentícia', 'Sistemas indiretos com glicol'],
    facts: [
      { text: 'O Sistema Chiller Engefril reúne compressor, condensador, trocador a placas e separador de líquido em um único equipamento, com opção de skid', origin: 'oficial' },
      { text: 'Atende água ou glicóis (etilenoglicol e propilenoglicol); capacidades em “vários ranges”, sem valores publicados', origin: 'oficial' },
    ],
    variables: ['Aproximação de temperatura', 'Risco de congelamento com água abaixo de cerca de +3 °C'], pros: ['Compacto', 'Reduz a carga de amônia em áreas ocupadas'], cons: ['Penalidade de temperatura e bombeamento do secundário'],
    how: [{ text: 'A vista explodida separa o pacote de placas.', explode: 1 }],
  },
  tanque: {
    kind: 'tanque', name: 'Tanque de água gelada compacto de NH₃ (banco de gelo)', engefril: true, url: 'https://engefril.com.br/produtos/equipamentos-frigorificos/tanque-de-agua-gelada-compacto-de-nh3/',
    fn: 'Acumula frio na forma de gelo ao longo do dia para atender picos de carga com água a cerca de +1 a +2 °C.',
    principle: 'A amônia evapora nas serpentinas submersas e forma gelo ao redor dos tubos. A água de processo volta quente e derrete o gelo; o agitador uniformiza a mistura.',
    applications: ['Laticínios e processos com cargas concentradas em picos curtos'],
    facts: [
      { text: 'Água gelada com temperatura média de cerca de +1 a +2 °C', origin: 'oficial' },
      { text: 'Serpentina acumuladora em tubo de aço carbono (DIN 2440 ou SCH40)', origin: 'oficial' },
      { text: 'Tanque em chapa de 3/16″ com divisória vertical para forçar a circulação; isolamento em painéis de 100 mm; agitador', origin: 'oficial' },
      { text: 'O dimensionamento considera rotina de processo, recebimento e tempo de resfriamento; volumes não publicados', origin: 'oficial' },
    ],
    variables: ['Energia diária do processo', 'Duração dos picos', 'Horas disponíveis para formar gelo'], pros: ['Reduz a capacidade frigorífica instalada', 'Fornece água próxima de 0 °C sem risco de congelar trocadores'], cons: ['Evaporação mais baixa reduz o COP', 'Ocupa espaço'],
    how: [{ text: 'O corte mostra as serpentinas com o gelo formado e a água ao redor.', cut: 'longitudinal', opacity: 0.5 }],
  },
  camara: {
    kind: 'camara', name: 'Câmara frigorífica com painéis termoisolantes', engefril: true, url: 'https://engefril.com.br/produtos/portas-de-refrigeracao/painel-termoisolante/',
    fn: 'Envelope isolado que limita a entrada de calor no ambiente refrigerado.',
    principle: 'O núcleo isolante tem baixa condutividade. O fluxo de calor é U·A·ΔT, com U ≈ λ/espessura somado às resistências superficiais.',
    applications: ['Câmaras de resfriados e congelados, túneis, docas e salas climatizadas'],
    facts: [
      { text: 'Núcleo de EPS auto-extinguível de 15 kg/m³ (NBR 11948, DIN 4102/1), laminação contínua', origin: 'oficial' },
      { text: 'Chapas galvanizadas pré-pintadas de 0,50 mm, adesivo PU bicomponente, classe R1 (NBR 7358), encaixe macho-fêmea', origin: 'oficial' },
      { text: 'A espessura do painel não é publicada; as folhas de porta usam painéis de 35 a 250 mm', origin: 'oficial' },
      { text: 'Condutividade usada no simulador: 0,038 W/m·K, valor típico de EPS nessa densidade', origin: 'referencia' },
    ],
    variables: ['Espessura e condutividade do isolamento', 'Pontes térmicas e vedação das juntas', 'Isolamento e aquecimento do piso (congelados)'],
    pros: ['Montagem rápida', 'Desempenho térmico previsível'], cons: ['Exige barreira de vapor e cuidado com as juntas'],
    how: [{ text: 'Com o corte transversal da câmara, aparecem a espessura dos painéis, os evaporadores e a estocagem.', cut: 'transversal', opacity: 0.8 }],
  },
  painel: { kind: 'painel', name: 'Painel elétrico e de controle', engefril: true, url: 'https://engefril.com.br/a-engefril/', fn: 'Comanda e protege motores, intertravamentos, alarmes e a automação da instalação.', principle: 'Controladores leem pressões, temperaturas e níveis e acionam compressores, bombas, ventiladores e degelos.', applications: ['Todas as instalações'], facts: [{ text: '“Painel elétrico” consta na lista de produtos da Engefril; não há especificações publicadas', origin: 'oficial' }], variables: ['Lógica de controle de capacidade', 'Intertravamentos de segurança'], pros: ['Centraliza a operação'], cons: [], how: [{ text: 'O painel concentra a automação da sala de máquinas.' }] },
  valvulas: { kind: 'valvulas', name: 'Quadro de válvulas', engefril: true, url: 'https://engefril.com.br/a-engefril/', fn: 'Agrupa as válvulas de controle e bloqueio que alimentam e isolam cada consumidor e o degelo.', principle: 'Solenoides, válvulas de expansão/regulagem e bloqueios manuais montados em conjunto para facilitar a operação.', applications: ['Distribuição para evaporadores e degelo'], facts: [{ text: '“Quadro de válvulas” consta na lista de produtos da Engefril; não há especificações publicadas', origin: 'oficial' }], variables: ['Sequência de degelo', 'Regulagem de pressão'], pros: ['Facilita a manutenção e o isolamento de trechos'], cons: [], how: [{ text: 'Cada consumidor tem seu conjunto de válvulas.' }] },
  sensor: { kind: 'sensor', name: 'Detector de amônia', engefril: false, fn: 'Mede a concentração de NH₃ no ar e aciona alarmes, ventilação e intertravamentos.', principle: 'Sensores eletroquímicos ou de semicondutor, instalados conforme a densidade do gás (mais leve que o ar) e os pontos prováveis de vazamento.', applications: ['Salas de máquinas', 'Câmaras e áreas com tubulação de amônia'], facts: [{ text: 'Os níveis de alarme e as ações automáticas são definidos pelo projeto conforme as normas aplicáveis (ex.: ANSI/IIAR 2, ABNT NBR 16069)', origin: 'referencia' }], variables: ['Posição e altura de instalação', 'Calibração periódica'], pros: ['Detecção precoce'], cons: ['Exige calibração e testes periódicos'], how: [{ text: 'O detector pisca quando ativo; ver o módulo de segurança.' }] },
  exaustor: { kind: 'exaustor', name: 'Exaustor de emergência', engefril: true, url: 'https://engefril.com.br/a-engefril/', fn: 'Ventila a sala de máquinas em caso de vazamento, acionado pelos detectores.', principle: 'Retira o ar contaminado pela parte alta, já que a amônia é mais leve que o ar.', applications: ['Salas de máquinas de amônia'], facts: [{ text: '“Extrator de ar” consta na lista de produtos da Engefril; não há especificações publicadas', origin: 'oficial' }], variables: ['Vazão de exaustão de emergência', 'Tomada de ar de reposição'], pros: [], cons: [], how: [{ text: 'O exaustor fica na parte alta da parede da sala de máquinas.' }] },
};
export const infoFor = (id: string | null) => (id ? EQUIPMENT[id.replace(/-\d+$/, '').replace('sensor-sala', 'sensor').replace('sensor-camara', 'sensor').replace('bomba-glicol', 'bomba')] ?? null : null);

/** Biblioteca de tecnologias e fluidos alternativos (comparação qualitativa com referências). */
export const ALTERNATIVES = [
  { name: 'Amônia (R717)', app: 'Industrial, de médio a grande porte', eff: 'Alta', safety: 'Tóxica; inflamável em faixa estreita (classe B2L, ASHRAE 34)', env: 'GWP 0, ODP 0', complexity: 'Alta: exige sala de máquinas e operador qualificado', note: 'Referência deste simulador.' },
  { name: 'CO₂ (R744) em cascata com NH₃', app: 'Congelamento e baixa temperatura', eff: 'Alta em baixa temperatura', safety: 'Não tóxico em baixas concentrações, mas asfixiante; pressões altas', env: 'GWP 1', complexity: 'Alta', note: 'Reduz a carga de NH₃ nas áreas ocupadas. Não é intercambiável sem um novo projeto.' },
  { name: 'Sistema indireto com glicol', app: 'Processos, laticínios, áreas ocupadas', eff: 'Média, pela penalidade de temperatura e bombeamento', safety: 'NH₃ confinada à sala de máquinas', env: 'Depende do primário', complexity: 'Média', note: 'Modelado no simulador como arquitetura “indireto”.' },
  { name: 'HFCs/HFOs (ex.: R404A, R448A, R449A)', app: 'Comercial e pequena indústria', eff: 'Média', safety: 'Classe A1 (não tóxico, não inflamável) ou A2L', env: 'GWP de moderado a alto (HFC), com restrições crescentes', complexity: 'Baixa a média', note: 'Não intercambiável com sistemas de NH₃: materiais (cobre), óleo e componentes diferem.' },
  { name: 'Hidrocarbonetos (R290)', app: 'Pequenas cargas, equipamentos plug-in e chillers', eff: 'Alta', safety: 'Altamente inflamável (A3)', env: 'GWP ~3', complexity: 'Média', note: 'Limites de carga por norma.' },
];
