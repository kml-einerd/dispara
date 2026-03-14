'use client';

import { WaSession } from "@/src/types";
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "../ui/card";
import { Badge } from "../ui/badge";
import { Button } from "../ui/button";
import { Progress } from "../ui/progress";
import { RefreshCw, Power, QrCode, Activity } from "lucide-react";
import { api } from "@/src/lib/api";
import { toast } from "../ui/use-toast";

interface SessionCardProps {
  session: WaSession;
  onViewQR: () => void;
  onRefresh: () => void;
}

export function SessionCard({ session, onViewQR, onRefresh }: SessionCardProps) {
  const statusColors = {
    CONNECTED: 'success',
    DISCONNECTED: 'secondary',
    BANNED: 'destructive',
    WARMING_UP: 'default',
  } as const;

  const handleDisconnect = async () => {
    try {
      await api.delete(`/wa/sessions/${session.id}`);
      toast({ title: "Sessão desconectada", description: "A sessão foi removida com sucesso." });
      onRefresh();
    } catch (error) {
      toast({ title: "Erro ao desconectar", description: "Não foi possível desconectar a sessão.", variant: "destructive" });
    }
  };

  const handleSyncGroups = async () => {
    try {
      const { imported } = await api.post('/groups/import', { sessionId: session.id });
      toast({ title: "Grupos sincronizados", description: `${imported} grupos foram importados.` });
    } catch (error) {
      toast({ title: "Erro ao sincronizar", description: "Não foi possível sincronizar os grupos.", variant: "destructive" });
    }
  };

  return (
    <Card className="border-border/50 bg-card/50">
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <div className="flex flex-col">
          <CardTitle className="text-base">{session.name}</CardTitle>
          <span className="text-xs text-muted-foreground">{session.phoneNumber || 'Não identificado'}</span>
        </div>
        <Badge variant={statusColors[session.status]}>
          {session.status}
        </Badge>
      </CardHeader>
      
      <CardContent className="space-y-4 pt-4">
        <div className="space-y-2">
          <div className="flex items-center justify-between text-xs">
            <span className="flex items-center gap-1 text-muted-foreground">
              <Activity className="h-3 w-3" /> Health Score
            </span>
            <span className="font-medium">{session.healthScore}%</span>
          </div>
          <Progress value={session.healthScore} className="h-1.5" />
        </div>

        <div className="flex items-center justify-between rounded-lg bg-secondary/30 p-2 text-xs">
          <div className="flex flex-col">
            <span className="text-muted-foreground">Warmup Day</span>
            <span className="font-bold">{session.warmupDay}</span>
          </div>
          <div className="flex flex-col text-right">
            <span className="text-muted-foreground">Mensagens Hoje</span>
            <span className="font-bold">{session.dailyMsgCount}</span>
          </div>
        </div>
      </CardContent>

      <CardFooter className="grid grid-cols-2 gap-2">
        {session.status === 'DISCONNECTED' ? (
          <Button variant="outline" size="sm" className="col-span-2 min-h-[44px] gap-2" onClick={onViewQR}>
            <QrCode className="h-4 w-4" /> Ver QR
          </Button>
        ) : (
          <>
            <Button variant="outline" size="sm" className="min-h-[44px] gap-2" onClick={handleSyncGroups}>
              <RefreshCw className="h-3 w-3" /> Sincronizar
            </Button>
            <Button variant="ghost" size="sm" className="min-h-[44px] gap-2 text-destructive hover:bg-destructive/10" onClick={handleDisconnect}>
              <Power className="h-3 w-3" /> Desconectar
            </Button>
          </>
        )}
      </CardFooter>
    </Card>
  );
}
