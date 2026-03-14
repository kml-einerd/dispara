import { Header } from "../components/layout/Header";
import { Card, CardContent } from "../components/ui/card";
import { Badge } from "../components/ui/badge";
import { ExternalLink, MoreVertical, Trash2, Edit } from "lucide-react";
import useSWR from "swr";
import { PullToRefresh } from "../components/ui/pull-to-refresh";
import { Promo } from "../types";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Button } from "../components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "../components/ui/dropdown-menu";
import { api } from "../lib/api";
import { useNavigate } from "react-router-dom";
import { useToast } from "../components/ui/use-toast";

export function PromosPage() {
  const { data: promosData, mutate } = useSWR('/promos');
  const promos: Promo[] = promosData?.data || [];
  const navigate = useNavigate();
  const { toast } = useToast();

  const handleDelete = async (promoId: string, promoName: string) => {
    if (!confirm(`Excluir "${promoName}"? Esta ação não pode ser desfeita.`)) return;
    try {
      await api.delete(`/promos/${promoId}`);
      toast({ title: "Promoção excluída", description: promoName });
      mutate();
    } catch {
      toast({ title: "Erro ao excluir", description: "Tente novamente.", variant: "destructive" });
    }
  };

  return (
    <PullToRefresh onRefresh={() => mutate()}>
    <div className="flex flex-col gap-6">
      <Header title="Promoções Criadas" />

      <div className="px-4 sm:px-6">
        <div className="grid grid-cols-1 gap-3 sm:gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {promos.map((promo) => (
            <Card key={promo.id} className="overflow-hidden border-border/50 bg-card/50 transition-all hover:border-primary/50">
              <div className="aspect-video overflow-hidden bg-muted">
                {promo.imageUrl && (
                  <img src={promo.imageUrl} alt={promo.productName} className="h-full w-full object-cover" />
                )}
              </div>
              <CardContent className="p-4">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex flex-col">
                    <h3 className="line-clamp-1 font-bold">{promo.productName}</h3>
                    <span className="text-xs text-muted-foreground">
                      {format(new Date(promo.createdAt), "dd/MM/yyyy HH:mm", { locale: ptBR })}
                    </span>
                  </div>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="icon" className="h-10 w-10">
                        <MoreVertical className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem className="gap-2" onClick={() => navigate(`/promos/nova?edit=${promo.id}`)}>
                        <Edit className="h-4 w-4" /> Editar
                      </DropdownMenuItem>
                      <DropdownMenuItem className="gap-2 text-destructive" onClick={() => handleDelete(promo.id, promo.productName)}>
                        <Trash2 className="h-4 w-4" /> Excluir
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>

                <div className="mt-4 flex items-center justify-between">
                  <div className="flex flex-col">
                    <span className="text-sm font-bold text-emerald-500">R$ {Number(promo.promoPrice).toFixed(2)}</span>
                    <span className="text-xs text-muted-foreground line-through">R$ {Number(promo.originalPrice).toFixed(2)}</span>
                  </div>
                  <Badge variant={promo.status === 'ACTIVE' ? 'success' : 'secondary'}>
                    {promo.status}
                  </Badge>
                </div>

                <div className="mt-4 flex gap-2">
                  <Button variant="outline" size="sm" className="min-h-[44px] flex-1 gap-2 text-xs" asChild>
                    <a href={promo.affiliateUrl} target="_blank" rel="noopener noreferrer">
                      Ver Link <ExternalLink className="h-3 w-3" />
                    </a>
                  </Button>
                  <Button size="sm" className="min-h-[44px] flex-1 gap-2 text-xs">
                    Disparar
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
          {promos.length === 0 && (
            <div className="col-span-full py-20 text-center text-muted-foreground">
              Nenhuma promoção criada ainda.
            </div>
          )}
        </div>
      </div>
    </div>
    </PullToRefresh>
  );
}
