import { useState } from 'react';
import { useOnboardingStore, STEPS, type OnboardingStep } from '../../store/onboarding';
import { Button } from '../ui/button';
import { Progress } from '../ui/progress';
import { Card, CardContent } from '../ui/card';
import { Badge } from '../ui/badge';
import { QRCodeModal } from '../whatsapp/QRCodeModal';
import { api } from '../../lib/api';
import useSWR from 'swr';
import type { WaSession, Group, Product } from '../../types';
import {
  Smartphone,
  Users,
  ShoppingBag,
  Send,
  Check,
  ChevronRight,
  ChevronLeft,
  Loader2,
  QrCode,
  RefreshCw,
  Rocket,
  Search,
  Sparkles,
  X,
} from 'lucide-react';

const STEP_META: Record<OnboardingStep, { icon: typeof Smartphone; title: string; description: string }> = {
  'connect-whatsapp': {
    icon: Smartphone,
    title: 'Conectar WhatsApp',
    description: 'Escaneie o QR Code para vincular seu número.',
  },
  'select-groups': {
    icon: Users,
    title: 'Selecionar Grupos',
    description: 'Sincronize e escolha os grupos para disparar.',
  },
  'create-promo': {
    icon: ShoppingBag,
    title: 'Criar Primeira Promo',
    description: 'Busque um produto e gere uma copy de venda.',
  },
  'test-dispatch': {
    icon: Send,
    title: 'Disparo de Teste',
    description: 'Envie sua primeira mensagem para validar o fluxo.',
  },
};

export function OnboardingWizard() {
  const {
    isOpen,
    currentStep,
    nextStep,
    prevStep,
    connectedSessionId,
    selectedGroupIds,
    createdPromoId,
    setConnectedSession,
    setSelectedGroups,
    setCreatedPromo,
    complete,
    close,
    skip,
  } = useOnboardingStore();

  const isMobile = typeof window !== 'undefined' && window.innerWidth < 768;

  if (!isOpen) return null;

  const currentIdx = STEPS.indexOf(currentStep);
  const progressPercent = ((currentIdx + 1) / STEPS.length) * 100;

  const canAdvance = (() => {
    switch (currentStep) {
      case 'connect-whatsapp': return !!connectedSessionId;
      case 'select-groups': return selectedGroupIds.length > 0;
      case 'create-promo': return !!createdPromoId;
      case 'test-dispatch': return true;
    }
  })();

  const isLastStep = currentIdx === STEPS.length - 1;

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-background">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-border/50 px-6 py-4">
        <div className="flex items-center gap-3">
          <Rocket className="h-6 w-6 text-primary" />
          <span className="text-lg font-bold">Primeiros Passos</span>
        </div>
        <Button variant="ghost" size="sm" onClick={skip} className="text-muted-foreground">
          <X className="h-4 w-4" />
          <span className="ml-1">Pular por agora</span>
        </Button>
      </div>

      {/* Step indicators */}
      <div className="border-b border-border/50 px-6 py-4">
        <div className="mx-auto flex max-w-2xl items-center gap-2">
          {STEPS.map((step, idx) => {
            const meta = STEP_META[step];
            const Icon = meta.icon;
            const isDone = idx < currentIdx;
            const isActive = idx === currentIdx;

            return (
              <div key={step} className="flex flex-1 items-center gap-2">
                <div
                  className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full border text-xs font-bold transition-colors ${
                    isDone
                      ? 'border-accent bg-accent/20 text-accent'
                      : isActive
                        ? 'border-primary bg-primary/20 text-primary'
                        : 'border-border text-muted-foreground'
                  }`}
                >
                  {isDone ? <Check className="h-4 w-4" /> : <Icon className="h-4 w-4" />}
                </div>
                <span className={`hidden text-xs md:block ${isActive ? 'font-semibold text-white' : 'text-muted-foreground'}`}>
                  {meta.title}
                </span>
                {idx < STEPS.length - 1 && <div className="mx-2 h-px flex-1 bg-border/50" />}
              </div>
            );
          })}
        </div>
        <Progress value={progressPercent} className="mx-auto mt-4 h-1 max-w-2xl" />
      </div>

      {/* Step content */}
      <div className="flex flex-1 items-center justify-center overflow-y-auto px-6 py-8">
        <div className="w-full max-w-2xl">
          {currentStep === 'connect-whatsapp' && (
            <StepConnectWhatsApp
              connectedSessionId={connectedSessionId}
              onConnected={setConnectedSession}
            />
          )}
          {currentStep === 'select-groups' && (
            <StepSelectGroups
              sessionId={connectedSessionId!}
              selectedIds={selectedGroupIds}
              onSelect={setSelectedGroups}
            />
          )}
          {currentStep === 'create-promo' && (
            <StepCreatePromo
              promoId={createdPromoId}
              onCreated={setCreatedPromo}
            />
          )}
          {currentStep === 'test-dispatch' && (
            <StepTestDispatch
              promoId={createdPromoId}
              groupIds={selectedGroupIds}
              sessionId={connectedSessionId}
            />
          )}
        </div>
      </div>

      {/* Footer */}
      <div className="flex items-center justify-between border-t border-border/50 px-6 py-4">
        <Button
          variant="ghost"
          onClick={prevStep}
          disabled={currentIdx === 0}
          className="gap-1"
        >
          <ChevronLeft className="h-4 w-4" /> Voltar
        </Button>

        {isLastStep ? (
          <Button onClick={complete} className="gap-2 bg-accent hover:bg-accent/90">
            <Check className="h-4 w-4" /> Concluir
          </Button>
        ) : (
          <Button onClick={nextStep} disabled={!canAdvance} className="gap-1">
            Próximo <ChevronRight className="h-4 w-4" />
          </Button>
        )}
      </div>
    </div>
  );
}

// ─── Step 1: Connect WhatsApp ────────────────────────────

function StepConnectWhatsApp({
  connectedSessionId,
  onConnected,
}: {
  connectedSessionId: string | null;
  onConnected: (id: string) => void;
}) {
  const [creatingSession, setCreatingSession] = useState(false);
  const [newSessionId, setNewSessionId] = useState<string | null>(null);
  const [showQR, setShowQR] = useState(false);
  const { data } = useSWR('/wa/sessions');
  const sessions: WaSession[] = data?.sessions || [];
  const connectedSessions = sessions.filter((s) => s.status === 'CONNECTED');

  const handleCreateSession = async () => {
    setCreatingSession(true);
    try {
      const res = await api.post('/wa/sessions', { name: 'Onboarding' });
      setNewSessionId(res.id);
      setShowQR(true);
    } catch {
      // Session creation failed — could show toast here
    } finally {
      setCreatingSession(false);
    }
  };

  // If already have a connected session, let user pick it
  if (connectedSessionId) {
    const session = sessions.find((s) => s.id === connectedSessionId);
    return (
      <div className="flex flex-col items-center gap-6 text-center">
        <div className="flex h-16 w-16 items-center justify-center rounded-full bg-accent/20">
          <Check className="h-8 w-8 text-accent" />
        </div>
        <div>
          <h3 className="text-xl font-bold">WhatsApp Conectado!</h3>
          <p className="mt-1 text-muted-foreground">
            {session?.phoneNumber || session?.name || 'Sessão conectada'}
          </p>
        </div>
      </div>
    );
  }

  const isMobileDevice = typeof window !== 'undefined' && window.innerWidth < 768;

  return (
    <div className="flex flex-col items-center gap-6 text-center">
      <div className="flex h-16 w-16 items-center justify-center rounded-full bg-primary/20">
        <Smartphone className="h-8 w-8 text-primary" />
      </div>
      <div>
        <h3 className="text-xl font-bold">Conecte seu WhatsApp</h3>
        <p className="mt-2 max-w-md text-muted-foreground">
          Vincule um número de WhatsApp para poder disparar mensagens nos seus grupos.
        </p>
      </div>

      {isMobileDevice && (
        <div className="w-full max-w-md rounded-xl border border-yellow-500/30 bg-yellow-500/10 p-4">
          <p className="text-sm font-medium text-yellow-400">📱 Você está no celular</p>
          <p className="mt-1 text-xs text-yellow-400/80">
            Para escanear o QR Code, você vai precisar de outro celular com WhatsApp ou abrir esta página no computador. Toque em "Escanear QR Code" se tiver outro dispositivo disponível.
          </p>
        </div>
      )}

      {connectedSessions.length > 0 ? (
        <div className="w-full space-y-3">
          <p className="text-sm text-muted-foreground">Selecione uma sessão existente:</p>
          {connectedSessions.map((s) => (
            <Card
              key={s.id}
              className="cursor-pointer border-border/50 bg-card/50 transition-colors hover:border-primary/50"
              onClick={() => onConnected(s.id)}
            >
              <CardContent className="flex items-center justify-between p-4">
                <div className="flex items-center gap-3">
                  <Smartphone className="h-5 w-5 text-primary" />
                  <div className="text-left">
                    <p className="text-sm font-medium">{s.name}</p>
                    <p className="text-xs text-muted-foreground">{s.phoneNumber}</p>
                  </div>
                </div>
                <Badge variant="success">CONNECTED</Badge>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        <Button onClick={handleCreateSession} disabled={creatingSession} className="gap-2">
          {creatingSession ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <QrCode className="h-4 w-4" />
          )}
          Escanear QR Code
        </Button>
      )}

      {newSessionId && (
        <QRCodeModal
          isOpen={showQR}
          onClose={() => setShowQR(false)}
          sessionId={newSessionId}
          onConnected={() => {
            setShowQR(false);
            onConnected(newSessionId);
          }}
        />
      )}
    </div>
  );
}

// ─── Step 2: Select Groups ───────────────────────────────

function StepSelectGroups({
  sessionId,
  selectedIds,
  onSelect,
}: {
  sessionId: string;
  selectedIds: string[];
  onSelect: (ids: string[]) => void;
}) {
  const [syncing, setSyncing] = useState(false);
  const { data, mutate } = useSWR(`/groups?sessionId=${sessionId}`);
  const groups: Group[] = data?.data || [];

  const handleSync = async () => {
    setSyncing(true);
    try {
      await api.post('/groups/import', { sessionId });
      await mutate();
    } finally {
      setSyncing(false);
    }
  };

  const toggleGroup = (id: string) => {
    onSelect(
      selectedIds.includes(id) ? selectedIds.filter((g) => g !== id) : [...selectedIds, id]
    );
  };

  const toggleAll = () => {
    onSelect(selectedIds.length === groups.length ? [] : groups.map((g) => g.id));
  };

  return (
    <div className="flex flex-col gap-6">
      <div className="text-center">
        <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-primary/20">
          <Users className="h-8 w-8 text-primary" />
        </div>
        <h3 className="mt-4 text-xl font-bold">Selecione seus Grupos</h3>
        <p className="mt-1 text-muted-foreground">
          Escolha os grupos onde você quer disparar promoções.
        </p>
      </div>

      <div className="flex items-center justify-between">
        <Button variant="outline" size="sm" onClick={handleSync} disabled={syncing} className="gap-2">
          {syncing ? <Loader2 className="h-3 w-3 animate-spin" /> : <RefreshCw className="h-3 w-3" />}
          Sincronizar Grupos
        </Button>
        {groups.length > 0 && (
          <Button variant="ghost" size="sm" onClick={toggleAll}>
            {selectedIds.length === groups.length ? 'Desmarcar todos' : 'Selecionar todos'}
          </Button>
        )}
      </div>

      {groups.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border/50 py-12 text-center text-muted-foreground">
          Nenhum grupo encontrado. Clique em "Sincronizar Grupos" para importar.
        </div>
      ) : (
        <div className="max-h-64 space-y-2 overflow-y-auto">
          {groups.map((g) => {
            const selected = selectedIds.includes(g.id);
            return (
              <Card
                key={g.id}
                className={`cursor-pointer border transition-colors ${
                  selected ? 'border-primary/50 bg-primary/5' : 'border-border/50 bg-card/50'
                }`}
                onClick={() => toggleGroup(g.id)}
              >
                <CardContent className="flex items-center justify-between p-3">
                  <div className="flex items-center gap-3">
                    <div
                      className={`flex h-5 w-5 items-center justify-center rounded border text-xs ${
                        selected ? 'border-primary bg-primary text-white' : 'border-border'
                      }`}
                    >
                      {selected && <Check className="h-3 w-3" />}
                    </div>
                    <div>
                      <p className="text-sm font-medium">{g.name}</p>
                      <p className="text-xs text-muted-foreground">{g.memberCount} membros</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {selectedIds.length > 0 && (
        <p className="text-center text-sm text-accent">
          {selectedIds.length} grupo{selectedIds.length > 1 ? 's' : ''} selecionado{selectedIds.length > 1 ? 's' : ''}
        </p>
      )}
    </div>
  );
}

// ─── Step 3: Create Promo ────────────────────────────────

function StepCreatePromo({
  promoId,
  onCreated,
}: {
  promoId: string | null;
  onCreated: (id: string) => void;
}) {
  const [searchUrl, setSearchUrl] = useState('');
  const [searching, setSearching] = useState(false);
  const [product, setProduct] = useState<Product | null>(null);
  const [generatingCopy, setGeneratingCopy] = useState(false);
  const [copyText, setCopyText] = useState('');

  if (promoId) {
    return (
      <div className="flex flex-col items-center gap-6 text-center">
        <div className="flex h-16 w-16 items-center justify-center rounded-full bg-accent/20">
          <Check className="h-8 w-8 text-accent" />
        </div>
        <div>
          <h3 className="text-xl font-bold">Promo Criada!</h3>
          <p className="mt-1 text-muted-foreground">Sua primeira promoção está pronta para disparo.</p>
        </div>
      </div>
    );
  }

  const handleSearch = async () => {
    if (!searchUrl.trim()) return;
    setSearching(true);
    try {
      const res = await api.post('/promos/search-by-url', { url: searchUrl });
      setProduct(res.product || res);
    } catch {
      // Could show error toast
    } finally {
      setSearching(false);
    }
  };

  const handleGenerateCopy = async () => {
    if (!product) return;
    setGeneratingCopy(true);
    try {
      const res = await api.post('/promos', {
        marketplace: product.marketplace,
        productUrl: product.productUrl,
        affiliateUrl: product.affiliateUrl,
        productName: product.name,
        originalPrice: String(product.originalPrice),
        promoPrice: String(product.promoPrice),
        discountPercent: product.discountPercent,
        imageUrl: product.imageUrl,
      });
      onCreated(res.id);
      setCopyText(res.variations?.[0]?.copyText || '');
    } catch {
      // Error handling
    } finally {
      setGeneratingCopy(false);
    }
  };

  return (
    <div className="flex flex-col gap-6">
      <div className="text-center">
        <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-primary/20">
          <ShoppingBag className="h-8 w-8 text-primary" />
        </div>
        <h3 className="mt-4 text-xl font-bold">Crie sua Primeira Promo</h3>
        <p className="mt-1 text-muted-foreground">
          Cole o link de um produto de afiliado para buscar dados e gerar copy.
        </p>
      </div>

      {/* Search */}
      <div className="flex gap-2">
        <input
          type="url"
          placeholder="https://shopee.com.br/produto..."
          value={searchUrl}
          onChange={(e) => setSearchUrl(e.target.value)}
          className="flex-1 rounded-lg border border-input bg-card px-4 py-2 text-sm text-white placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
        />
        <Button onClick={handleSearch} disabled={searching || !searchUrl.trim()} className="gap-2">
          {searching ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
          Buscar
        </Button>
      </div>

      {/* Product preview */}
      {product && (
        <Card className="border-border/50 bg-card/50">
          <CardContent className="flex gap-4 p-4">
            {product.imageUrl && (
              <img
                src={product.imageUrl}
                alt={product.name}
                className="h-20 w-20 rounded-lg object-cover"
              />
            )}
            <div className="flex-1">
              <p className="text-sm font-medium leading-tight">{product.name}</p>
              <div className="mt-2 flex items-center gap-3">
                <span className="text-xs text-muted-foreground line-through">
                  R$ {Number(product.originalPrice).toFixed(2)}
                </span>
                <span className="font-bold text-accent">
                  R$ {Number(product.promoPrice).toFixed(2)}
                </span>
                <Badge variant="success">-{product.discountPercent}%</Badge>
              </div>
              <Badge className="mt-2" variant="outline">{product.marketplace}</Badge>
            </div>
          </CardContent>
        </Card>
      )}

      {product && !promoId && (
        <Button onClick={handleGenerateCopy} disabled={generatingCopy} className="gap-2">
          {generatingCopy ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Sparkles className="h-4 w-4" />
          )}
          Gerar Copy e Criar Promo
        </Button>
      )}

      {copyText && (
        <div className="rounded-lg border border-border/50 bg-secondary/30 p-4">
          <p className="mb-2 text-xs font-medium text-muted-foreground">Copy gerada:</p>
          <p className="whitespace-pre-wrap text-sm">{copyText}</p>
        </div>
      )}
    </div>
  );
}

// ─── Step 4: Test Dispatch ───────────────────────────────

function StepTestDispatch({
  promoId,
  groupIds,
  sessionId,
}: {
  promoId: string | null;
  groupIds: string[];
  sessionId: string | null;
}) {
  const [dispatching, setDispatching] = useState(false);
  const [dispatched, setDispatched] = useState(false);

  const handleDispatch = async () => {
    if (!promoId || groupIds.length === 0) return;
    setDispatching(true);
    try {
      await api.post('/dispatches', {
        promoId,
        groupIds: groupIds.slice(0, 1), // Only 1 group for test
        channel: 'WHATSAPP',
      });
      setDispatched(true);
    } catch {
      // Error handling
    } finally {
      setDispatching(false);
    }
  };

  if (dispatched) {
    return (
      <div className="flex flex-col items-center gap-6 text-center">
        <div className="flex h-16 w-16 items-center justify-center rounded-full bg-accent/20">
          <Check className="h-8 w-8 text-accent" />
        </div>
        <div>
          <h3 className="text-xl font-bold">Disparo Enviado!</h3>
          <p className="mt-1 text-muted-foreground">
            Sua primeira mensagem foi disparada com sucesso. Você está pronto para usar o Dispara!
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center gap-6 text-center">
      <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-primary/20">
        <Send className="h-8 w-8 text-primary" />
      </div>
      <div>
        <h3 className="text-xl font-bold">Disparo de Teste</h3>
        <p className="mt-1 max-w-md text-muted-foreground">
          Vamos enviar sua promo para o primeiro grupo selecionado como teste.
        </p>
      </div>

      <div className="w-full max-w-sm space-y-3 rounded-xl border border-border/50 bg-card/50 p-4 text-left text-sm">
        <div className="flex items-center justify-between">
          <span className="text-muted-foreground">Sessão</span>
          <span className="font-medium">{sessionId ? '✓ Conectada' : '✗ Sem sessão'}</span>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-muted-foreground">Promo</span>
          <span className="font-medium">{promoId ? '✓ Criada' : '✗ Sem promo'}</span>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-muted-foreground">Grupo destino</span>
          <span className="font-medium">1 de {groupIds.length}</span>
        </div>
      </div>

      <Button
        onClick={handleDispatch}
        disabled={dispatching || !promoId || groupIds.length === 0}
        className="gap-2"
      >
        {dispatching ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : (
          <Send className="h-4 w-4" />
        )}
        Disparar Teste
      </Button>
    </div>
  );
}
