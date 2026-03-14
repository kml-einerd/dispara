import { describe, it, expect } from 'vitest';

const EXPECTED_PAGES = [
  'CommissionsPage',
  'CopilotPage',
  'DashboardPage',
  'DispatchesPage',
  'GroupsPage',
  'LinkRedirectPage',
  'LoginPage',
  'NewPromoPage',
  'PromosPage',
  'SettingsPage',
  'WhatsAppPage',
];

describe('Page modules can be imported', () => {
  for (const page of EXPECTED_PAGES) {
    it(`${page} should export a named function`, async () => {
      const mod = await import(`../pages/${page}.tsx`);
      expect(mod[page]).toBeDefined();
      expect(typeof mod[page]).toBe('function');
    });
  }
});

describe('Store modules', () => {
  it('auth store exports useAuthStore', async () => {
    const mod = await import('../store/auth');
    expect(mod.useAuthStore).toBeDefined();
  });

  it('onboarding store exports useOnboardingStore and STEPS', async () => {
    const mod = await import('../store/onboarding');
    expect(mod.useOnboardingStore).toBeDefined();
    expect(mod.STEPS).toBeDefined();
  });

  it('marketplaces store exports useMarketplacesStore', async () => {
    const mod = await import('../store/marketplaces');
    expect(mod.useMarketplacesStore).toBeDefined();
  });
});
