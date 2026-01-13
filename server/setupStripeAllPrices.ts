import Stripe from "stripe";

// Validate required environment variable
if (!process.env.STRIPE_SECRET_KEY) {
  console.error("\n❌ ERRO: STRIPE_SECRET_KEY não está definida!\n");
  console.log("Por favor, define a variável de ambiente primeiro:\n");
  console.log("  export STRIPE_SECRET_KEY=sk_test_...\n");
  console.log("Podes encontrar a tua chave em: https://dashboard.stripe.com/apikeys\n");
  process.exit(1);
}

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, {
  apiVersion: "2025-10-29.clover",
});

// Pricing configuration
const PRICING = {
  pro: {
    name: "Study Mentor AI - Pro",
    description: "50 resumos/mês, 2.000 flashcards, 50 quizzes, todos estilos de aprendizagem",
    prices: {
      EUR: { monthly: 399, yearly: 3999 },   // €3.99/mês, €39.99/ano
      USD: { monthly: 499, yearly: 4999 },   // $4.99/mês, $49.99/ano
      BRL: { monthly: 1990, yearly: 19900 }, // R$19.90/mês, R$199/ano
      INR: { monthly: 19900, yearly: 199900 }, // ₹199/mês, ₹1999/ano
    },
  },
  premium: {
    name: "Study Mentor AI - Premium",
    description: "200 resumos/mês, 5.000 flashcards, 150 quizzes, assistente IA ilimitado, calendário académico",
    prices: {
      EUR: { monthly: 799, yearly: 7999 },   // €7.99/mês, €79.99/ano
      USD: { monthly: 999, yearly: 9999 },   // $9.99/mês, $99.99/ano
      BRL: { monthly: 3990, yearly: 39900 }, // R$39.90/mês, R$399/ano
      INR: { monthly: 39900, yearly: 399900 }, // ₹399/mês, ₹3999/ano
    },
  },
};

async function setupAllStripePrices() {
  console.log("🔧 Configurando todos os produtos e preços no Stripe...\n");

  const envVars: string[] = [];

  try {
    for (const [plan, config] of Object.entries(PRICING)) {
      console.log(`\n📦 Criando produto: ${config.name}`);
      
      const product = await stripe.products.create({
        name: config.name,
        description: config.description,
      });

      console.log(`✅ Produto criado: ${product.id}\n`);

      for (const [currency, amounts] of Object.entries(config.prices)) {
        // Monthly price
        console.log(`   Criando preço mensal ${currency}...`);
        const monthlyPrice = await stripe.prices.create({
          product: product.id,
          unit_amount: amounts.monthly,
          currency: currency.toLowerCase(),
          recurring: { interval: "month" },
        });
        const monthlyKey = `STRIPE_PRICE_${plan.toUpperCase()}_${currency}_MONTH`;
        envVars.push(`${monthlyKey}=${monthlyPrice.id}`);
        console.log(`   ✅ ${monthlyKey}=${monthlyPrice.id}`);

        // Yearly price
        console.log(`   Criando preço anual ${currency}...`);
        const yearlyPrice = await stripe.prices.create({
          product: product.id,
          unit_amount: amounts.yearly,
          currency: currency.toLowerCase(),
          recurring: { interval: "year" },
        });
        const yearlyKey = `STRIPE_PRICE_${plan.toUpperCase()}_${currency}_YEAR`;
        envVars.push(`${yearlyKey}=${yearlyPrice.id}`);
        console.log(`   ✅ ${yearlyKey}=${yearlyPrice.id}`);
      }
    }

    console.log("\n\n🎉 Configuração completa!\n");
    console.log("═".repeat(80));
    console.log("Adiciona estas variáveis ao teu ficheiro .env:");
    console.log("═".repeat(80));
    console.log("");
    envVars.forEach(v => console.log(v));
    console.log("\n");
  } catch (error) {
    console.error("❌ Erro ao configurar Stripe:", error);
    process.exit(1);
  }
}

setupAllStripePrices();
