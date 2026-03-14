import { Header } from "../components/layout/Header";
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/card";
import { Badge } from "../components/ui/badge";
import { Skeleton } from "../components/ui/skeleton";
import { Progress } from "../components/ui/progress";
import { Tag, MessageSquare, Users, MousePointer2, Activity, Wifi, WifiOff, TrendingUp, Send } from "lucide-react";
import useSWR from "swr";
import { Promo, Dispatch, WaSession, Group } from "../types";
import { format, subDays } from "date-fns";
import { ptBR } from "date-fns/locale";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";

const REFRESH_INTERVAL = 30_000;

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

function buildChartData(dispatches: Dispatch[]) {
  const days: Record<string, { sent: number; failed: number }> = {};
  for (let i = 6; i >= 0; i--) {
    const d = format(subDays(new Date(), i), 'yyyy-MM-dd');
    days[d] = { sent: 0, failed: 0 };
  }

  for (const d of dispatches) {
    const date = format(new Date(d.createdAt), 'yyyy-MM-dd');
    if (days[date]) {
      days[date].sent += d.sentCount;
      days[date].failed += d.failedCount;
    }
  }

  return Object.entries(days).map(([date, counts]) => ({
    date: format(new Date(date + 'T12:00:00'), 'dd/MM', { locale: ptBR }),
    Enviadas: counts.sent,
    Falhas: counts.failed,
  }));
}

const dispatchStatusLabels: Record<string, string> = {
  PENDING: 'Pendente',
  PROCESSING: 'Processando',
  COMPLETED: 'Concluído',
  FAILED: 'Falhou',
  CANCELLED: 'Cancelado',
};

export function DashboardPage() {
  const { data: promosData, isLoading: loadingPromos } = useSWR('/promos', { refreshInterval: REFRESH_INTERVAL });
  const { data: dispatchesData, isLoading: loadingDispatches } = useSWR('/dispatches', { refreshInterval: REFRESH_INTERVAL });
  const { data: sessionsData, isLoading: loadingSessions } = useSWR('/wa/sessions', { refreshInterval: REFRESH_INTERVAL });
  const { data: groupsData, isLoading: loadingGroups } = useSWR('/groups', { refreshInterval: REFRESH_INTERVAL });

  const promos: Promo[] = promosData?.data || [];
  const dispatches: Dispatch[] = dispatchesData?.data || [];
  const sessions: WaSession[] = sessionsData?.sessions || [];
  const groups: Group[] = groupsData?.data || [];

  const loading = loadingPromos || loadingDispatches || loadingSessions || loadingGroups;

  const totalSent = dispatches.reduce((acc, d) => acc + d.sentCount, 0);
  const totalFailed = dispatches.reduce((acc, d) => acc + d.failedCount, 0);
  const activeGroups = groups.filter(g => g.isActive).length;
  const successRate = totalSent > 0 ? ((totalSent - totalFailed) / totalSent * 100).toFixed(1) : '0';

  const chartData = buildChartData(dispatches);

  const stats = [
    { label: 'Promos ativas', value: promos.filter(p => p.status === 'ACTIVE').length.toString(), icon: Tag, color: 'text-violet-500' },
    { label: 'Mensagens enviadas', value: totalSent.toLocaleString('pt-BR'), icon: MessageSquare, color: 'text-emerald-500' },
    { label: 'Grupos ativos', value: activeGroups.toString(), icon: Users, color: 'text-blue-500' },
    { label: 'Taxa sucesso', value: `${successRate}%`, icon: MousePointer2, color: 'text-orange-500' },
  ];

  return (
    <div className="flex flex-col gap-6">
      <Header title="Overview" />

      {/* Stat Cards */}
      <div className="grid grid-cols-2 gap-3 px-4 sm:gap-4 sm:px-6 lg:grid-cols-4">
        {stats.map((stat) => (
          <StatCard key={stat.label} {...stat} loading={loading} />
        ))}
      </div>

      {/* Chart + WhatsApp Sessions */}
      <div className="grid grid-cols-1 gap-4 px-4 sm:px-6 lg:grid-cols-3">
        <Card className="border-border/50 bg-card/50 lg:col-span-2">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <TrendingUp className="h-4 w-4 text-emerald-500" />
              Disparos — últimos 7 dias
            </CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? (
              <Skeleton className="h-[250px] w-full" />
            ) : (
              <ResponsiveContainer width="100%" height={250}>
                <AreaChart data={chartData}>
                  <defs>
                    <linearGradient id="colorSent" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#10b981" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                    </linearGradient>
                    <linearGradient id="colorFailed" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#ef4444" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="#ef4444" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis dataKey="date" tick={{ fontSize: 12 }} stroke="hsl(var(--muted-foreground))" />
                  <YAxis tick={{ fontSize: 12 }} stroke="hsl(var(--muted-foreground))" />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: 'hsl(var(--card))',
                      border: '1px solid hsl(var(--border))',
                      borderRadius: '8px',
                      fontSize: '12px',
                    }}
                  />
                  <Area type="monotone" dataKey="Enviadas" stroke="#10b981" fill="url(#colorSent)" strokeWidth={2} />
                  <Area type="monotone" dataKey="Falhas" stroke="#ef4444" fill="url(#colorFailed)" strokeWidth={2} />
                </AreaChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        <Card className="border-border/50 bg-card/50">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Activity className="h-4 w-4 text-blue-500" />
              WhatsApp Sessions
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {loading ? (
              Array.from({ length: 2 }).map((_, i) => (
                <Skeleton key={i} className="h-20 w-full" />
              ))
            ) : sessions.length === 0 ? (
              <p className="py-4 text-center text-sm text-muted-foreground">Nenhuma sessão configurada.</p>
            ) : (
              sessions.map((session) => (
                <div key={session.id} className="rounded-lg border border-border/50 p-3 space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      {session.status === 'CONNECTED' ? (
                        <Wifi className="h-3.5 w-3.5 text-emerald-500" />
                      ) : (
                        <WifiOff className="h-3.5 w-3.5 text-muted-foreground" />
                      )}
                      <span className="text-sm font-medium">{session.name}</span>
                    </div>
                    <Badge variant={session.status === 'CONNECTED' ? 'success' : session.status === 'BANNED' ? 'destructive' : 'secondary'}>
                      {session.status}
                    </Badge>
                  </div>
                  <div className="flex items-center gap-2">
                    <Progress value={session.healthScore} className="h-1.5 flex-1" />
                    <span className="text-xs text-muted-foreground">{session.healthScore}%</span>
                  </div>
                  <div className="flex justify-between text-xs text-muted-foreground">
                    <span>Day {session.warmupDay}</span>
                    <span>{session.dailyMsgCount} msgs hoje</span>
                  </div>
                </div>
              ))
            )}
          </CardContent>
        </Card>
      </div>

      {/* Últimos Dispatches + Últimas Promos */}
      <div className="grid grid-cols-1 gap-4 px-4 sm:px-6 lg:grid-cols-2">
        <Card className="border-border/50 bg-card/50">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Send className="h-4 w-4 text-violet-500" />
              Últimos Disparos
            </CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="space-y-3">
                {Array.from({ length: 3 }).map((_, i) => (
                  <Skeleton key={i} className="h-14 w-full" />
                ))}
              </div>
            ) : dispatches.length === 0 ? (
              <p className="py-6 text-center text-sm text-muted-foreground">Nenhum disparo realizado.</p>
            ) : (
              <div className="space-y-3">
                {dispatches.slice(0, 5).map((d) => (
                  <div key={d.id} className="flex items-center justify-between rounded-lg border border-border/50 p-3">
                    <div className="flex flex-col gap-0.5">
                      <span className="text-sm font-medium">
                        {d.totalGroups} grupo{d.totalGroups !== 1 ? 's' : ''}
                      </span>
                      <span className="text-xs text-muted-foreground">
                        {format(new Date(d.createdAt), "dd/MM 'às' HH:mm", { locale: ptBR })}
                      </span>
                    </div>
                    <div className="flex items-center gap-3">
                      <div className="text-right text-xs">
                        <span className="text-emerald-500">{d.sentCount} ok</span>
                        {d.failedCount > 0 && (
                          <span className="ml-1 text-red-400">{d.failedCount} fail</span>
                        )}
                      </div>
                      <Badge variant={d.status === 'COMPLETED' ? 'success' : d.status === 'FAILED' ? 'destructive' : 'secondary'}>
                        {dispatchStatusLabels[d.status] || d.status}
                      </Badge>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="border-border/50 bg-card/50">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Tag className="h-4 w-4 text-violet-500" />
              Últimas Promoções
            </CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="space-y-3">
                {Array.from({ length: 3 }).map((_, i) => (
                  <Skeleton key={i} className="h-16 w-full" />
                ))}
              </div>
            ) : promos.length === 0 ? (
              <p className="py-6 text-center text-sm text-muted-foreground">Nenhuma promoção criada ainda.</p>
            ) : (
              <div className="space-y-3">
                {promos.slice(0, 5).map((promo) => (
                  <div key={promo.id} className="flex items-center justify-between gap-3 rounded-lg border border-border/50 p-3">
                    <div className="flex min-w-0 items-center gap-3">
                      <div className="h-10 w-10 shrink-0 overflow-hidden rounded-md bg-muted">
                        {promo.imageUrl && (
                          <img src={promo.imageUrl} alt={promo.productName} className="h-full w-full object-cover" />
                        )}
                      </div>
                      <div className="flex min-w-0 flex-col">
                        <span className="truncate text-sm font-medium">{promo.productName}</span>
                        <span className="text-xs text-muted-foreground">
                          {format(new Date(promo.createdAt), "dd 'de' MMM", { locale: ptBR })}
                        </span>
                      </div>
                    </div>
                    <div className="flex shrink-0 items-center gap-3">
                      <div className="text-right">
                        <div className="text-sm font-bold text-emerald-500">R$ {Number(promo.promoPrice).toFixed(2)}</div>
                        <div className="text-xs text-muted-foreground line-through">R$ {Number(promo.originalPrice).toFixed(2)}</div>
                      </div>
                      <Badge variant={promo.status === 'ACTIVE' ? 'success' : 'secondary'} className="hidden sm:inline-flex">
                        {promo.status}
                      </Badge>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
