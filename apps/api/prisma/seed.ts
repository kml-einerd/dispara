import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('Seeding plan definitions...');

  const plans = [
    {
      name: 'Starter',
      plan: 'STARTER' as const,
      priceMonthly: 49.90,
      priceYearly: 499.00,
      maxWaSessions: 1,
      maxGroups: 10,
      maxPromos: 20,
      maxDispatches: 100,
      aiCreditsMonth: 0,
      features: { agent: false, telegram: false, analytics: false },
    },
    {
      name: 'Pro',
      plan: 'PRO' as const,
      priceMonthly: 149.90,
      priceYearly: 1499.00,
      maxWaSessions: 5,
      maxGroups: 100,
      maxPromos: 200,
      maxDispatches: 1000,
      aiCreditsMonth: 500,
      features: { agent: true, telegram: true, analytics: true },
    },
    {
      name: 'Enterprise',
      plan: 'ENTERPRISE' as const,
      priceMonthly: 499.90,
      priceYearly: 4999.00,
      maxWaSessions: 20,
      maxGroups: 1000,
      maxPromos: 2000,
      maxDispatches: 10000,
      aiCreditsMonth: 2000,
      features: { agent: true, telegram: true, analytics: true, whitelabel: true },
    },
  ];

  for (const plan of plans) {
    await prisma.planDefinition.upsert({
      where: { plan: plan.plan },
      update: {},
      create: plan,
    });
    console.log(`  ✓ Plan ${plan.plan} upserted`);
  }

  console.log('Seed complete!');
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
