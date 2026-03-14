import { Header } from "../components/layout/Header";
import { Card, CardContent } from "../components/ui/card";
import { Badge } from "../components/ui/badge";
import { Switch } from "../components/ui/switch";
import { Users, Search, Filter } from "lucide-react";
import { Input } from "../components/ui/input";
import useSWR from "swr";
import { PullToRefresh } from "../components/ui/pull-to-refresh";
import { Group, WaSession } from "../types";
import { useState } from "react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../components/ui/select";

export function GroupsPage() {
  const { data: groupsData, mutate } = useSWR('/groups');
  const { data: sessionsData } = useSWR('/wa/sessions');

  const groups: Group[] = groupsData?.data || [];
  const sessions: WaSession[] = sessionsData?.sessions || [];

  const [search, setSearch] = useState('');
  const [sessionFilter, setSessionFilter] = useState('all');

  const filteredGroups = groups.filter(group => {
    const matchesSearch = group.name.toLowerCase().includes(search.toLowerCase());
    const matchesSession = sessionFilter === 'all' || group.sessionId === sessionFilter;
    return matchesSearch && matchesSession;
  });

  return (
    <PullToRefresh onRefresh={() => mutate()}>
    <div className="flex flex-col gap-6">
      <Header title="Grupos" showNewPromo={false} />

      <div className="flex flex-col gap-4 px-4 sm:px-6 md:flex-row md:items-center md:justify-between">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Buscar grupos..."
            className="pl-10"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>

        <div className="flex items-center gap-2">
          <Filter className="h-4 w-4 text-muted-foreground" />
          <Select value={sessionFilter} onValueChange={setSessionFilter}>
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder="Filtrar por sessão" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todas as sessões</SelectItem>
              {sessions.map(s => (
                <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="px-4 sm:px-6">
        <Card className="border-border/50 bg-card/50">
          <CardContent className="p-0">
            <div className="divide-y divide-border/50">
              {filteredGroups.map((group) => (
                <div key={group.id} className="flex items-center justify-between gap-2 p-3 transition-colors hover:bg-accent/30 sm:p-4">
                  <div className="flex min-w-0 items-center gap-3 sm:gap-4">
                    <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10 text-primary">
                      <Users className="h-5 w-5" />
                    </div>
                    <div className="flex min-w-0 flex-col">
                      <span className="truncate font-medium text-sm">{group.name}</span>
                      <div className="flex items-center gap-2 text-xs text-muted-foreground">
                        <span>{group.memberCount} membros</span>
                        <span className="hidden sm:inline">•</span>
                        <span className="hidden sm:inline">Sessão: {sessions.find(s => s.id === group.sessionId)?.name || 'N/A'}</span>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-4">
                    <Badge variant={group.isActive ? 'success' : 'secondary'}>
                      {group.isActive ? 'ATIVO' : 'INATIVO'}
                    </Badge>
                    <Switch checked={group.isActive} />
                  </div>
                </div>
              ))}
              {filteredGroups.length === 0 && (
                <div className="py-20 text-center text-muted-foreground">
                  {groups.length === 0
                    ? "Conecte um número WA e sincronize os grupos"
                    : "Nenhum grupo encontrado com os filtros atuais"}
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
    </PullToRefresh>
  );
}
