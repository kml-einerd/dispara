import { useState, useMemo } from 'react';
import { Header } from '../components/layout/Header';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Badge } from '../components/ui/badge';
import { Skeleton } from '../components/ui/skeleton';
import {
  DollarSign,
  TrendingUp,
  Clock,
  CheckCircle2,
  XCircle,
} from 'lucide-react';
import { format, subDays } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';
import type { Marketplace } from '../types';

// ── Types ──────────────────────────────────────

type CommissionStatus = 'approved' | 'pending' | 'rejected';

interface Commission {
  id: string;
  productName: string;
  marketplace: Marketplace;
  value: number;
  status: CommissionStatus;
  date: string; // ISO
}

// ── Mock data ──────────────────────────────────

function generateMockCommissions(): Commission[] {
  const products = [
    { name: 'Fone Bluetooth TWS Pro', mp: 'SHOPEE' as Marketplace },
    { name: 'Capa iPhone 15 Silicone', mp: 'SHOPEE' as Marketplace },
    { name: 'Câmera Wi-Fi 360°', mp: 'MERCADOLIVRE' as Marketplace },
    { name: 'Kit 3 Meias Esportivas', mp: 'MERCADOLIVRE' as Marketplace },
    { name: 'Carregador 65W GaN', mp: 'SHOPEE' as Marketplace },
    { name: 'Mouse Gamer RGB 12000dpi', mp: 'MERCADOLIVRE' as Marketplace },
    { name: 'Teclado Mecânico Compacto', mp: 'SHOPEE' as Marketplace },
    { name: 'Hub USB-C 7 em 1', mp: 'MERCADOLIVRE' as Marketplace },
    { name: 'Luminária LED Desk', mp: 'SHOPEE' as Marketplace },
    { name: 'Suporte Notebook Alumínio', mp: 'MERCADOLIVRE' as Marketplace },
    { name: 'Webcam Full HD 1080p', mp: 'SHOPEE' as Marketplace },
    { name: 'Mousepad Grande 80x30', mp: 'SHOPEE' as Marketplace },
  ];
  const statuses: CommissionStatus[] = ['approved', 'approved', 'approved', 'pending', 'pending', 'rejected'];

  return products.map((p, i) => ({
    id: `comm-${i}`,
    productName: p.name,
    marketplace: p.mp,
    value: Math.round((Math.random() * 15 + 1) * 100) / 100,
    status: statuses[i % statuses.length],
    date: subDays(new Date(), Math.floor(Math.random() * 30)).toISOString(),
  }));
}

const MOCK_COMMISSIONS = generateMockCommissions();

// ── Helpers ────────────────────────────────────

const PERIODS = [
  { label: '7d', days: 7 },
  { label: '30d', days: 30 },
  { label: '90d', days: 90 },
] as const;

const MARKETPLACE_TABS = ['Todos', 'Shopee', 'ML'] as const;
type MarketplaceTab = (typeof MARKETPLACE_TABS)[number];

const tabToMarketplace: Record<MarketplaceTab, Marketplace | null> = {
  Todos: null,
  Shopee: 'SHOPEE',
  ML: 'MERCADOLIVRE',
};

const statusConfig: Record<CommissionStatus, { label: string; variant: 'success' | 'secondary' | 'destructive'; icon: React.ElementType }> = {
  approved: { label: 'Aprovado', variant: 'success', icon: CheckCircle2 },
  pending: { label: 'Pendente', variant: 'secondary', icon: Clock },
  rejected: { label: 'Rejeitado', variant: 'destructive', icon: XCircle },
};

function formatBRL(v: number) {
  return v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

// ── StatCard (reuse do dashboard pattern) ──────

function StatCard({
  label,
  value,
  icon: Icon,
  color,
  loading,
}: {
  label: string;
  value: string;
  icon: React.ElementType;
  color: string;
  loading?: boolean;
}) {
  return (
    <Card className="border-border/50 bg-card/50">
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground">{label}</CardTitle>
        <Icon className={`h-4 w-4 ${color}`} />
      </CardHeader>
      <CardContent>
        {loading ? (
          <Skeleton className="h-8 w-20" />
        ) : (
          <div className="text-2xl font-bold">{value}</div>
        )}
      </CardContent>
    </Card>
  );
}

// ── Page ───────────────────────────────────────

export function CommissionsPage() {
  const [activeTab, setActiveTab] = useState<MarketplaceTab>('Todos');
  const [periodDays, setPeriodDays] = useState(30);

  // TODO: replace with useSWR('/commissions') when backend is ready
  const allCommissions = MOCK_COMMISSIONS;
  const loading = false;

  const filtered = useMemo(() => {
    const cutoff = subDays(new Date(), periodDays);
    const mp = tabToMarketplace[activeTab];
    return allCommissions.filter((c) => {
      if (mp && c.marketplace !== mp) return false;
      return new Date(c.date) >= cutoff;
    });
  }, [allCommissions, activeTab, periodDays]);

  // ── Stats ──

  const totalCommission = filtered.reduce((s, c) => s + c.value, 0);
  const todayCutoff = new Date();
  todayCutoff.setHours(0, 0, 0, 0);
  const todayCommission = filtered
    .filter((c) => new Date(c.date) >= todayCutoff)
    .reduce((s, c) => s + c.value, 0);
  const pendingTotal = filtered.filter((c) => c.status === 'pending').reduce((s, c) => s + c.value, 0);
  const approvedTotal = filtered.filter((c) => c.status === 'approved').reduce((s, c) => s + c.value, 0);

  const stats = [
    { label: 'Comissão Total', value: formatBRL(totalCommission), icon: DollarSign, color: 'text-emerald-500' },
    { label: 'Comissão Hoje', value: formatBRL(todayCommission), icon: TrendingUp, color: 'text-violet-500' },
    { label: 'Pendente', value: formatBRL(pendingTotal), icon: Clock, color: 'text-orange-500' },
    { label: 'Aprovado', value: formatBRL(approvedTotal), icon: CheckCircle2, color: 'text-blue-500' },
  ];

  // ── Chart data ──

  const chartData = useMemo(() => {
    const days: Record<string, number> = {};
    for (let i = Math.min(periodDays, 30) - 1; i >= 0; i--) {
      days[format(subDays(new Date(), i), 'yyyy-MM-dd')] = 0;
    }
    for (const c of filtered) {
      const key = format(new Date(c.date), 'yyyy-MM-dd');
      if (days[key] !== undefined) days[key] += c.value;
    }
    return Object.entries(days).map(([date, value]) => ({
      date: format(new Date(date + 'T12:00:00'), 'dd/MM', { locale: ptBR }),
      Comissão: Math.round(value * 100) / 100,
    }));
  }, [filtered, periodDays]);

  // ── Sorted list ──

  const sortedList = useMemo(
    () => [...filtered].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()),
    [filtered],
  );

  return (
    <div className="flex flex-col gap-6">
      <Header title="Comissões" />

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3 px-4 sm:px-6">
        {/* Marketplace tabs */}
        <div className="flex rounded-lg border border-border/50 bg-card/50 p-0.5">
          {MARKETPLACE_TABS.map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
                activeTab === tab
                  ? 'bg-primary text-white'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              {tab}
            </button>
          ))}
        </div>

        {/* Period filter */}
        <div className="flex rounded-lg border border-border/50 bg-card/50 p-0.5">
          {PERIODS.map((p) => (
            <button
              key={p.label}
              onClick={() => setPeriodDays(p.days)}
              className={`rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
                periodDays === p.days
                  ? 'bg-primary text-white'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              {p.label}
            </button>
          ))}
        </div>
      </div>

      {/* Stat Cards */}
      <div className="grid grid-cols-2 gap-3 px-4 sm:gap-4 sm:px-6 lg:grid-cols-4">
        {stats.map((stat) => (
          <StatCard key={stat.label} {...stat} loading={loading} />
        ))}
      </div>

      {/* Chart */}
      <div className="px-4 sm:px-6">
        <Card className="border-border/50 bg-card/50">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <TrendingUp className="h-4 w-4 text-emerald-500" />
              Comissões por dia
            </CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? (
              <Skeleton className="h-[250px] w-full" />
            ) : (
              <ResponsiveContainer width="100%" height={250}>
                <AreaChart data={chartData}>
                  <defs>
                    <linearGradient id="colorComm" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#10b981" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis dataKey="date" tick={{ fontSize: 12 }} stroke="hsl(var(--muted-foreground))" />
                  <YAxis tick={{ fontSize: 12 }} stroke="hsl(var(--muted-foreground))" tickFormatter={(v) => `R$${v}`} />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: 'hsl(var(--card))',
                      border: '1px solid hsl(var(--border))',
                      borderRadius: '8px',
                      fontSize: '12px',
                    }}
                    formatter={(value: number) => [formatBRL(value), 'Comissão']}
                  />
                  <Area type="monotone" dataKey="Comissão" stroke="#10b981" fill="url(#colorComm)" strokeWidth={2} />
                </AreaChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Commission List */}
      <div className="px-4 sm:px-6">
        <Card className="border-border/50 bg-card/50">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <DollarSign className="h-4 w-4 text-violet-500" />
              Detalhamento
            </CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="space-y-3">
                {Array.from({ length: 5 }).map((_, i) => (
                  <Skeleton key={i} className="h-14 w-full" />
                ))}
              </div>
            ) : sortedList.length === 0 ? (
              <p className="py-6 text-center text-sm text-muted-foreground">
                Nenhuma comissão no período selecionado.
              </p>
            ) : (
              <div className="space-y-2">
                {sortedList.map((c) => {
                  const cfg = statusConfig[c.status];
                  return (
                    <div
                      key={c.id}
                      className="flex items-center justify-between rounded-lg border border-border/50 p-3"
                    >
                      <div className="flex min-w-0 flex-col gap-0.5">
                        <span className="truncate text-sm font-medium">{c.productName}</span>
                        <span className="text-xs text-muted-foreground">
                          {c.marketplace === 'SHOPEE' ? 'Shopee' : 'Mercado Livre'} · {format(new Date(c.date), "dd/MM 'às' HH:mm", { locale: ptBR })}
                        </span>
                      </div>
                      <div className="flex shrink-0 items-center gap-3">
                        <span className="text-sm font-bold text-emerald-500">{formatBRL(c.value)}</span>
                        <Badge variant={cfg.variant}>{cfg.label}</Badge>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
