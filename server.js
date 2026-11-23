require('dotenv').config();

const path = require('path');
const express = require('express');
const Stripe = require('stripe');
const { SERVICES, PACKAGES, LIMITS, CURRENCY, pickLang, localizedServices } = require('./services');
const { sendOrderEmail } = require('./mailer');

const PORT = process.env.PORT || 3000;
// RENDER_EXTERNAL_URL é preenchida automaticamente quando o site roda no Render.
const BASE_URL = (
  process.env.BASE_URL || process.env.RENDER_EXTERNAL_URL || `http://localhost:${PORT}`
).replace(/\/$/, '');
const stripe = process.env.STRIPE_SECRET_KEY ? new Stripe(process.env.STRIPE_SECRET_KEY) : null;

const app = express();

// ---------------------------------------------------------------------------
// Webhook da Stripe: precisa do corpo cru, por isso vem ANTES do express.json().
// É aqui que o pagamento é confirmado e o e-mail do pedido é enviado.
// ---------------------------------------------------------------------------
const processedEvents = new Set(); // evita e-mail duplicado se a Stripe reenviar o evento

app.post('/webhook', express.raw({ type: 'application/json' }), async (req, res) => {
  if (!stripe || !process.env.STRIPE_WEBHOOK_SECRET) {
    return res.status(503).send('Stripe não configurada.');
  }

  let event;
  try {
    event = stripe.webhooks.constructEvent(
      req.body,
      req.headers['stripe-signature'],
      process.env.STRIPE_WEBHOOK_SECRET
    );
  } catch (err) {
    console.error('Assinatura do webhook inválida:', err.message);
    return res.status(400).send('Assinatura inválida.');
  }

  const paidEvents = ['checkout.session.completed', 'checkout.session.async_payment_succeeded'];
  if (paidEvents.includes(event.type) && !processedEvents.has(event.id)) {
    const session = event.data.object;
    if (session.payment_status === 'paid') {
      const m = session.metadata || {};
      try {
        await sendOrderEmail({
          serviceName: m.serviceName,
          hours: Number(m.hours),
          startDate: m.startDate,
          customerName: m.customerName,
          customerEmail: session.customer_details?.email || session.customer_email,
          brief: m.brief,
          lang: m.lang,
          amountTotal: session.amount_total,
          sessionId: session.id,
        });
        processedEvents.add(event.id);
      } catch (err) {
        // Responder 500 faz a Stripe tentar de novo mais tarde.
        console.error('Falha ao enviar e-mail do pedido:', err);
        return res.status(500).send('Falha ao enviar e-mail.');
      }
    }
  }

  res.json({ received: true });
});

app.use(express.json({ limit: '20kb' }));
app.use(express.static(path.join(__dirname, 'public')));

// ---------------------------------------------------------------------------
// Catálogo para o front-end
// ---------------------------------------------------------------------------
app.get('/api/services', (req, res) => {
  res.json({
    services: localizedServices(req.query.lang),
    packages: PACKAGES,
    limits: LIMITS,
    currency: CURRENCY,
  });
});

// Textos do servidor nos dois idiomas (pt = página BR, en = página dos EUA)
const TEXT = {
  pt: {
    service: 'Escolha um serviço válido.',
    pkg: 'Escolha um pacote de horas válido.',
    date: 'Informe uma data de início válida.',
    past: 'A data de início não pode estar no passado.',
    name: 'Informe o seu nome.',
    email: 'Informe um e-mail válido.',
    brief: 'Conte um pouquinho mais sobre o que você precisa.',
    notConfigured: 'Pagamento ainda não configurado: defina STRIPE_SECRET_KEY no arquivo .env.',
    checkoutFailed: 'Não foi possível iniciar o pagamento. Tente de novo em instantes.',
    hours: (n) => (n === 1 ? '1 hora' : `${n} horas`),
    startsOn: (iso) => `Início em ${iso.split('-').reverse().join('/')}`,
    stripeLocale: 'pt-BR',
    successPath: '/sucesso.html',
    cancelPath: '/cancelado.html',
  },
  en: {
    service: 'Please choose a valid service.',
    pkg: 'Please choose a valid hours package.',
    date: 'Please enter a valid start date.',
    past: 'The start date cannot be in the past.',
    name: 'Please enter your name.',
    email: 'Please enter a valid email address.',
    brief: 'Tell us a little more about what you need.',
    notConfigured: 'Payments are not set up yet: STRIPE_SECRET_KEY is missing from the .env file.',
    checkoutFailed: 'We could not start the payment. Please try again in a moment.',
    hours: (n) => (n === 1 ? '1 hour' : `${n} hours`),
    startsOn: (iso) => {
      const [y, m, d] = iso.split('-');
      return `Starts on ${m}/${d}/${y}`;
    },
    stripeLocale: 'en',
    successPath: '/en/success.html',
    cancelPath: '/en/canceled.html',
  },
};

// ---------------------------------------------------------------------------
// Cria a sessão de pagamento (Stripe Checkout)
// ---------------------------------------------------------------------------
function todayISO() {
  const d = new Date();
  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

function validateOrder(body, t) {
  const service = SERVICES.find((s) => s.id === body.serviceId);
  if (!service) return { error: t.service };

  const pkg = PACKAGES.find((p) => p.id === body.packageId);
  if (!pkg) return { error: t.pkg };

  const startDate = String(body.startDate || '');
  if (!/^\d{4}-\d{2}-\d{2}$/.test(startDate) || Number.isNaN(Date.parse(startDate))) {
    return { error: t.date };
  }
  if (startDate < todayISO()) return { error: t.past };

  const customerName = String(body.customerName || '').trim().slice(0, 100);
  if (customerName.length < 2) return { error: t.name };

  const customerEmail = String(body.customerEmail || '').trim();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(customerEmail) || customerEmail.length > 200) {
    return { error: t.email };
  }

  const brief = String(body.brief || '').trim().slice(0, LIMITS.maxBriefLength);
  if (brief.length < 10) return { error: t.brief };

  return { order: { service, pkg, startDate, customerName, customerEmail, brief } };
}

app.post('/api/checkout', async (req, res) => {
  const body = req.body || {};
  const lang = pickLang(body.lang);
  const t = TEXT[lang];

  const { error, order } = validateOrder(body, t);
  if (error) return res.status(400).json({ error });

  if (!stripe) return res.status(503).json({ error: t.notConfigured });

  try {
    const session = await stripe.checkout.sessions.create({
      mode: 'payment',
      locale: t.stripeLocale,
      customer_email: order.customerEmail,
      line_items: [
        {
          quantity: 1, // 1 pacote de horas
          price_data: {
            currency: CURRENCY,
            unit_amount: order.pkg.price,
            product_data: {
              name: `${order.service[lang].name} — ${t.hours(order.pkg.hours)}`,
              description: t.startsOn(order.startDate),
            },
          },
        },
      ],
      // Os detalhes do pedido viajam com o pagamento e voltam no webhook.
      // O nome do serviço vai em português porque o e-mail é para a equipe.
      metadata: {
        serviceId: order.service.id,
        serviceName: order.service.pt.name,
        packageId: order.pkg.id,
        hours: String(order.pkg.hours),
        startDate: order.startDate,
        customerName: order.customerName,
        brief: order.brief,
        lang,
      },
      success_url: `${BASE_URL}${t.successPath}`,
      cancel_url: `${BASE_URL}${t.cancelPath}`,
    });
    res.json({ url: session.url });
  } catch (err) {
    console.error('Erro ao criar sessão de checkout:', err);
    res.status(500).json({ error: t.checkoutFailed });
  }
});

app.listen(PORT, () => {
  console.log(`Estúdio no ar em ${BASE_URL}`);
  if (!stripe) console.log('Aviso: STRIPE_SECRET_KEY ausente — o checkout está desativado.');
  if (!process.env.SMTP_HOST) console.log('Aviso: SMTP ausente — e-mails de pedido só aparecem no terminal.');
});
