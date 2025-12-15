import Stripe from "stripe";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || "", {
  apiVersion: "2024-11-20.acacia",
});

async function setupStripeProducts() {
  console.log("🔧 Configurando produtos e preços no Stripe...\n");

  try {
    // Plano Pro - €7.99/mês
    console.log("Criando plano Pro (€7.99/mês)...");
    const proProd = await stripe.products.create({
      name: "Study Mentor AI - Pro",
      description: "Uploads ilimitados, resumos avançados, chat existencial",
    });
    const proPrice = await stripe.prices.create({
      product: proProd.id,
      unit_amount: 799, // €7.99 em cêntimos
      currency: "eur",
      recurring: { interval: "month" },
    });
    console.log(`✅ Pro criado: ${proPrice.id}\n`);

    // Plano Premium - €18.99/mês
    console.log("Criando plano Premium (€18.99/mês)...");
    const premiumProd = await stripe.products.create({
      name: "Study Mentor AI - Premium",
      description: "Tudo do Pro + AI tutor, planos de estudo personalizados",
    });
    const premiumPrice = await stripe.prices.create({
      product: premiumProd.id,
      unit_amount: 1899, // €18.99 em cêntimos
      currency: "eur",
      recurring: { interval: "month" },
    });
    console.log(`✅ Premium criado: ${premiumPrice.id}\n`);

    // Plano Educational (Professor) - €14.99/mês
    console.log("Criando plano Educational Teacher (€14.99/mês)...");
    const eduTeacherProd = await stripe.products.create({
      name: "Study Mentor AI - Educational (Teacher)",
      description: "Para professores: gestão de turmas, monitorização de progresso",
    });
    const eduTeacherPrice = await stripe.prices.create({
      product: eduTeacherProd.id,
      unit_amount: 1499, // €14.99 em cêntimos
      currency: "eur",
      recurring: { interval: "month" },
    });
    console.log(`✅ Educational Teacher criado: ${eduTeacherPrice.id}\n`);

    // Plano Educational (Aluno) - €3/mês
    console.log("Criando plano Educational Student (€3/mês)...");
    const eduStudentProd = await stripe.products.create({
      name: "Study Mentor AI - Educational (Student)",
      description: "Para alunos: acesso a turmas, funcionalidades de estudo",
    });
    const eduStudentPrice = await stripe.prices.create({
      product: eduStudentProd.id,
      unit_amount: 300, // €3.00 em cêntimos
      currency: "eur",
      recurring: { interval: "month" },
    });
    console.log(`✅ Educational Student criado: ${eduStudentPrice.id}\n`);

    console.log("\n🎉 Configuração completa!\n");
    console.log("Adiciona estes Price IDs aos teus secrets:\n");
    console.log(`STRIPE_PRICE_ID_PRO=${proPrice.id}`);
    console.log(`STRIPE_PRICE_ID_PREMIUM=${premiumPrice.id}`);
    console.log(`STRIPE_PRICE_ID_EDUCATIONAL=${eduTeacherPrice.id}`);
    console.log(`STRIPE_PRICE_ID_EDUCATIONAL_STUDENT=${eduStudentPrice.id}`);
    console.log("\n");
  } catch (error) {
    console.error("❌ Erro ao configurar Stripe:", error);
    process.exit(1);
  }
}

setupStripeProducts();
