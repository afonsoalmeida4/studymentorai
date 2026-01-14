# Como Corrigir Subscrições Duplicadas no Stripe

## Problema Resolvido no Código

✅ **Agora quando um utilizador faz upgrade:**
1. O código **cancela imediatamente** a subscrição antiga no Stripe
2. **Depois** cria a sessão de checkout para o novo plano
3. O webhook também tem proteção adicional caso algo falhe

## Como Resolver as Subscrições Duplicadas Existentes

Tens atualmente 2 subscrições ativas para `brasil@studymentorai.com`:
- Pro (€3.99/mês)
- Premium (€7.99/mês)

### Opção 1: Via Dashboard do Stripe (Recomendado)

1. Acede ao [Dashboard do Stripe > Subscriptions](https://dashboard.stripe.com/subscriptions)
2. Encontra as 2 subscrições para `brasil@studymentorai.com`
3. Clica na subscrição **Pro** (€3.99/mês)
4. Clica em "Cancel subscription" no topo
5. Escolhe "Cancel immediately" 
6. Confirma

Isto deixará apenas a subscrição Premium ativa.

### Opção 2: Via Stripe CLI

```bash
# Listar todas as subscrições do cliente
stripe subscriptions list --customer cus_XXX

# Cancelar a subscrição Pro
stripe subscriptions cancel sub_XXX
```

### Opção 3: Via Script (Automático)

Posso criar um script Node.js que:
1. Procura o cliente pelo email
2. Lista todas as subscrições ativas
3. Cancela a de menor valor (Pro)
4. Mantém a de maior valor (Premium)

Queres que crie este script?

## Prevenção Futura

Com as alterações no código, isto **nunca mais acontecerá**:
- ✅ Subscrição antiga é cancelada antes de criar checkout
- ✅ Webhook tem proteção adicional
- ✅ Logs detalhados para debug
- ✅ Não permite downgrades diretos
