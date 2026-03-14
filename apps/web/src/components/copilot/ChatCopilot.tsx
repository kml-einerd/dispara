'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { Send, Loader2, Sparkles, AlertCircle, RefreshCw, Link2 } from 'lucide-react';
import { Button } from '../ui/button';
import { Product } from '@/src/types';
import { api } from '@/src/lib/api';
import { ChatProductCard } from './ChatProductCard';
import { ChatPromoReady } from './ChatPromoReady';
import { ChatDispatchConfirm } from './ChatDispatchConfirm';
import { ChatImageGenerator } from './ChatImageGenerator';

// ── tipos de mensagem / UI ──────────────────────────────────────────────────

type MessageRole = 'user' | 'assistant';

interface TextContent { type: 'text'; text: string }
interface ProductsContent { type: 'products'; products: Product[] }
interface PromoContent { type: 'promo'; product: Product; variations: Record<string, string> }
interface ImageGenContent { type: 'image-gen'; product: Product; promoText: string }
interface DispatchContent { type: 'dispatch'; product: Product; variation: string }
interface LoadingContent { type: 'loading'; text: string }
interface ErrorContent { type: 'error'; text: string; retryAction?: () => void }

type MessageContent = TextContent | ProductsContent | PromoContent | ImageGenContent | DispatchContent | LoadingContent | ErrorContent;

interface Message {
  id: string;
  role: MessageRole;
  content: MessageContent;
}

interface InteractResponse {
  intent: string;
  confidence: number;
  products: Array<Product & {
    variations?: Array<{ id: string; label: string; copyText: string; isDefault: boolean }>;
  }>;
  response: string;
  promoReady: boolean;
}

// ── helpers ─────────────────────────────────────────────────────────────────

const URL_REGEX = /https?:\/\/(www\.)?(shopee\.com\.br|mercadolivre\.com\.br|amazon\.com\.br|magazineluiza\.com\.br|aliexpress\.com)[^\s]*/i;

function isMarketplaceUrl(text: string): boolean {
  return URL_REGEX.test(text);
}

function getLoadingTextForInput(value: string): string {
  if (isMarketplaceUrl(value)) return 'Extraindo produto do link...';
  return 'Buscando produtos...';
}

function buildVariationsFromBackend(
  product: Product & { variations?: Array<{ label: string; copyText: string }> },
): Record<string, string> {
  if (product.variations && product.variations.length > 0) {
    const map: Record<string, string> = {};
    for (const v of product.variations) {
      map[v.label] = v.copyText;
    }
    return map;
  }
  const n = product.name;
  const d = product.discountPercent;
  const p = `R$ ${product.promoPrice.toFixed(2)}`;
  const o = `R$ ${product.originalPrice.toFixed(2)}`;
  const url = product.affiliateUrl;
  return {
    urgente: `\u{1F525} CORRE! ${n} com ${d}% OFF!\n\nDe ${o} por apenas ${p}!\nPromocao por tempo limitado \u26A1\n\n\u{1F449} ${url}`,
    casual: `Olha esse achadinho \u{1F60D}\n\n${n}\n\nSo ${p} (era ${o})\n\n${url}`,
    formal: `\u{1F4E2} Oferta especial:\n\n${n}\nValor: ${p} | Desconto: ${d}%\n\n${url}`,
  };
}

// ── componente principal ────────────────────────────────────────────────────

export function ChatCopilot() {
  const [messages, setMessages] = useState<Message[]>([
    {
      id: 'welcome',
      role: 'assistant',
      content: {
        type: 'text',
        text: 'Ola! Sou o copiloto do Dispara \u{1F680}\n\nMe diga o que quer divulgar:\n\u2022 Digite o nome do produto (ex: "tenis nike")\n\u2022 Cole um link do Shopee ou Mercado Livre\n\u2022 Envie uma foto do produto \u{1F4F8}',
      },
    },
  ]);

  const [input, setInput] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [lastProducts, setLastProducts] = useState<InteractResponse['products']>([]);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const addMessage = useCallback((msg: Omit<Message, 'id'>) => {
    setMessages(prev => [...prev, { ...msg, id: crypto.randomUUID() }]);
  }, []);

  const replaceLastAssistant = useCallback((content: MessageContent) => {
    setMessages(prev => {
      const copy = [...prev];
      for (let i = copy.length - 1; i >= 0; i--) {
        if (copy[i]!.role === 'assistant') {
          copy[i] = { ...copy[i]!, content };
          return copy;
        }
      }
      return copy;
    });
  }, []);

  // ── handleSend: texto ou link ───────────────────────────────────────────

  const handleSend = useCallback(async (text?: string) => {
    const value = (text ?? input).trim();
    if (!value || isTyping) return;
    setInput('');

    const isLink = isMarketplaceUrl(value);
    addMessage({ role: 'user', content: { type: 'text', text: isLink ? `\u{1F517} ${value}` : value } });
    setIsTyping(true);
    addMessage({ role: 'assistant', content: { type: 'loading', text: getLoadingTextForInput(value) } });

    const doRequest = async () => {
      const data: InteractResponse = await api.post('/agent/interact', {
        message: value,
        context: selectedProduct ? { selectedProductId: selectedProduct.id } : undefined,
      });

      setLastProducts(data.products);

      // Intent routing: gerar_copy → PromoReady direto (se tem produto selecionado)
      if (data.intent === 'gerar_copy' && selectedProduct) {
        const variations: Record<string, string> = { gerado: data.response };
        replaceLastAssistant({ type: 'promo', product: selectedProduct, variations });
        return;
      }

      // Intent routing: gerar_copy com produtos retornados → PromoReady do primeiro
      if (data.intent === 'gerar_copy' && data.products.length > 0) {
        const product = data.products[0]!;
        const withVariations = data.products[0]!;
        const variations = buildVariationsFromBackend(withVariations);
        // Se backend gerou copy na response, adiciona como variação extra
        if (data.response && !data.response.includes('nao encontrei')) {
          variations.gerado = data.response;
        }
        setSelectedProduct(product);
        replaceLastAssistant({ type: 'promo', product, variations });
        addMessage({ role: 'assistant', content: { type: 'text', text: 'Escolha o tom do anuncio e edite se quiser. Quando pronto, clique em **Disparar** \u{1F680}' } });
        return;
      }

      // busca_produto ou qualquer intent com produtos
      if (data.products.length > 0) {
        replaceLastAssistant({ type: 'products', products: data.products });
        addMessage({ role: 'assistant', content: { type: 'text', text: data.response } });
        return;
      }

      // Sem produtos — mostra resposta textual
      replaceLastAssistant({ type: 'text', text: data.response });
    };

    try {
      await doRequest();
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Erro ao conectar com o servidor';
      replaceLastAssistant({
        type: 'error',
        text: msg,
        retryAction: () => {
          replaceLastAssistant({ type: 'loading', text: 'Tentando novamente...' });
          doRequest()
            .catch(retryErr => {
              const retryMsg = retryErr instanceof Error ? retryErr.message : 'Falha na segunda tentativa';
              replaceLastAssistant({ type: 'error', text: retryMsg });
            })
            .finally(() => setIsTyping(false));
        },
      });
    }

    setIsTyping(false);
  }, [input, isTyping, addMessage, replaceLastAssistant, selectedProduct]);

  // ── handleProductSelect: selecionar produto → gerar variações ───────────

  const handleProductSelect = useCallback(async (product: Product) => {
    setSelectedProduct(product);
    setIsTyping(true);
    addMessage({ role: 'user', content: { type: 'text', text: `Selecionei: ${product.name}` } });
    addMessage({ role: 'assistant', content: { type: 'loading', text: 'Gerando anuncios com IA...' } });

    try {
      // Tenta gerar copy via backend
      const data: InteractResponse = await api.post('/agent/interact', {
        message: `gerar copy para ${product.name}`,
        context: { selectedProductId: product.id },
      });

      // Usa variações do backend se disponíveis, senão gera localmente
      const withVariations = lastProducts.find(p => p.id === product.id);
      const variations = buildVariationsFromBackend(withVariations ?? product);

      // Adiciona copy gerada pelo AI como variação extra
      if (data.response && !data.response.includes('nao encontrei')) {
        variations.gerado = data.response;
      }

      replaceLastAssistant({ type: 'promo', product, variations });
      addMessage({ role: 'assistant', content: { type: 'text', text: 'Escolha o tom do anuncio e edite se quiser. Quando pronto, clique em **Disparar** \u{1F680}' } });
    } catch {
      // Fallback: gera variações localmente se backend falhar
      const withVariations = lastProducts.find(p => p.id === product.id);
      const variations = buildVariationsFromBackend(withVariations ?? product);
      replaceLastAssistant({ type: 'promo', product, variations });
      addMessage({ role: 'assistant', content: { type: 'text', text: 'Escolha o tom do anuncio e edite se quiser. Quando pronto, clique em **Disparar** \u{1F680}' } });
    }

    setIsTyping(false);
  }, [addMessage, replaceLastAssistant, lastProducts]);

  // ── handleDispatch ────────────────────────────────────────────────────────

  const handleDispatch = useCallback(async (variation: string) => {
    if (!selectedProduct) return;
    setIsTyping(true);
    addMessage({ role: 'user', content: { type: 'text', text: 'Quero disparar para os grupos!' } });
    addMessage({ role: 'assistant', content: { type: 'loading', text: 'Carregando seus grupos...' } });
    replaceLastAssistant({ type: 'dispatch', product: selectedProduct, variation });
    setIsTyping(false);
  }, [selectedProduct, addMessage, replaceLastAssistant]);

  // ── handleGenerateImage: abrir gerador de imagem para promo ──────────────

  const handleGenerateImage = useCallback((promoText: string) => {
    if (!selectedProduct) return;
    addMessage({ role: 'user', content: { type: 'text', text: 'Quero gerar uma imagem para essa promo!' } });
    addMessage({ role: 'assistant', content: { type: 'image-gen', product: selectedProduct, promoText } });
  }, [selectedProduct, addMessage]);

  // ── handleImageReady: imagem gerada, anexar à promo ─────────────────────

  const handleImageReady = useCallback((imageUrl: string) => {
    addMessage({
      role: 'assistant',
      content: { type: 'text', text: `Imagem gerada com sucesso! Ela sera anexada ao disparo automaticamente.` },
    });
    // Store image URL for dispatch — future: pass to ChatDispatchConfirm
    setMessages(prev => {
      const copy = [...prev];
      // Find the last dispatch content and attach image, or just note it
      return copy;
    });
  }, [addMessage]);


  // ── handlePaste: detectar URL colada ──────────────────────────────────────

  const handlePaste = useCallback((e: React.ClipboardEvent) => {
    const pasted = e.clipboardData.getData('text');
    if (isMarketplaceUrl(pasted) && !input.trim()) {
      e.preventDefault();
      handleSend(pasted);
    }
  }, [input, handleSend]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <div className="flex h-full flex-col">
      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-4 py-6 space-y-4">
        {messages.map((msg) => (
          <ChatMessage
            key={msg.id}
            message={msg}
            onProductSelect={handleProductSelect}
            onDispatch={handleDispatch}
            onGenerateImage={handleGenerateImage}
            onImageReady={handleImageReady}
          />
        ))}
        <div ref={bottomRef} />
      </div>

      {/* Quick suggestions */}
      {messages.length <= 1 && (
        <div className="px-4 pb-3 flex flex-wrap gap-2">
          {['tenis nike', 'fone bluetooth', 'smartwatch'].map(s => (
            <button
              key={s}
              onClick={() => handleSend(s)}
              className="rounded-full border border-border/60 bg-secondary/50 px-3 py-1 text-xs text-muted-foreground hover:border-primary hover:text-primary transition-colors"
            >
              {s}
            </button>
          ))}
          <button
            onClick={() => {
              const url = prompt('Cole o link do produto:');
              if (url) handleSend(url);
            }}
            className="rounded-full border border-border/60 bg-secondary/50 px-3 py-1 text-xs text-muted-foreground hover:border-primary hover:text-primary transition-colors flex items-center gap-1"
          >
            <Link2 className="h-3 w-3" />
            Colar link
          </button>
        </div>
      )}

      {/* Input bar */}
      <div className="border-t border-border/50 bg-card/80 px-4 py-3 backdrop-blur">
        <div className="flex items-end gap-2 rounded-xl border border-border/60 bg-background/50 px-3 py-2 focus-within:border-primary/60 transition-colors">
          <textarea
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            onPaste={handlePaste}
            placeholder="Digite o produto, cole um link ou envie uma foto..."
            rows={1}
            className="flex-1 resize-none bg-transparent text-sm outline-none placeholder:text-muted-foreground/60 max-h-32 min-h-[24px]"
            style={{ height: 'auto' }}
            onInput={e => {
              const t = e.target as HTMLTextAreaElement;
              t.style.height = 'auto';
              t.style.height = Math.min(t.scrollHeight, 128) + 'px';
            }}
          />
          <div className="flex items-center gap-1 pb-0.5">
            <Button
              size="sm"
              onClick={() => handleSend()}
              disabled={!input.trim() || isTyping}
              className="h-8 w-8 p-0 rounded-lg"
            >
              {isTyping ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
            </Button>
          </div>
        </div>
        <p className="mt-1.5 text-center text-[10px] text-muted-foreground/50">
          Enter para enviar · Shift+Enter para nova linha
        </p>
      </div>
    </div>
  );
}

// ── renderiza cada mensagem ─────────────────────────────────────────────────

function ChatMessage({
  message,
  onProductSelect,
  onDispatch,
  onGenerateImage,
  onImageReady,
}: {
  message: Message;
  onProductSelect: (p: Product) => void;
  onDispatch: (variation: string) => void;
  onGenerateImage: (promoText: string) => void;
  onImageReady: (imageUrl: string) => void;
}) {
  const isUser = message.role === 'user';
  const { content } = message;

  if (content.type === 'loading') {
    return (
      <div className="flex items-start gap-3">
        <BotAvatar />
        <div className="flex items-center gap-2 rounded-2xl rounded-tl-sm bg-secondary/60 px-4 py-3 text-sm text-muted-foreground">
          <Loader2 className="h-3.5 w-3.5 animate-spin" />
          {content.text}
        </div>
      </div>
    );
  }

  if (content.type === 'error') {
    return (
      <div className="flex items-start gap-3">
        <BotAvatar />
        <div className="flex flex-col gap-2 rounded-2xl rounded-tl-sm border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm">
          <div className="flex items-center gap-2 text-destructive">
            <AlertCircle className="h-3.5 w-3.5 shrink-0" />
            {content.text}
          </div>
          {content.retryAction && (
            <button
              onClick={content.retryAction}
              className="flex items-center gap-1.5 self-start rounded-lg bg-secondary/60 px-3 py-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
            >
              <RefreshCw className="h-3 w-3" />
              Tentar novamente
            </button>
          )}
        </div>
      </div>
    );
  }

  if (isUser) {
    return (
      <div className="flex justify-end">
        <div className="max-w-[80%] rounded-2xl rounded-tr-sm bg-primary px-4 py-2.5 text-sm text-primary-foreground">
          {content.type === 'text' && content.text}
        </div>
      </div>
    );
  }

  if (content.type === 'text') {
    return (
      <div className="flex items-start gap-3">
        <BotAvatar />
        <div className="max-w-[85%] rounded-2xl rounded-tl-sm bg-secondary/60 px-4 py-3 text-sm leading-relaxed whitespace-pre-line">
          <StreamingText text={content.text} />
        </div>
      </div>
    );
  }

  if (content.type === 'products') {
    return (
      <div className="flex items-start gap-3">
        <BotAvatar />
        <div className="flex-1 min-w-0">
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            {content.products.map(p => (
              <ChatProductCard key={p.id} product={p} onSelect={onProductSelect} />
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (content.type === 'promo') {
    return (
      <div className="flex items-start gap-3">
        <BotAvatar />
        <div className="flex-1 min-w-0">
          <ChatPromoReady product={content.product} variations={content.variations} onDispatch={onDispatch} onGenerateImage={onGenerateImage} />
        </div>
      </div>
    );
  }

  if (content.type === 'image-gen') {
    return (
      <div className="flex items-start gap-3">
        <BotAvatar />
        <div className="flex-1 min-w-0">
          <ChatImageGenerator product={content.product} promoText={content.promoText} onImageReady={onImageReady} />
        </div>
      </div>
    );
  }

  if (content.type === 'dispatch') {
    return (
      <div className="flex items-start gap-3">
        <BotAvatar />
        <div className="flex-1 min-w-0">
          <ChatDispatchConfirm product={content.product} variation={content.variation} />
        </div>
      </div>
    );
  }

  return null;
}

function StreamingText({ text }: { text: string }) {
  const [displayed, setDisplayed] = useState('');
  const [done, setDone] = useState(false);

  useEffect(() => {
    if (text.length <= 20) {
      setDisplayed(text);
      setDone(true);
      return;
    }
    let i = 0;
    const chunkSize = Math.max(1, Math.floor(text.length / 30)); // ~30 steps
    const interval = setInterval(() => {
      i = Math.min(i + chunkSize, text.length);
      setDisplayed(text.slice(0, i));
      if (i >= text.length) {
        setDone(true);
        clearInterval(interval);
      }
    }, 25);
    return () => clearInterval(interval);
  }, [text]);

  return <>{displayed}{!done && <span className="animate-pulse">|</span>}</>;
}

function BotAvatar() {
  return (
    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary/20 ring-1 ring-primary/30">
      <Sparkles className="h-4 w-4 text-primary" />
    </div>
  );
}
