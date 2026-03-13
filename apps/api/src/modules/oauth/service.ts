import type { PrismaClient } from '@prisma/client';
import crypto from 'node:crypto';

const ML_CLIENT_ID = process.env.ML_CLIENT_ID!;
const ML_CLIENT_SECRET = process.env.ML_CLIENT_SECRET!;
const ML_REDIRECT_URI = process.env.ML_REDIRECT_URI!;

export class OAuthService {
  constructor(private prisma: PrismaClient) {}

  // ── Mercado Livre OAuth 2.0 ──

  getMlAuthorizeUrl(tenantId: string): string {
    // state = tenantId:hmac — HMAC prevents state forgery (CSRF protection)
    const hmac = crypto.createHmac('sha256', ML_CLIENT_SECRET).update(tenantId).digest('hex').slice(0, 16);
    const state = `${tenantId}:${hmac}`;
    return `https://auth.mercadolivre.com.br/authorization?response_type=code&client_id=${ML_CLIENT_ID}&redirect_uri=${encodeURIComponent(ML_REDIRECT_URI)}&state=${encodeURIComponent(state)}`;
  }

  verifyMlState(state: string): string {
    const [tenantId, hmac] = state.split(':');
    if (!tenantId || !hmac) throw new Error('Invalid OAuth state');
    const expected = crypto.createHmac('sha256', ML_CLIENT_SECRET).update(tenantId).digest('hex').slice(0, 16);
    if (hmac !== expected) throw new Error('OAuth state HMAC mismatch — possible CSRF');
    return tenantId;
  }

  async exchangeMlCode(code: string, tenantId: string) {
    const response = await fetch('https://api.mercadolibre.com/oauth/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
      body: JSON.stringify({
        grant_type: 'authorization_code',
        client_id: ML_CLIENT_ID,
        client_secret: ML_CLIENT_SECRET,
        code,
        redirect_uri: ML_REDIRECT_URI,
      }),
    });

    if (!response.ok) {
      const errBody = await response.json().catch(() => ({} as Record<string, unknown>));
      throw new Error(`ML OAuth token exchange failed: ${(errBody as any).message || response.status}`);
    }

    const data = await response.json() as {
      access_token: string;
      token_type: string;
      expires_in: number;
      refresh_token: string;
      user_id: number;
    };

    // Fetch user info for label
    const userResp = await fetch(`https://api.mercadolibre.com/users/${data.user_id}`, {
      headers: { 'Authorization': `Bearer ${data.access_token}` },
    });
    const userInfo = await userResp.json().catch(() => ({ nickname: `ML-${data.user_id}` })) as { nickname: string };

    const expiresAt = new Date(Date.now() + data.expires_in * 1000);

    return this.prisma.affiliateAccount.upsert({
      where: {
        tenantId_marketplace_label: {
          tenantId,
          marketplace: 'MERCADOLIVRE',
          label: userInfo.nickname || `ML-${data.user_id}`,
        },
      },
      update: {
        credentials: {
          accessToken: data.access_token,
          refreshToken: data.refresh_token,
          userId: data.user_id,
        },
        status: 'ACTIVE',
        expiresAt,
        lastSyncAt: new Date(),
      },
      create: {
        tenantId,
        marketplace: 'MERCADOLIVRE',
        label: userInfo.nickname || `ML-${data.user_id}`,
        credentials: {
          accessToken: data.access_token,
          refreshToken: data.refresh_token,
          userId: data.user_id,
        },
        status: 'ACTIVE',
        expiresAt,
      },
    });
  }

  async refreshMlToken(accountId: string) {
    const account = await this.prisma.affiliateAccount.findUniqueOrThrow({
      where: { id: accountId },
    });

    const creds = account.credentials as { refreshToken: string; userId: number };

    const response = await fetch('https://api.mercadolibre.com/oauth/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
      body: JSON.stringify({
        grant_type: 'refresh_token',
        client_id: ML_CLIENT_ID,
        client_secret: ML_CLIENT_SECRET,
        refresh_token: creds.refreshToken,
      }),
    });

    if (!response.ok) {
      await this.prisma.affiliateAccount.update({
        where: { id: accountId },
        data: { status: 'EXPIRED' },
      });
      throw new Error('ML refresh token expired or revoked');
    }

    const data = await response.json() as {
      access_token: string;
      expires_in: number;
      refresh_token: string;
    };

    return this.prisma.affiliateAccount.update({
      where: { id: accountId },
      data: {
        credentials: {
          accessToken: data.access_token,
          refreshToken: data.refresh_token,
          userId: creds.userId,
        },
        status: 'ACTIVE',
        expiresAt: new Date(Date.now() + data.expires_in * 1000),
        lastSyncAt: new Date(),
      },
    });
  }

  // ── Shopee (credenciais estáticas) ──

  async saveShopeeCredentials(tenantId: string, appId: string, secret: string) {
    // Validate credentials by making a test request
    const testPayload = JSON.stringify({
      query: '{ productOfferV2(listType: 0, page: 0) { nodes { itemId } } }',
    });
    const timestamp = Math.floor(Date.now() / 1000).toString();
    const signature = crypto
      .createHash('sha256')
      .update(appId + timestamp + testPayload + secret)
      .digest('hex');

    const testResp = await fetch('https://open-api.affiliate.shopee.com.br/graphql', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `SHA256 Credential=${appId},Timestamp=${timestamp},Signature=${signature}`,
      },
      body: testPayload,
    });

    // Shopee returns 200 even on auth errors, check response body
    const testData = await testResp.json().catch(() => null) as { errors?: Array<{ message?: string }> } | null;
    if (!testResp.ok || (testData?.errors?.length && testData.errors[0]?.message?.includes('auth'))) {
      throw new Error('Credenciais Shopee inválidas. Verifique App ID e Secret Key.');
    }

    return this.prisma.affiliateAccount.upsert({
      where: {
        tenantId_marketplace_label: {
          tenantId,
          marketplace: 'SHOPEE',
          label: `Shopee-${appId.slice(0, 8)}`,
        },
      },
      update: {
        credentials: { appId, secret },
        status: 'ACTIVE',
        lastSyncAt: new Date(),
      },
      create: {
        tenantId,
        marketplace: 'SHOPEE',
        label: `Shopee-${appId.slice(0, 8)}`,
        credentials: { appId, secret },
        status: 'ACTIVE',
      },
    });
  }

  // ── Shared ──

  async listAccounts(tenantId: string) {
    return this.prisma.affiliateAccount.findMany({
      where: { tenantId },
      select: {
        id: true,
        marketplace: true,
        label: true,
        status: true,
        lastSyncAt: true,
        expiresAt: true,
        createdAt: true,
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async disconnect(id: string, tenantId: string) {
    return this.prisma.affiliateAccount.update({
      where: { id, tenantId },
      data: { status: 'REVOKED', credentials: {} },
    });
  }
}
