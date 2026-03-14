import { Header } from "../components/layout/Header";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../components/ui/card";
import { Button } from "../components/ui/button";
import { Badge } from "../components/ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "../components/ui/dialog";
import { ShoppingBag, MessageSquare, ExternalLink, User, Loader2, AlertTriangle } from "lucide-react";
import { useMarketplacesStore } from "../store/marketplaces";
import { useEffect, useState } from "react";
import { api } from "../lib/api";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Link, useSearchParams } from "react-router-dom";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { useToast } from "../components/ui/use-toast";
import { Label } from "../components/ui/label";
import { Input } from "../components/ui/input";
import type { AffiliateAccount } from "../types";

const profileSchema = z.object({
  name: z.string().min(2, "Nome deve ter pelo menos 2 caracteres"),
  email: z.string().email("E-mail inválido"),
});

type ProfileFormValues = z.infer<typeof profileSchema>;

const STATUS_CONFIG: Record<string, { label: string; variant: 'success' | 'destructive' | 'secondary' }> = {
  ACTIVE: { label: 'CONECTADO', variant: 'success' },
  EXPIRED: { label: 'EXPIRADO', variant: 'destructive' },
  REVOKED: { label: 'DESCONECTADO', variant: 'secondary' },
};

function AccountStatusBadge({ status }: { status: string }) {
  const config = STATUS_CONFIG[status] || STATUS_CONFIG.REVOKED;
  return <Badge variant={config.variant}>{config.label}</Badge>;
}

function MarketplaceCard({
  title,
  description,
  account,
  onConnect,
  onDisconnect,
  onReconnect,
  connecting,
}: {
  title: string;
  description: string;
  account: AffiliateAccount | undefined;
  onConnect: () => void;
  onDisconnect: (id: string) => void;
  onReconnect: () => void;
  connecting: boolean;
}) {
  return (
    <Card className="border-border/50 bg-card/50">
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <div className="flex flex-col gap-1">
          <CardTitle className="text-base">{title}</CardTitle>
          <CardDescription>{description}</CardDescription>
        </div>
        {account ? (
          <AccountStatusBadge status={account.status} />
        ) : (
          <Badge variant="secondary">DESCONECTADO</Badge>
        )}
      </CardHeader>
      <CardContent className="pt-4">
        {account && account.status !== 'REVOKED' ? (
          <div className="space-y-4">
            <div className="rounded-lg bg-secondary/30 p-3 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Conta:</span>
                <span className="font-medium">{account.label}</span>
              </div>
              <div className="mt-1 flex justify-between">
                <span className="text-muted-foreground">Última sincronização:</span>
                <span className="font-medium">
                  {account.lastSyncAt ? format(new Date(account.lastSyncAt), "dd/MM/yyyy HH:mm", { locale: ptBR }) : 'Nunca'}
                </span>
              </div>
              {account.expiresAt && (
                <div className="mt-1 flex justify-between">
                  <span className="text-muted-foreground">Expira em:</span>
                  <span className="font-medium">
                    {format(new Date(account.expiresAt), "dd/MM/yyyy HH:mm", { locale: ptBR })}
                  </span>
                </div>
              )}
            </div>
            {account.status === 'EXPIRED' && (
              <Button className="w-full gap-2" variant="outline" onClick={onReconnect} disabled={connecting}>
                {connecting && <Loader2 className="h-4 w-4 animate-spin" />}
                <AlertTriangle className="h-4 w-4" /> Reconectar
              </Button>
            )}
            <Button
              variant="outline"
              className="w-full text-destructive hover:bg-destructive/10"
              onClick={() => onDisconnect(account.id)}
            >
              Desconectar
            </Button>
          </div>
        ) : (
          <Button className="w-full gap-2" onClick={onConnect} disabled={connecting}>
            {connecting ? <Loader2 className="h-4 w-4 animate-spin" /> : <ExternalLink className="h-4 w-4" />}
            Conectar {title}
          </Button>
        )}
      </CardContent>
    </Card>
  );
}

export function SettingsPage() {
  const { accounts, loadAccounts, disconnect, connectShopee } = useMarketplacesStore();
  const { toast } = useToast();
  const [searchParams, setSearchParams] = useSearchParams();
  const [shopeeDialogOpen, setShopeeDialogOpen] = useState(false);
  const [shopeeAppId, setShopeeAppId] = useState('');
  const [shopeeSecret, setShopeeSecret] = useState('');
  const [connecting, setConnecting] = useState<string | null>(null);

  const form = useForm<ProfileFormValues>({
    resolver: zodResolver(profileSchema),
    defaultValues: {
      name: (() => { try { const { useAuthStore } = require('../store/auth'); const user = useAuthStore.getState().user; return user?.user_metadata?.full_name || user?.email?.split('@')[0] || ''; } catch { return ''; } })(),
      email: (() => { try { const { useAuthStore } = require('../store/auth'); return useAuthStore.getState().user?.email || ''; } catch { return ''; } })(),
    },
  });

  const onSubmit = (data: ProfileFormValues) => {
    console.log(data);
    toast({
      title: "Perfil atualizado",
      description: "Suas informações foram salvas com sucesso.",
    });
  };

  useEffect(() => {
    loadAccounts();
  }, []);

  useEffect(() => {
    const connected = searchParams.get('connected');
    const error = searchParams.get('error');

    if (connected) {
      toast({
        title: "Marketplace conectado",
        description: `${connected === 'mercadolivre' ? 'Mercado Livre' : 'Shopee'} foi conectado com sucesso.`,
      });
      loadAccounts();
      setSearchParams({}, { replace: true });
    }

    if (error) {
      toast({
        title: "Erro na conexão",
        description: `Falha ao conectar ${error === 'mercadolivre' ? 'Mercado Livre' : 'Shopee'}. Tente novamente.`,
        variant: "destructive",
      });
      setSearchParams({}, { replace: true });
    }
  }, [searchParams]);

  const handleConnectML = async () => {
    setConnecting('mercadolivre');
    try {
      const { url } = await api.get('/oauth/mercadolivre/connect');
      window.location.href = url;
    } catch (error) {
      toast({
        title: "Erro",
        description: "Falha ao iniciar conexão com Mercado Livre.",
        variant: "destructive",
      });
      setConnecting(null);
    }
  };

  const handleConnectShopee = async () => {
    if (!shopeeAppId.trim() || !shopeeSecret.trim()) return;
    setConnecting('shopee');
    try {
      await connectShopee(shopeeAppId.trim(), shopeeSecret.trim());
      setShopeeDialogOpen(false);
      setShopeeAppId('');
      setShopeeSecret('');
      toast({
        title: "Shopee conectada",
        description: "Suas credenciais foram validadas e salvas.",
      });
    } catch (error) {
      toast({
        title: "Credenciais inválidas",
        description: "Verifique o App ID e Secret Key da Shopee.",
        variant: "destructive",
      });
    } finally {
      setConnecting(null);
    }
  };

  const handleDisconnect = async (id: string) => {
    try {
      await disconnect(id);
      toast({
        title: "Marketplace desconectado",
        description: "A conta foi desconectada com sucesso.",
      });
    } catch (error) {
      toast({
        title: "Erro",
        description: "Falha ao desconectar a conta.",
        variant: "destructive",
      });
    }
  };

  const shopeeAccount = accounts.find(a => a.marketplace === 'SHOPEE' && a.status !== 'REVOKED');
  const mlAccount = accounts.find(a => a.marketplace === 'MERCADOLIVRE' && a.status !== 'REVOKED');

  return (
    <div className="flex flex-col gap-6">
      <Header title="Configurações" showNewPromo={false} />

      <div className="grid grid-cols-1 gap-6 px-4 sm:px-6 lg:grid-cols-2">
        <div className="space-y-6">
          <div className="flex items-center gap-2">
            <User className="h-5 w-5 text-primary" />
            <h2 className="text-lg font-semibold">Seu Perfil</h2>
          </div>
          <Card className="border-border/50 bg-card/50">
            <CardContent className="pt-6">
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="name">Nome</Label>
                  <Input id="name" {...form.register("name")} />
                  {form.formState.errors.name && (
                    <p className="text-xs text-destructive">{form.formState.errors.name.message}</p>
                  )}
                </div>
                <div className="space-y-2">
                  <Label htmlFor="email">E-mail</Label>
                  <Input id="email" type="email" {...form.register("email")} />
                  {form.formState.errors.email && (
                    <p className="text-xs text-destructive">{form.formState.errors.email.message}</p>
                  )}
                </div>
                <Button type="submit">Salvar Alterações</Button>
              </form>
            </CardContent>
          </Card>

          <div className="flex items-center gap-2 pt-4">
            <MessageSquare className="h-5 w-5 text-primary" />
            <h2 className="text-lg font-semibold">WhatsApp</h2>
          </div>

          <Card className="border-border/50 bg-card/50">
            <CardHeader>
              <CardTitle className="text-base">Gestão de Sessões</CardTitle>
              <CardDescription>Gerencie seus números conectados e o aquecimento</CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">
                Para gerenciar suas sessões do WhatsApp, ver o status de saúde e sincronizar novos grupos, acesse a página dedicada.
              </p>
              <Link to="/whatsapp">
                <Button variant="outline" className="mt-4 w-full gap-2">
                  Ir para WhatsApp <ExternalLink className="h-4 w-4" />
                </Button>
              </Link>
            </CardContent>
          </Card>
        </div>

        <div className="space-y-6">
          <div className="flex items-center gap-2">
            <ShoppingBag className="h-5 w-5 text-primary" />
            <h2 className="text-lg font-semibold">Marketplaces</h2>
          </div>

          <MarketplaceCard
            title="Shopee"
            description="Programa de Afiliados Shopee"
            account={shopeeAccount}
            onConnect={() => setShopeeDialogOpen(true)}
            onDisconnect={handleDisconnect}
            onReconnect={() => setShopeeDialogOpen(true)}
            connecting={connecting === 'shopee'}
          />

          <MarketplaceCard
            title="Mercado Livre"
            description="Programa de Afiliados Mercado Livre"
            account={mlAccount}
            onConnect={handleConnectML}
            onDisconnect={handleDisconnect}
            onReconnect={handleConnectML}
            connecting={connecting === 'mercadolivre'}
          />
        </div>
      </div>

      <Dialog open={shopeeDialogOpen} onOpenChange={setShopeeDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Conectar Shopee</DialogTitle>
            <DialogDescription>
              Insira as credenciais do Programa de Afiliados Shopee. Encontre-as no painel de afiliados em affiliate.shopee.com.br.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label htmlFor="shopee-app-id">App ID</Label>
              <Input
                id="shopee-app-id"
                placeholder="Ex: 12345678"
                value={shopeeAppId}
                onChange={(e) => setShopeeAppId(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="shopee-secret">Secret Key</Label>
              <Input
                id="shopee-secret"
                type="password"
                placeholder="Ex: abc123def456..."
                value={shopeeSecret}
                onChange={(e) => setShopeeSecret(e.target.value)}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShopeeDialogOpen(false)}>
              Cancelar
            </Button>
            <Button
              onClick={handleConnectShopee}
              disabled={!shopeeAppId.trim() || !shopeeSecret.trim() || connecting === 'shopee'}
            >
              {connecting === 'shopee' && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Validar e Conectar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
