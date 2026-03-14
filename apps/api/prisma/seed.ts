import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  // ── Plan Definitions ──
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

  // ── Demo Tenant ──
  console.log('Seeding demo tenant...');

  const tenant = await prisma.tenant.upsert({
    where: { slug: 'demo-nowork' },
    update: {},
    create: {
      name: 'Demo NoWork',
      slug: 'demo-nowork',
      plan: 'PRO',
    },
  });
  console.log(`  ✓ Tenant "${tenant.name}" (${tenant.id})`);

  // ── Demo User ──
  console.log('Seeding demo user...');

  const user = await prisma.user.upsert({
    where: { tenantId_email: { tenantId: tenant.id, email: 'demo@nowork.com.br' } },
    update: {},
    create: {
      tenantId: tenant.id,
      externalAuthId: 'demo-nowork-admin',
      email: 'demo@nowork.com.br',
      name: 'Dev Demo',
      role: 'OWNER',
    },
  });
  console.log(`  ✓ User "${user.name}" (${user.id})`);

  // ── Demo WaSession (required for groups) ──
  console.log('Seeding demo WA session...');

  const session = await prisma.waSession.upsert({
    where: { tenantId_phoneNumber: { tenantId: tenant.id, phoneNumber: '5511999990000' } },
    update: {},
    create: {
      tenantId: tenant.id,
      phoneNumber: '5511999990000',
      name: 'Demo Session',
      status: 'DISCONNECTED',
    },
  });
  console.log(`  ✓ WaSession "${session.name}" (${session.id})`);

  // ── Demo Promos ──
  console.log('Seeding demo promos...');

  const promos = [
    {
      marketplace: 'SHOPEE' as const,
      productUrl: 'https://shopee.com.br/fone-bluetooth-tws-pro',
      affiliateUrl: 'https://shope.ee/demo-fone',
      productName: 'Fone Bluetooth TWS Pro',
      originalPrice: 29.90,
      promoPrice: 19.90,
      discountPercent: 33,
      category: 'Tecnologia',
      status: 'ACTIVE' as const,
    },
    {
      marketplace: 'SHOPEE' as const,
      productUrl: 'https://shopee.com.br/capa-iphone-15-silicone',
      affiliateUrl: 'https://shope.ee/demo-capa',
      productName: 'Capa iPhone 15 Silicone',
      originalPrice: 49.90,
      promoPrice: 24.90,
      discountPercent: 50,
      category: 'Acessorios',
      status: 'ACTIVE' as const,
    },
    {
      marketplace: 'MERCADOLIVRE' as const,
      productUrl: 'https://mercadolivre.com.br/camera-wifi-360',
      affiliateUrl: 'https://mercadolivre.com.br/demo-camera',
      productName: 'Camera Wi-Fi 360',
      originalPrice: 199.90,
      promoPrice: 149.90,
      discountPercent: 25,
      category: 'Tecnologia',
      status: 'ACTIVE' as const,
    },
  ];

  for (const promo of promos) {
    await prisma.promo.upsert({
      where: {
        // Use tenantId + createdAt index; find by unique product URL per tenant
        id: (
          await prisma.promo.findFirst({
            where: { tenantId: tenant.id, productName: promo.productName },
            select: { id: true },
          })
        )?.id ?? '00000000-0000-0000-0000-000000000000',
      },
      update: {},
      create: {
        tenantId: tenant.id,
        userId: user.id,
        ...promo,
      },
    });
    console.log(`  ✓ Promo "${promo.productName}"`);
  }

  // ── Demo Promo Variations ──
  console.log('Seeding demo promo variations...');

  const createdPromos = await prisma.promo.findMany({
    where: { tenantId: tenant.id },
    orderBy: { createdAt: 'asc' },
  });

  for (const p of createdPromos) {
    const existing = await prisma.promoVariation.findFirst({
      where: { promoId: p.id, isDefault: true },
    });
    if (!existing) {
      await prisma.promoVariation.create({
        data: {
          promoId: p.id,
          label: 'Padrao',
          copyText: `${p.productName} - de R$${p.originalPrice} por apenas R$${p.promoPrice}! Corre que e por tempo limitado!`,
          isDefault: true,
        },
      });
      console.log(`  ✓ Variation for "${p.productName}"`);
    }
  }

  // ── Demo Groups ──
  console.log('Seeding demo groups...');

  const groups = [
    {
      externalId: 'demo-ofertas-tech@g.us',
      name: 'Ofertas Tech',
      memberCount: 50,
    },
    {
      externalId: 'demo-promos-do-dia@g.us',
      name: 'Promos do Dia',
      memberCount: 120,
    },
  ];

  for (const group of groups) {
    await prisma.group.upsert({
      where: { tenantId_externalId: { tenantId: tenant.id, externalId: group.externalId } },
      update: {},
      create: {
        tenantId: tenant.id,
        sessionId: session.id,
        channel: 'WHATSAPP',
        ...group,
      },
    });
    console.log(`  ✓ Group "${group.name}" (${group.memberCount} members)`);
  }

  console.log('Seed complete!');
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
