// Envia para o dono do estúdio o e-mail com os detalhes de cada pedido pago.
// Sem SMTP configurado, o e-mail é apenas impresso no terminal (bom para testes).

const nodemailer = require('nodemailer');

const usd = (cents) =>
  (cents / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'USD' });

const brDate = (iso) => iso.split('-').reverse().join('/');

const escapeHtml = (s) =>
  String(s).replace(/[&<>"']/g, (c) =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]
  );

let transporter = null;
if (process.env.SMTP_HOST) {
  const port = Number(process.env.SMTP_PORT || 587);
  transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port,
    secure: port === 465,
    auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
  });
}

/**
 * @param {object} order
 * @param {string} order.serviceName
 * @param {number} order.hours  horas do pacote comprado
 * @param {string} order.startDate  AAAA-MM-DD
 * @param {string} order.customerName
 * @param {string} order.customerEmail
 * @param {string} order.brief
 * @param {string} order.lang  'pt' ou 'en' (página em que o cliente comprou)
 * @param {number} order.amountTotal  centavos
 * @param {string} order.sessionId
 */
async function sendOrderEmail(order) {
  const rows = [
    ['Serviço', order.serviceName],
    ['Data de início', brDate(order.startDate)],
    ['Pacote', `${order.hours} hora(s) de trabalho`],
    ['Total pago', usd(order.amountTotal)],
    ['Cliente', order.customerName],
    ['Idioma do cliente', order.lang === 'en' ? 'Inglês (página dos EUA)' : 'Português (página BR)'],
    ['E-mail do cliente', order.customerEmail],
    ['Descrição do pedido', order.brief || '(sem descrição)'],
    ['Sessão Stripe', order.sessionId],
  ];

  const subject = `Novo pedido: ${order.serviceName} — ${order.hours}h a partir de ${brDate(order.startDate)}`;
  const text = rows.map(([k, v]) => `${k}: ${v}`).join('\n');
  const html = `
    <div style="font-family:Georgia,serif;background:#f6eee3;padding:24px;color:#4a3728">
      <h2 style="margin:0 0 16px">☕ Novo pedido pago</h2>
      <table style="border-collapse:collapse;background:#fffaf3;border-radius:12px">
        ${rows
          .map(
            ([k, v]) => `<tr>
              <td style="padding:10px 16px;font-weight:bold;vertical-align:top;white-space:nowrap">${escapeHtml(k)}</td>
              <td style="padding:10px 16px;white-space:pre-wrap">${escapeHtml(v)}</td>
            </tr>`
          )
          .join('')}
      </table>
    </div>`;

  if (!transporter) {
    console.log('\n--- E-MAIL DE PEDIDO (SMTP não configurado, apenas exibindo) ---');
    console.log(subject);
    console.log(text);
    console.log('---------------------------------------------------------------\n');
    return;
  }

  await transporter.sendMail({
    from: process.env.MAIL_FROM || process.env.SMTP_USER,
    to: process.env.OWNER_EMAIL,
    replyTo: order.customerEmail,
    subject,
    text,
    html,
  });
}

module.exports = { sendOrderEmail };
