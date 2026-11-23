// Catálogo de serviços. É a ÚNICA fonte de preços: o servidor calcula o total
// a partir daqui, nunca a partir do que o navegador envia.
// Os preços ficam em PACKAGES (pacotes de horas), em centavos de DÓLAR (898 = US$ 8,98),
// e valem para todos os serviços.
// Cada serviço tem os textos em português (pt) e em inglês (en).

const CURRENCY = 'usd';
const LANGS = ['pt', 'en'];

const SERVICES = [
  {
    id: 'programacao',
    icon: '💻',
    pt: {
      name: 'Programação',
      tagline: 'Sites, sistemas e automações feitos sob medida.',
      includes: ['Front-end e back-end', 'Integrações e APIs', 'Correções e melhorias'],
    },
    en: {
      name: 'Programming',
      tagline: 'Websites, systems and automations built to fit.',
      includes: ['Front-end and back-end', 'Integrations and APIs', 'Fixes and improvements'],
    },
  },
  {
    id: 'design-sites',
    icon: '🎨',
    pt: {
      name: 'Design de sites',
      tagline: 'Layouts bonitos, claros e gostosos de navegar.',
      includes: ['Landing pages', 'Identidade visual da página', 'Protótipo navegável'],
    },
    en: {
      name: 'Web design',
      tagline: 'Beautiful, clear layouts that feel good to browse.',
      includes: ['Landing pages', 'Visual identity for your page', 'Clickable prototype'],
    },
  },
  {
    id: 'modelagem-3d',
    icon: '🧊',
    pt: {
      name: 'Modelagem 3D',
      tagline: 'Personagens, objetos e cenários em três dimensões.',
      includes: ['Modelagem e texturização', 'Otimização de malha', 'Arquivos prontos para uso'],
    },
    en: {
      name: '3D modeling',
      tagline: 'Characters, props and environments in three dimensions.',
      includes: ['Modeling and texturing', 'Mesh optimization', 'Ready-to-use files'],
    },
  },
  {
    id: 'modelagem-2d-jogos',
    icon: '🕹️',
    pt: {
      name: 'Modelagem 2D para jogos',
      tagline: 'Arte 2D pensada especificamente para o seu jogo.',
      includes: ['Sprites e personagens', 'Tilesets e cenários', 'Ícones e interface'],
    },
    en: {
      name: '2D art for games',
      tagline: '2D art made specifically for your game.',
      includes: ['Sprites and characters', 'Tilesets and backgrounds', 'Icons and UI'],
    },
  },
];

// Pacotes de horas de trabalho. Quanto maior o pacote, menor o preço por hora.
// "popular" marca o pacote que já vem selecionado e destacado na página.
const PACKAGES = [
  { id: '1h', hours: 1, price: 898 },
  { id: '2h', hours: 2, price: 1259 },
  { id: '5h', hours: 5, price: 2699, popular: true },
  { id: '7h', hours: 7, price: 3598 },
  { id: '10h', hours: 10, price: 4499 },
];

const LIMITS = { maxBriefLength: 450 };

const pickLang = (lang) => (LANGS.includes(lang) ? lang : 'pt');

// Devolve o catálogo já no idioma pedido, no formato que o front-end usa.
function localizedServices(lang) {
  const l = pickLang(lang);
  return SERVICES.map((s) => ({ id: s.id, icon: s.icon, ...s[l] }));
}

module.exports = { SERVICES, PACKAGES, LIMITS, CURRENCY, pickLang, localizedServices };
