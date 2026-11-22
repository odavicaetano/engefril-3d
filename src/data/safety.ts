import type { Origin } from './sources';

export const SAFETY: { title: string; items: { text: string; origin: Origin; kind?: 'legal' | 'boa-pratica' | 'propriedade' }[] }[] = [
  {
    title: 'Propriedades relevantes do NH₃',
    items: [
      { text: 'Massa molar de 17 g/mol, menor que a do ar (≈ 29 g/mol): o vapor puro tende a subir. Nuvens frias e úmidas de um vazamento podem, porém, ficar baixas', origin: 'referencia', kind: 'propriedade' },
      { text: 'Odor perceptível em concentrações muito baixas, da ordem de 5 ppm: um sinal de alerta natural, mas que não substitui a detecção', origin: 'referencia', kind: 'propriedade' },
      { text: 'Inflamável em faixa estreita, de cerca de 15 a 28% em volume no ar; classificação de segurança B2L (ASHRAE 34)', origin: 'referencia', kind: 'propriedade' },
      { text: 'Ponto de ebulição de −33,3 °C a 101,3 kPa, calculado nas tabelas internas (CoolProp)', origin: 'calculado', kind: 'propriedade' },
    ],
  },
  {
    title: 'Toxicidade e limites de exposição',
    items: [
      { text: 'NR-15 (Anexo 11): limite de tolerância de 20 ppm para jornadas de até 48 h semanais', origin: 'referencia', kind: 'legal' },
      { text: 'NIOSH: concentração IDLH (imediatamente perigosa à vida ou à saúde) de 300 ppm', origin: 'referencia', kind: 'propriedade' },
      { text: 'Irritante para olhos, pele e vias respiratórias; o contato com o líquido causa queimaduras por frio', origin: 'referencia', kind: 'propriedade' },
    ],
  },
  {
    title: 'Detecção, alarmes e ventilação',
    items: [
      { text: 'Detectores fixos em salas de máquinas e áreas com equipamentos de amônia, com alarmes visuais e sonoros e ações automáticas (ventilação, desligamentos) definidas em projeto', origin: 'referencia', kind: 'boa-pratica' },
      { text: 'Os níveis de alarme e as ações seguem as normas adotadas no projeto (ex.: ANSI/IIAR 2, ABNT NBR 16069) e a análise de risco', origin: 'referencia', kind: 'boa-pratica' },
      { text: 'Ventilação de emergência da sala de máquinas, com acionamento automático e manual externo', origin: 'referencia', kind: 'boa-pratica' },
    ],
  },
  {
    title: 'Sistemas de proteção e instrumentação',
    items: [
      { text: 'Vasos de pressão (reservatórios, separadores, intercoolers) sujeitos à NR-13: prontuário, inspeções periódicas e válvulas de segurança', origin: 'referencia', kind: 'legal' },
      { text: 'Válvulas de segurança duplas com válvula de três vias permitem manutenção sem perder a proteção; o reservatório Engefril as traz como acessório', origin: 'oficial', kind: 'boa-pratica' },
      { text: 'Intertravamentos de alta pressão, baixa pressão, nível alto no separador e temperatura de descarga', origin: 'referencia', kind: 'boa-pratica' },
      { text: 'Identificação das tubulações por fluido, estado e sentido de fluxo (ex.: IIAR Bulletin 114). As faixas coloridas do modelo 3D seguem essa ideia', origin: 'referencia', kind: 'boa-pratica' },
    ],
  },
  {
    title: 'Procedimentos de emergência (nível informativo)',
    items: [
      { text: 'Em caso de vazamento: evacuar a área contra o vento, acionar o plano de emergência e a brigada; não tentar intervenções improvisadas', origin: 'referencia', kind: 'boa-pratica' },
      { text: 'Intervenções em sistemas pressurizados só por profissionais habilitados, com EPI adequado e procedimentos aprovados', origin: 'referencia', kind: 'boa-pratica' },
      { text: 'Treinamento periódico, sinalização, chuveiros e lava-olhos de emergência', origin: 'referencia', kind: 'boa-pratica' },
    ],
  },
];
