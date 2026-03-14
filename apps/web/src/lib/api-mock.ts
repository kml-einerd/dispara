import { WaSession, Group, Product, Promo, Dispatch, AffiliateAccount } from '../types';

export const mockSessions: WaSession[] = [
  {
    id: '1',
    tenantId: 'tenant-1',
    name: 'Vendas 01',
    phoneNumber: '5511999999999',
    status: 'CONNECTED',
    healthScore: 95,
    warmupDay: 15,
    dailyMsgCount: 120,
    createdAt: new Date().toISOString(),
  },
  {
    id: '2',
    tenantId: 'tenant-1',
    name: 'Promoções 02',
    phoneNumber: '5511888888888',
    status: 'DISCONNECTED',
    healthScore: 40,
    warmupDay: 2,
    dailyMsgCount: 10,
    createdAt: new Date().toISOString(),
  },
];

export const mockGroups: Group[] = [
  { id: '1', tenantId: 'tenant-1', sessionId: '1', channel: 'WHATSAPP', name: 'Ofertas Relâmpago', externalId: 'group1@g.us', description: null, memberCount: 250, maxMembers: 1024, inviteLink: null, isActive: true, metadata: null, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() },
  { id: '2', tenantId: 'tenant-1', sessionId: '1', channel: 'WHATSAPP', name: 'Cupons Shopee', externalId: 'group2@g.us', description: null, memberCount: 180, maxMembers: 1024, inviteLink: null, isActive: true, metadata: null, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() },
  { id: '3', tenantId: 'tenant-1', sessionId: '1', channel: 'WHATSAPP', name: 'Achadinhos ML', externalId: 'group3@g.us', description: null, memberCount: 420, maxMembers: 1024, inviteLink: null, isActive: false, metadata: null, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() },
];

export const mockProducts: Product[] = [
  {
    id: 'p1',
    name: 'Tênis Nike Air Max Excee Masculino',
    originalPrice: 599.90,
    promoPrice: 359.90,
    discountPercent: 40,
    imageUrl: 'https://picsum.photos/seed/nike/400/400',
    productUrl: 'https://shopee.com.br/product/123/456',
    affiliateUrl: 'https://shope.ee/abc123',
    marketplace: 'SHOPEE',
  },
  {
    id: 'p2',
    name: 'Smartphone Samsung Galaxy S23 256GB',
    originalPrice: 4500.00,
    promoPrice: 3200.00,
    discountPercent: 28,
    imageUrl: 'https://picsum.photos/seed/samsung/400/400',
    productUrl: 'https://mercadolivre.com.br/p/MLB123',
    affiliateUrl: 'https://mercadolivre.com/sec/abc456',
    marketplace: 'MERCADOLIVRE',
  },
];

export const mockPromos: Promo[] = [
  {
    id: 'pr1',
    tenantId: 'tenant-1',
    userId: 'user-1',
    marketplace: 'SHOPEE',
    productUrl: 'https://shopee.com.br/product/123/456',
    affiliateUrl: 'https://shope.ee/abc123',
    productName: 'Tênis Nike Air Max Excee',
    originalPrice: '599.90',
    promoPrice: '359.90',
    discountPercent: 40,
    imageUrl: 'https://picsum.photos/seed/nike/400/400',
    category: null,
    status: 'ACTIVE',
    metadata: null,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    variations: [
      { id: 'v1', promoId: 'pr1', label: 'Urgente', copyText: '🔥 OFERTA RELÂMPAGO! Tênis Nike Air Max com 40% OFF! Corra antes que acabe!\n\nConfira aqui: https://shope.ee/abc123', imageUrl: null, isDefault: true, metadata: null, createdAt: new Date().toISOString() },
    ],
  },
];

export const mockDispatches: Dispatch[] = [
  { id: 'd1', tenantId: 'tenant-1', userId: 'user-1', promoId: 'pr1', channel: 'WHATSAPP', copyTemplate: 'Template 1', mediaUrl: null, mediaType: null, status: 'COMPLETED', priority: 0, scheduledAt: null, startedAt: new Date().toISOString(), completedAt: new Date().toISOString(), totalGroups: 5, sentCount: 5, failedCount: 0, metadata: null, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() },
  { id: 'd2', tenantId: 'tenant-1', userId: 'user-1', promoId: 'pr1', channel: 'WHATSAPP', copyTemplate: 'Template 2', mediaUrl: null, mediaType: null, status: 'PENDING', priority: 0, scheduledAt: null, startedAt: null, completedAt: null, totalGroups: 3, sentCount: 0, failedCount: 0, metadata: null, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() },
];

export const mockAffiliateAccounts: AffiliateAccount[] = [
  { id: 'a1', tenantId: 'tenant-1', marketplace: 'SHOPEE', label: 'Minha Loja Shopee', credentials: {}, status: 'ACTIVE', lastSyncAt: new Date().toISOString(), expiresAt: null, metadata: null, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() },
  { id: 'a2', tenantId: 'tenant-1', marketplace: 'MERCADOLIVRE', label: 'ML Oficial', credentials: {}, status: 'ACTIVE', lastSyncAt: new Date().toISOString(), expiresAt: null, metadata: null, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() },
];

// Gate/usage mock
export const mockGateStatus = {
  plan: 'PRO',
  usage: {
    promos: { used: 24, limit: 100 },
    groups: { used: 12, limit: 50 },
    dispatches: { used: 87, limit: 500 },
  },
};

// Dispatches com datas variadas para gráfico de 7 dias
function mockDispatchesWithDates(): Dispatch[] {
  const now = new Date();
  const dispatches: Dispatch[] = [];
  const statuses: Dispatch['status'][] = ['COMPLETED', 'COMPLETED', 'FAILED', 'COMPLETED', 'PROCESSING', 'PENDING', 'COMPLETED', 'COMPLETED', 'COMPLETED', 'COMPLETED'];

  for (let i = 0; i < 10; i++) {
    const date = new Date(now);
    date.setDate(date.getDate() - Math.floor(i / 2));
    date.setHours(10 + i, 0, 0, 0);
    const status = statuses[i];
    dispatches.push({
      id: `d${i + 1}`,
      tenantId: 'tenant-1',
      userId: 'user-1',
      promoId: 'pr1',
      channel: 'WHATSAPP',
      copyTemplate: `Template ${i + 1}`,
      mediaUrl: null,
      mediaType: null,
      status,
      priority: 0,
      scheduledAt: null,
      startedAt: status !== 'PENDING' ? date.toISOString() : null,
      completedAt: status === 'COMPLETED' ? date.toISOString() : null,
      totalGroups: 3 + Math.floor(Math.random() * 8),
      sentCount: status === 'COMPLETED' ? 3 + Math.floor(Math.random() * 8) : status === 'PROCESSING' ? Math.floor(Math.random() * 5) : 0,
      failedCount: status === 'FAILED' ? 2 : 0,
      metadata: null,
      createdAt: date.toISOString(),
      updatedAt: date.toISOString(),
    });
  }
  return dispatches;
}

export const mockDispatchesExtended = mockDispatchesWithDates();
