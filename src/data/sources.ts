/** Classificação da origem de cada informação exibida na plataforma. */
export type Origin = 'oficial' | 'referencia' | 'calculado' | 'hipotese';
export const ORIGIN_LABEL: Record<Origin, string> = {
  oficial: 'Dado oficial Engefril',
  referencia: 'Referência técnica externa',
  calculado: 'Estimativa calculada',
  hipotese: 'Hipótese demonstrativa',
};

export interface Source { id: string; title: string; url?: string; note: string }

export const SOURCES: Source[] = [
  { id: 'engefril-home', title: 'Engefril: página inicial', url: 'https://engefril.com.br/', note: 'Posicionamento “Da fabricação à execução da obra”; slogan “Mais frio, com menos energia”. Consultada em 22/11/2026.' },
  { id: 'engefril-sobre', title: 'Engefril: A Engefril', url: 'https://engefril.com.br/a-engefril/', note: 'Matriz em Santa Luzia (MG), lista de produtos e segmentos atendidos.' },
  { id: 'engefril-produtos', title: 'Engefril: Produtos', url: 'https://engefril.com.br/produtos/', note: 'Índice do catálogo: equipamentos frigoríficos, portas, painel e EPS.' },
  { id: 'engefril-evap', title: 'Engefril: Evaporadores', url: 'https://engefril.com.br/produtos/equipamentos-frigorificos/evaporadores/', note: 'Tubos inox Ø15,87 mm (ASTM A-269), aletas de alumínio corrugadas com passo de 5, 8 e 11,2 mm, teste a 25 kg/cm², tipos de degelo e de montagem.' },
  { id: 'engefril-cond', title: 'Engefril: Condensador evaporativo', url: 'https://engefril.com.br/produtos/equipamentos-frigorificos/condensador-evaporativo/', note: 'Serpentina em aço carbono Ø25,4 mm galvanizado a fogo ou inox AISI 304 Ø22,22 mm; teste a 25 kgf/cm²; gabinete e bacia em PRFV; ventiladores axiais IP55; bomba centrífuga monobloco. As tabelas de capacidade estão publicadas como imagem e não foram transcritas.' },
  { id: 'engefril-rar', title: 'Engefril: Reservatório de amônia', url: 'https://engefril.com.br/produtos/equipamentos-frigorificos/reservatorio-de-amonia/', note: 'Projeto ASME VIII Div. 1 e NR-13; chapas ASTM A-516 Gr 60/70; visor de nível reflex, válvula de segurança dupla, manômetro e dreno.' },
  { id: 'engefril-chiller', title: 'Engefril: Sistema Chiller', url: 'https://engefril.com.br/produtos/equipamentos-frigorificos/sistema-chiller/', note: 'Compressor, condensador, trocador a placas e separador de líquido em um único equipamento; água ou glicóis; opção de skid compacto.' },
  { id: 'engefril-tanque', title: 'Engefril: Tanque de água gelada compacto de NH3', url: 'https://engefril.com.br/produtos/equipamentos-frigorificos/tanque-de-agua-gelada-compacto-de-nh3/', note: 'Acumulação de gelo para cargas de pico; água gelada a cerca de +1 a +2 °C; isolamento em painéis de 100 mm; agitador.' },
  { id: 'engefril-portas', title: 'Engefril: Portas de refrigeração', url: 'https://engefril.com.br/produtos/portas-de-refrigeracao/', note: 'Correr com e sem passagem de trilho, giratória, seccional, portinhola e Officedoor. Folhas em painel de 35 a 250 mm com núcleo EPS; marco em chapa de 0,95 mm; resistência no marco para câmaras de congelados.' },
  { id: 'engefril-painel', title: 'Engefril: Painel termoisolante', url: 'https://engefril.com.br/produtos/portas-de-refrigeracao/painel-termoisolante/', note: 'Núcleo EPS auto-extinguível de 15 kg/m³ (NBR 11948, DIN 4102/1), chapas galvanizadas pré-pintadas de 0,50 mm, adesivo PU, classe R1 (NBR 7358) e encaixe macho-fêmea. A espessura do painel não é informada na página.' },
  { id: 'engefril-eps', title: 'Engefril: EPS', url: 'https://engefril.com.br/produtos/portas-de-refrigeracao/eps/', note: 'Blocos, placas e lajes de EPS, com densidades de cerca de 9 a 35 kg/m³ (unidade com erro tipográfico na página).' },
  { id: 'ashrae-ref-24', title: 'ASHRAE Handbook—Refrigeration, cap. 24: Refrigerated-Facility Loads', note: 'Método de cargas de transmissão, infiltração por portas (Gosney & Olama), fatores Dt, Df e E, cargas de pessoas, iluminação e motores, fator de segurança e tempo de operação.' },
  { id: 'ashrae-ref-19', title: 'ASHRAE Handbook—Refrigeration, cap. 19: Thermal Properties of Foods', note: 'Teor de água e ponto inicial de congelamento; equações de Siebel para calor específico e latente.' },
  { id: 'ashrae-fund-1', title: 'ASHRAE Handbook—Fundamentals, cap. 1: Psychrometrics', note: 'Hyland & Wexler (1983) e propriedades do ar úmido.' },
  { id: 'coolprop', title: 'CoolProp 6.6 (Bell et al., 2014)', url: 'http://www.coolprop.org/', note: 'Propriedades do R717 e do ar úmido usadas para gerar as tabelas internas da plataforma.' },
  { id: 'iiar', title: 'IIAR: International Institute of Ammonia Refrigeration (ANSI/IIAR 2, 6, 7, 9)', url: 'https://www.iiar.org/', note: 'Boas práticas de projeto, operação e segurança em sistemas com amônia.' },
  { id: 'nr13', title: 'NR-13: Caldeiras, vasos de pressão e tubulações', note: 'Norma regulamentadora brasileira, exigência legal aplicável a vasos de pressão como reservatórios e separadores.' },
  { id: 'nr36', title: 'NR-36: Segurança e saúde no trabalho em empresas de abate e processamento de carnes', note: 'Norma regulamentadora com requisitos de conforto térmico, inclusive de ambientes refrigerados.' },
  { id: 'nbr16069', title: 'ABNT NBR 16069: Segurança em sistemas frigoríficos', note: 'Norma técnica brasileira de segurança para sistemas de refrigeração.' },
  { id: 'en13163', title: 'EN 13163 / EN 13165: produtos isolantes de EPS e PU', note: 'Faixas típicas de condutividade térmica declarada. Usar o valor do fornecedor para o projeto.' },
];
