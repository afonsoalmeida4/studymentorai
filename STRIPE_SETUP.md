# Guia de Configuração do Stripe

## Problema
O checkout do Stripe está a retornar erro 500 porque faltam as variáveis de ambiente com os Price IDs do Stripe.

## Solução

### 1. Obter o STRIPE_SECRET_KEY

1. Acede ao [Dashboard do Stripe](https://dashboard.stripe.com/)
2. No menu lateral, vai a **Developers** → **API keys**
3. Copia a **Secret key** (começa com `sk_test_` ou `sk_live_`)

### 2. Criar todos os preços no Stripe

Execute o script de configuração que cria automaticamente todos os produtos e preços:

```bash
# Primeiro, define a chave secreta do Stripe temporariamente
export STRIPE_SECRET_KEY=sk_test_...

# Executa o script de configuração
npm run stripe:setup
```

Este script irá criar:
- Produto PRO com preços para EUR, USD, BRL, INR (mensal e anual)
- Produto PREMIUM com preços para EUR, USD, BRL, INR (mensal e anual)

### 3. Configurar variáveis de ambiente

O script irá gerar todas as variáveis necessárias. Copia a saída e cria um ficheiro `.env` na raiz do projeto:

```bash
# Cria o ficheiro .env
nano .env
```

Cole as variáveis geradas pelo script, que serão algo como:

```env
STRIPE_SECRET_KEY=sk_test_...
STRIPE_WEBHOOK_SECRET=whsec_...

# PRO - EUR
STRIPE_PRICE_PRO_EUR_MONTH=price_...
STRIPE_PRICE_PRO_EUR_YEAR=price_...

# PRO - USD
STRIPE_PRICE_PRO_USD_MONTH=price_...
STRIPE_PRICE_PRO_USD_YEAR=price_...

# PRO - BRL
STRIPE_PRICE_PRO_BRL_MONTH=price_...
STRIPE_PRICE_PRO_BRL_YEAR=price_...

# PRO - INR
STRIPE_PRICE_PRO_INR_MONTH=price_...
STRIPE_PRICE_PRO_INR_YEAR=price_...

# PREMIUM - EUR
STRIPE_PRICE_PREMIUM_EUR_MONTH=price_...
STRIPE_PRICE_PREMIUM_EUR_YEAR=price_...

# PREMIUM - USD
STRIPE_PRICE_PREMIUM_USD_MONTH=price_...
STRIPE_PRICE_PREMIUM_USD_YEAR=price_...

# PREMIUM - BRL
STRIPE_PRICE_PREMIUM_BRL_MONTH=price_...
STRIPE_PRICE_PREMIUM_BRL_YEAR=price_...

# PREMIUM - INR
STRIPE_PRICE_PREMIUM_INR_MONTH=price_...
STRIPE_PRICE_PREMIUM_INR_YEAR=price_...

# Outras variáveis necessárias
DATABASE_URL=postgresql://...
SUPABASE_URL=https://...
SUPABASE_ANON_KEY=eyJ...
SUPABASE_SERVICE_ROLE_KEY=eyJ...
OPENAI_API_KEY=sk-...
```

### 4. Configurar Webhook (Opcional mas Recomendado)

Para receber notificações do Stripe (pagamentos, cancelamentos, etc.):

1. No Dashboard do Stripe, vai a **Developers** → **Webhooks**
2. Clica em **Add endpoint**
3. URL do endpoint: `https://seu-dominio.com/webhook/stripe`
4. Eventos a escutar:
   - `customer.subscription.created`
   - `customer.subscription.updated`
   - `customer.subscription.deleted`
   - `checkout.session.completed`
5. Copia o **Signing secret** (começa com `whsec_`)
6. Adiciona ao `.env`: `STRIPE_WEBHOOK_SECRET=whsec_...`

### 5. Reiniciar o servidor

```bash
npm run dev
```

## Verificação

Depois de configurar, o erro no checkout deve desaparecer e verás mensagens mais descritivas nos logs caso algo esteja mal configurado.

## Preços Configurados

### Plano PRO
- **EUR**: €3.99/mês ou €39.99/ano
- **USD**: $4.99/mês ou $49.99/ano
- **BRL**: R$19.90/mês ou R$199/ano
- **INR**: ₹199/mês ou ₹1999/ano

### Plano PREMIUM
- **EUR**: €7.99/mês ou €79.99/ano
- **USD**: $9.99/mês ou $99.99/ano
- **BRL**: R$39.90/mês ou R$399/ano
- **INR**: ₹399/mês ou ₹3999/ano

## Notas Importantes

- O sistema detecta automaticamente a moeda do utilizador baseado no IP (via GeoIP)
- Podes usar Stripe em modo teste (`sk_test_`) durante o desenvolvimento
- Antes de ir para produção, troca para a chave live (`sk_live_`) e recria os preços
