import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';

// Mock SWR to avoid real fetching
vi.mock('swr', () => ({
  default: () => ({
    data: { commissions: [] },
    isLoading: false,
    error: null,
    mutate: vi.fn(),
  }),
}));

// Mock supabase
vi.mock('../../lib/supabase', () => ({
  supabase: {
    auth: {
      getSession: vi.fn().mockResolvedValue({ data: { session: null } }),
      onAuthStateChange: vi.fn().mockReturnValue({
        data: { subscription: { unsubscribe: vi.fn() } },
      }),
      signOut: vi.fn(),
    },
  },
}));

// Mock api
vi.mock('../../lib/api', () => ({
  api: {
    get: vi.fn().mockResolvedValue({ commissions: [] }),
    post: vi.fn(),
    delete: vi.fn(),
  },
}));

// Mock recharts to avoid canvas/SVG issues in jsdom
vi.mock('recharts', () => ({
  AreaChart: ({ children }: any) => <div data-testid="area-chart">{children}</div>,
  Area: () => null,
  XAxis: () => null,
  YAxis: () => null,
  CartesianGrid: () => null,
  Tooltip: () => null,
  ResponsiveContainer: ({ children }: any) => <div>{children}</div>,
}));

// Mock lucide-react icons
vi.mock('lucide-react', () => {
  const S = () => null;
  return { DollarSign: S, TrendingUp: S, Clock: S, CheckCircle2: S, XCircle: S, Plus: S };
});

import { MemoryRouter } from 'react-router-dom';
import { CommissionsPage } from '../../pages/CommissionsPage';

function renderPage() {
  return render(
    <MemoryRouter>
      <CommissionsPage />
    </MemoryRouter>,
  );
}

describe('CommissionsPage', () => {
  it('renderiza o título "Comissões"', () => {
    renderPage();
    expect(screen.getByText('Comissões')).toBeInTheDocument();
  });

  it('renderiza filtros de período (7d, 30d, 90d)', () => {
    renderPage();
    expect(screen.getByText('7d')).toBeInTheDocument();
    expect(screen.getByText('30d')).toBeInTheDocument();
    expect(screen.getByText('90d')).toBeInTheDocument();
  });

  it('renderiza abas de marketplace (Todos, Shopee, ML)', () => {
    renderPage();
    expect(screen.getByText('Todos')).toBeInTheDocument();
    expect(screen.getByText('Shopee')).toBeInTheDocument();
    expect(screen.getByText('ML')).toBeInTheDocument();
  });

  it('renderiza os 4 stat cards', () => {
    renderPage();
    expect(screen.getByText('Comissão Total')).toBeInTheDocument();
    expect(screen.getByText('Comissão Hoje')).toBeInTheDocument();
    expect(screen.getByText('Pendente')).toBeInTheDocument();
    expect(screen.getByText('Aprovado')).toBeInTheDocument();
  });

  it('renderiza seção de gráfico', () => {
    renderPage();
    expect(screen.getByText('Comissões por dia')).toBeInTheDocument();
  });

  it('renderiza seção de detalhamento', () => {
    renderPage();
    expect(screen.getByText('Detalhamento')).toBeInTheDocument();
  });
});
