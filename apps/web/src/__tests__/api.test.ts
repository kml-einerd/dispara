import { describe, it, expect, vi, beforeEach } from 'vitest';

// We test the mock data completeness and API module structure
describe('API Mock Data', () => {
  it('should export all required mock collections', async () => {
    const mock = await import('../lib/api-mock');
    expect(mock.mockSessions).toBeDefined();
    expect(mock.mockSessions.length).toBeGreaterThan(0);

    expect(mock.mockGroups).toBeDefined();
    expect(mock.mockGroups.length).toBeGreaterThan(0);

    expect(mock.mockProducts).toBeDefined();
    expect(mock.mockProducts.length).toBeGreaterThan(0);

    expect(mock.mockPromos).toBeDefined();
    expect(mock.mockPromos.length).toBeGreaterThan(0);

    expect(mock.mockDispatches).toBeDefined();
    expect(mock.mockDispatches.length).toBeGreaterThan(0);

    expect(mock.mockAffiliateAccounts).toBeDefined();
    expect(mock.mockAffiliateAccounts.length).toBeGreaterThan(0);

    expect(mock.mockGateStatus).toBeDefined();
    expect(mock.mockGateStatus.plan).toBe('PRO');
  });

  it('mockSessions should have at least one CONNECTED session', async () => {
    const { mockSessions } = await import('../lib/api-mock');
    const connected = mockSessions.filter(s => s.status === 'CONNECTED');
    expect(connected.length).toBeGreaterThan(0);
  });

  it('mockGroups should have valid structure', async () => {
    const { mockGroups } = await import('../lib/api-mock');
    for (const g of mockGroups) {
      expect(g.id).toBeTruthy();
      expect(g.name).toBeTruthy();
      expect(typeof g.memberCount).toBe('number');
    }
  });

  it('mockPromos should have variations', async () => {
    const { mockPromos } = await import('../lib/api-mock');
    for (const p of mockPromos) {
      expect(p.variations).toBeDefined();
      expect(p.variations!.length).toBeGreaterThan(0);
    }
  });

  it('mockDispatchesExtended should have multiple entries for charts', async () => {
    const { mockDispatchesExtended } = await import('../lib/api-mock');
    expect(mockDispatchesExtended.length).toBeGreaterThanOrEqual(5);
  });

  it('mockGateStatus should have usage limits', async () => {
    const { mockGateStatus } = await import('../lib/api-mock');
    expect(mockGateStatus.usage.promos.limit).toBeGreaterThan(0);
    expect(mockGateStatus.usage.groups.limit).toBeGreaterThan(0);
    expect(mockGateStatus.usage.dispatches.limit).toBeGreaterThan(0);
  });
});

describe('API module', () => {
  it('should export api object with get, post, delete methods', async () => {
    const { api } = await import('../lib/api');
    expect(typeof api.get).toBe('function');
    expect(typeof api.post).toBe('function');
    expect(typeof api.delete).toBe('function');
  });
});
