# Estúdio Aconchego — landing page de serviços freelancer

Landing page no estilo cozy para vender pacotes de horas de **programação**, **design de sites**,
**modelagem 3D** e **modelagem 2D para jogos**. O cliente escolhe o serviço, a data de início
e um pacote de horas, paga pela Stripe e você recebe o pedido por e-mail.

## Idiomas e moeda

- Página BR (português): `/` — arquivos em `public/`
- Página EUA (inglês): `/en/` — arquivos em `public/en/`
- Os preços são em **dólar (USD)** nas duas páginas, e a Stripe cobra em USD.
- O e-mail do pedido chega sempre em português e informa em qual página o cliente comprou.

## Pacotes de horas

Os mesmos pacotes valem para os quatro serviços (definidos em `PACKAGES`, no `services.js`):

| Pacote | Preço | Por hora |
| --- | --- | --- |
| 1 hora | US$ 8,98 | US$ 8,98 |
| 2 horas | US$ 12,59 | US$ 6,30 |
| 5 horas (destacado como "mais pedido") | US$ 26,99 | US$ 5,40 |
| 7 horas | US$ 35,98 | US$ 5,14 |
| 10 horas | US$ 44,99 | US$ 4,50 |

## Estrutura

| Arquivo | Para que serve |
| --- | --- |
| `services.js` | Catálogo: textos dos serviços (pt e en) e os **pacotes de horas com preço em USD** |
| `server.js` | Servidor Express: catálogo, criação do checkout e webhook da Stripe |
| `mailer.js` | Monta e envia o e-mail do pedido |
| `public/` | Página BR (`index.html`), estilos e script compartilhados (`styles.css`, `app.js`) e páginas de retorno |
| `public/en/` | Página dos EUA (`index.html`) e páginas de retorno em inglês |
| `.env.example` | Modelo das configurações (chaves da Stripe e SMTP) |

## Fluxo do pedido

1. O cliente preenche o formulário → `POST /api/checkout`.
2. O servidor valida e pega o preço do pacote escolhido no `services.js`
   e cria uma sessão do Stripe Checkout com os detalhes do pedido em `metadata`.
3. O cliente paga na página da Stripe.
4. A Stripe chama `POST /webhook`; com o pagamento confirmado, o servidor envia
   o e-mail do pedido para `OWNER_EMAIL`.

## Como rodar

```powershell
npm install
Copy-Item .env.example .env   # depois preencha o .env
npm start
```

Abra http://localhost:3000.

Sem `STRIPE_SECRET_KEY` a página funciona, mas o botão de pagamento avisa que falta configurar.
Sem SMTP, o e-mail do pedido é apenas impresso no terminal.

### Testar o pagamento localmente

1. Coloque a chave de teste (`sk_test_...`) em `STRIPE_SECRET_KEY`.
2. Com a [Stripe CLI](https://docs.stripe.com/stripe-cli): `stripe listen --forward-to localhost:3000/webhook`
   e copie o `whsec_...` exibido para `STRIPE_WEBHOOK_SECRET`.
3. Reinicie o servidor e pague com o cartão de teste `4242 4242 4242 4242`.

### Em produção

- Defina `BASE_URL` com o endereço real do site.
- No painel da Stripe, crie um webhook apontando para `https://seu-dominio/webhook`
  com os eventos `checkout.session.completed` e `checkout.session.async_payment_succeeded`.
- Troque para as chaves de produção.

## O que ainda é provisório

- Nome "Estúdio Aconchego", textos e **preços** são exemplos — ajuste em `services.js`, `public/index.html` e `public/en/index.html`.
- Os pedidos não ficam salvos em banco de dados: o registro é o e-mail e o painel da Stripe.
- Não há controle de agenda (dois clientes podem escolher o mesmo dia de início).
