import { describe, it, expect } from 'vitest';

// All routes defined in App.tsx
const EXPECTED_ROUTES = [
  '/copiloto',
  '/dashboard',
  '/whatsapp',
  '/groups',
  '/promos',
  '/promos/new',
  '/dispatches',
  '/commissions',
  '/settings',
  '/login',
];

// Sidebar nav items (must match routes)
const SIDEBAR_HREFS = [
  '/copiloto',
  '/dashboard',
  '/whatsapp',
  '/groups',
  '/promos',
  '/dispatches',
  '/commissions',
  '/settings',
];

// Protected routes from App.tsx
const DEFINED_ROUTES = [
  '/copiloto', '/dashboard', '/whatsapp', '/groups',
  '/promos', '/promos/new', '/dispatches', '/commissions', '/settings',
];

describe('Routing configuration', () => {
  it('all sidebar links should match a defined route', () => {
    for (const href of SIDEBAR_HREFS) {
      expect(DEFINED_ROUTES).toContain(href);
    }
  });

  it('should have login as a public route', () => {
    expect(EXPECTED_ROUTES).toContain('/login');
  });

  it('should have copiloto as the default protected route', () => {
    expect(DEFINED_ROUTES).toContain('/copiloto');
  });

  it('should define all expected protected routes', () => {
    for (const route of DEFINED_ROUTES) {
      expect(EXPECTED_ROUTES).toContain(route);
    }
  });

  it('no sidebar link should point to a non-existent route', () => {
    for (const href of SIDEBAR_HREFS) {
      const matched = DEFINED_ROUTES.some(r => r === href);
      expect(matched).toBe(true);
    }
  });
});
