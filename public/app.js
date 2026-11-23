// Front-end da landing (compartilhado pelas páginas BR e EUA): carrega o catálogo,
// monta os pacotes de horas, atualiza o resumo e envia o pedido para o servidor,
// que devolve o link do Stripe Checkout.
// O idioma vem do atributo lang do <html>: "pt-BR" na página BR, "en-US" na página dos EUA.

const LANG = document.documentElement.lang.startsWith('en') ? 'en' : 'pt';

const STRINGS = {
  pt: {
    locale: 'pt-BR',
    from: 'a partir de',
    hours: (n) => (n === 1 ? '1 hora' : `${n} horas`),
    perHour: (price) => `${price}/hora`,
    popular: 'Mais pedido',
    pick: 'Quero este',
    submit: 'Ir para o pagamento',
    submitting: 'Preparando pagamento…',
    genericError: 'Algo deu errado. Tente de novo.',
    loadError: 'Não foi possível carregar os serviços. Recarregue a página.',
    date: (y, m, d) => `${d}/${m}/${y}`,
  },
  en: {
    locale: 'en-US',
    from: 'from',
    hours: (n) => (n === 1 ? '1 hour' : `${n} hours`),
    perHour: (price) => `${price}/hour`,
    popular: 'Most popular',
    pick: 'Choose this',
    submit: 'Continue to payment',
    submitting: 'Preparing payment…',
    genericError: 'Something went wrong. Please try again.',
    loadError: 'We could not load the services. Please reload the page.',
    date: (y, m, d) => `${m}/${d}/${y}`,
  },
};
const T = STRINGS[LANG];

const $ = (id) => document.getElementById(id);
let currency = 'USD';
const money = (cents) => (cents / 100).toLocaleString(T.locale, { style: 'currency', currency });
const fmtDate = (iso) => (iso ? T.date(...iso.split('-')) : '—');

let services = [];
let packages = [];
let limits = { maxBriefLength: 450 };

function localISO(date) {
  const pad = (n) => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

function el(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

function selectedPackage() {
  const checked = document.querySelector('input[name="packageId"]:checked');
  return packages.find((p) => p.id === (checked && checked.value));
}

function updateSummary() {
  const service = services.find((s) => s.id === $('serviceId').value);
  const pkg = selectedPackage();
  $('sum-service').textContent = service ? service.name : '—';
  $('sum-date').textContent = fmtDate($('startDate').value);
  $('sum-package').textContent = pkg ? T.hours(pkg.hours) : '—';
  $('sum-total').textContent = pkg ? money(pkg.price) : '—';
}

function renderServices() {
  const lowest = Math.min(...packages.map((p) => p.price));
  const cards = $('service-cards');
  cards.replaceChildren();
  $('serviceId').replaceChildren();

  for (const s of services) {
    const card = el('article', 'card');

    const list = el('ul');
    for (const item of s.includes) list.append(el('li', '', item));

    const price = el('p', 'card-price');
    price.append(el('small', '', `${T.from} `), money(lowest));

    const btn = el('a', 'btn btn-ghost', T.pick);
    btn.href = '#pedido';
    btn.addEventListener('click', () => {
      $('serviceId').value = s.id;
      updateSummary();
    });

    card.append(el('div', 'card-icon', s.icon), el('h3', '', s.name), el('p', '', s.tagline), list, price, btn);
    cards.append(card);

    const option = el('option', '', s.name);
    option.value = s.id;
    $('serviceId').append(option);
  }
}

function renderPackages() {
  const grid = $('packages');
  grid.replaceChildren();

  for (const p of packages) {
    const label = el('label', 'package');

    const input = el('input');
    input.type = 'radio';
    input.name = 'packageId';
    input.value = p.id;
    input.checked = Boolean(p.popular);
    input.addEventListener('change', updateSummary);

    label.append(input);
    if (p.popular) label.append(el('span', 'package-badge', T.popular));
    label.append(
      el('span', 'package-hours', T.hours(p.hours)),
      el('strong', 'package-price', money(p.price)),
      el('small', 'package-rate', T.perHour(money(Math.round(p.price / p.hours))))
    );
    grid.append(label);
  }

  // Garante que sempre haja um pacote marcado.
  if (!selectedPackage() && grid.querySelector('input')) grid.querySelector('input').checked = true;
}

function showError(message) {
  $('form-error').textContent = message;
  $('form-error').hidden = !message;
}

async function submitOrder(event) {
  event.preventDefault();
  showError('');

  const form = $('order-form');
  if (!form.checkValidity()) {
    form.reportValidity();
    return;
  }

  const btn = $('submit-btn');
  btn.disabled = true;
  btn.textContent = T.submitting;

  try {
    const pkg = selectedPackage();
    const res = await fetch('/api/checkout', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        lang: LANG,
        serviceId: $('serviceId').value,
        packageId: pkg && pkg.id,
        startDate: $('startDate').value,
        customerName: $('customerName').value,
        customerEmail: $('customerEmail').value,
        brief: $('brief').value,
      }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok || !data.url) throw new Error(data.error || T.genericError);
    window.location.href = data.url; // página de pagamento da Stripe
  } catch (err) {
    showError(err.message);
    btn.disabled = false;
    btn.textContent = T.submit;
  }
}

async function init() {
  // Data de início: a partir de amanhã por padrão, nunca no passado.
  const today = new Date();
  const tomorrow = new Date(today);
  tomorrow.setDate(today.getDate() + 1);
  $('startDate').min = localISO(today);
  $('startDate').value = localISO(tomorrow);

  try {
    const res = await fetch(`/api/services?lang=${LANG}`);
    const data = await res.json();
    services = data.services;
    packages = data.packages;
    limits = data.limits;
    currency = data.currency.toUpperCase();
  } catch {
    $('service-cards').replaceChildren(el('p', 'loading', T.loadError));
    return;
  }

  $('brief').maxLength = limits.maxBriefLength;
  renderServices();
  renderPackages();
  updateSummary();

  $('serviceId').addEventListener('change', updateSummary);
  $('startDate').addEventListener('change', updateSummary);
  $('brief').addEventListener('input', () => {
    $('brief-count').textContent = `${$('brief').value.length} / ${limits.maxBriefLength}`;
  });
  $('order-form').addEventListener('submit', submitOrder);
}

init();
