'use client';

import { Product } from "@/src/types";
import { Card, CardContent, CardHeader, CardTitle } from "../ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../ui/tabs";
import { Badge } from "../ui/badge";
import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { Check, Sparkles, Smile, RefreshCw, AlertTriangle, Copy, Eye, ChevronDown, ChevronUp, Zap, Minus, Instagram, Smartphone, ImageIcon, Loader2 } from "lucide-react";
import { Switch } from "../ui/switch";
import { Skeleton } from "../ui/skeleton";

// ── Constantes ──────────────────────────────────────────────────────────────

const WHATSAPP_CHAR_LIMIT = 500;
const WHATSAPP_WARN_THRESHOLD = 450;
const SPINTAX_PREVIEW_COUNT = 3;

const PROMO_EMOJIS = [
  { category: 'Urgência', emojis: ['🔥', '⚡', '🚨', '⏰', '💥', '🏃', '⚠️', '❗'] },
  { category: 'Dinheiro', emojis: ['💰', '💸', '🤑', '💵', '🏷️', '💲', '🎯', '✅'] },
  { category: 'Emoção', emojis: ['😍', '🤩', '😱', '🤪', '👀', '🥳', '😎', '🫣'] },
  { category: 'Ação', emojis: ['👉', '👆', '🔗', '📢', '📣', '🛒', '🛍️', '🎁'] },
  { category: 'Destaque', emojis: ['⭐', '✨', '🌟', '💎', '🏆', '👑', '🎉', '🔝'] },
];

const variations = [
  { id: 'urgente', label: '🔥 Urgente', template: '🔥 OFERTA RELÂMPAGO! {name} com {discount}% OFF! Corra antes que acabe!\n\nDe R$ {original} por apenas R$ {promo}\n\nConfira aqui: {url}' },
  { id: 'casual', label: '😎 Casual', template: 'Olha esse achadinho! 😍\n\n{name}\n\nPor apenas R$ {promo} (era R$ {original})\n\nLink do produto: {url}' },
  { id: 'formal', label: '📋 Formal', template: 'Oportunidade de aquisição: {name}.\n\nValor promocional: R$ {promo}\nDesconto aplicado: {discount}%\n\nAcesse o link oficial: {url}' },
  { id: 'divertido', label: '🤪 Divertido', template: 'O estagiário ficou louco! 🤪\n\n{name} tá quase de graça!\n\nSó R$ {promo} 💸\n\nPega logo: {url}' },
  { id: 'escassez', label: '😱 Escassez', template: 'ÚLTIMAS UNIDADES! 😱\n\n{name} com {discount}% de desconto.\n\nPreço final: R$ {promo}\n\nGaranta o seu: {url}' },
];

// ── Spintax Resolver ────────────────────────────────────────────────────────

function resolveSpintax(text: string): string {
  let result = text;
  let depth = 0;
  while (result.includes('{') && result.includes('|') && depth < 10) {
    result = result.replace(/\{([^{}]+)\}/g, (_match, group: string) => {
      const options = group.split('|');
      return options[Math.floor(Math.random() * options.length)];
    });
    depth++;
  }
  return result;
}

function generateSpintaxVariations(text: string, count: number): string[] {
  const seen = new Set<string>();
  const results: string[] = [];
  let attempts = 0;
  while (results.length < count && attempts < count * 5) {
    const resolved = resolveSpintax(text);
    if (!seen.has(resolved)) {
      seen.add(resolved);
      results.push(resolved);
    }
    attempts++;
  }
  return results;
}

function hasSpintax(text: string): boolean {
  return /\{[^{}]*\|[^{}]*\}/.test(text);
}

// ── WhatsApp Preview Component ──────────────────────────────────────────────

function WhatsAppPreview({ text, imageUrl }: { text: string; imageUrl?: string }) {
  const now = new Date();
  const time = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}`;

  return (
    <div className="rounded-xl bg-[#0b141a] p-4">
      {/* Header bar */}
      <div className="mb-3 flex items-center gap-2 border-b border-white/10 pb-2">
        <div className="h-8 w-8 rounded-full bg-[#00a884] flex items-center justify-center text-white text-xs font-bold">P</div>
        <div>
          <div className="text-sm font-medium text-white">Promoções 🔥</div>
          <div className="text-[10px] text-white/50">online</div>
        </div>
      </div>

      {/* Message bubble */}
      <div className="flex justify-end">
        <div className="max-w-[85%] rounded-lg rounded-tr-none bg-[#005c4b] px-3 py-2 shadow-md">
          {imageUrl && (
            <div className="mb-2 overflow-hidden rounded-md">
              <img
                src={imageUrl}
                alt=""
                className="h-40 w-full object-cover"
                onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
              />
            </div>
          )}
          <p className="whitespace-pre-wrap text-[13px] leading-[1.35] text-[#e9edef]">
            {text}
          </p>
          <div className="mt-1 flex items-center justify-end gap-1">
            <span className="text-[10px] text-white/40">{time}</span>
            <Check className="h-3 w-3 text-[#53bdeb]" />
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Emoji Picker Component ──────────────────────────────────────────────────

function EmojiPicker({ onSelect, onClose }: { onSelect: (emoji: string) => void; onClose: () => void }) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose();
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [onClose]);

  return (
    <div ref={ref} className="absolute bottom-full left-0 z-50 mb-2 w-72 rounded-lg border border-border/50 bg-card p-3 shadow-xl">
      {PROMO_EMOJIS.map((cat) => (
        <div key={cat.category} className="mb-2 last:mb-0">
          <div className="mb-1 text-[10px] font-medium uppercase tracking-wider text-muted-foreground">{cat.category}</div>
          <div className="flex flex-wrap gap-1">
            {cat.emojis.map((emoji) => (
              <button
                key={emoji}
                onClick={() => onSelect(emoji)}
                className="rounded p-1 text-lg transition-colors hover:bg-secondary"
              >
                {emoji}
              </button>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

// ── Char Counter ────────────────────────────────────────────────────────────

function CharCounter({ count }: { count: number }) {
  const isOver = count > WHATSAPP_CHAR_LIMIT;
  const isWarn = count > WHATSAPP_WARN_THRESHOLD && !isOver;

  return (
    <div className={`flex items-center gap-1.5 text-xs ${isOver ? 'text-red-400' : isWarn ? 'text-amber-400' : 'text-muted-foreground'}`}>
      {isOver && <AlertTriangle className="h-3 w-3" />}
      <span>{count}/{WHATSAPP_CHAR_LIMIT}</span>
      {isOver && <span className="font-medium">Muito longo para WhatsApp</span>}
      {isWarn && <span>Próximo do limite</span>}
    </div>
  );
}

// ── Image Style Constants ───────────────────────────────────────────────────

const IMAGE_STYLES = [
  { id: 'clean', label: 'Clean', description: 'Minimalista, fundo neutro', icon: Sparkles },
  { id: 'bold', label: 'Bold', description: 'Vibrante, destaque de preço', icon: Zap },
  { id: 'minimal', label: 'Minimal', description: 'Estilo Apple, elegante', icon: Minus },
  { id: 'social', label: 'Social', description: 'Post de rede social', icon: Instagram },
  { id: 'story', label: 'Story', description: 'WhatsApp Status 9:16', icon: Smartphone },
] as const;

type ImageStyle = typeof IMAGE_STYLES[number]['id'];

// ── ImageGenerator Component ────────────────────────────────────────────────

function ImageGenerator({
  promoId,
  product,
  onImageGenerated,
}: {
  promoId: string;
  product: Product;
  onImageGenerated: (url: string) => void;
}) {
  const [selectedStyle, setSelectedStyle] = useState<ImageStyle>('clean');
  const [includeText, setIncludeText] = useState(false);
  const [overlayText, setOverlayText] = useState(`DE R$${product.originalPrice.toFixed(0)} POR R$${product.promoPrice.toFixed(0)}`);
  const [isGenerating, setIsGenerating] = useState(false);
  const [generatedUrl, setGeneratedUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleGenerate = async () => {
    setIsGenerating(true);
    setError(null);
    try {
      const res = await fetch(`/api/v1/promos/${promoId}/generate-image`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          style: selectedStyle,
          overlayText: includeText ? overlayText : undefined,
        }),
      });
      if (!res.ok) throw new Error('Falha ao gerar imagem');
      const data = await res.json() as { imageUrl: string };
      setGeneratedUrl(data.imageUrl);
      onImageGenerated(data.imageUrl);
    } catch {
      setError('Erro ao gerar imagem. Tente novamente.');
    } finally {
      setIsGenerating(false);
    }
  };

  const handleRegenerate = () => {
    setGeneratedUrl(null);
    handleGenerate();
  };

  const handleChangeStyle = () => {
    setGeneratedUrl(null);
  };

  return (
    <div className="space-y-4 rounded-lg border border-border/50 bg-secondary/20 p-4">
      <div className="flex items-center gap-2 text-sm font-medium">
        <ImageIcon className="h-4 w-4 text-violet-400" />
        Imagem Promocional
      </div>

      {/* Generated image preview */}
      {generatedUrl && !isGenerating ? (
        <div className="space-y-3">
          <div className="overflow-hidden rounded-lg border border-border/30">
            <img
              src={generatedUrl}
              alt="Imagem gerada"
              className="w-full object-contain"
            />
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={handleRegenerate}
              className="flex items-center gap-1.5 rounded-md bg-secondary px-3 py-1.5 text-xs font-medium text-foreground transition-colors hover:bg-secondary/80"
            >
              <RefreshCw className="h-3 w-3" />
              Gerar outra
            </button>
            <button
              onClick={handleChangeStyle}
              className="flex items-center gap-1.5 rounded-md bg-secondary px-3 py-1.5 text-xs font-medium text-foreground transition-colors hover:bg-secondary/80"
            >
              <Sparkles className="h-3 w-3" />
              Trocar estilo
            </button>
            <button
              onClick={() => onImageGenerated(generatedUrl)}
              className="flex items-center gap-1.5 rounded-md bg-emerald-600 px-3 py-1.5 text-xs font-medium text-white transition-colors hover:bg-emerald-700"
            >
              <Check className="h-3 w-3" />
              Usar esta
            </button>
          </div>
        </div>
      ) : (
        <>
          {/* Loading skeleton */}
          {isGenerating ? (
            <div className="space-y-2">
              <Skeleton className="h-48 w-full rounded-lg" />
              <div className="flex items-center justify-center gap-2 py-2 text-xs text-muted-foreground">
                <Loader2 className="h-3 w-3 animate-spin" />
                Gerando imagem...
              </div>
            </div>
          ) : (
            <>
              {/* Style selector — 5 cards */}
              <div className="grid grid-cols-5 gap-2">
                {IMAGE_STYLES.map((style) => {
                  const Icon = style.icon;
                  const isSelected = selectedStyle === style.id;
                  return (
                    <button
                      key={style.id}
                      onClick={() => setSelectedStyle(style.id)}
                      className={`flex flex-col items-center gap-1.5 rounded-lg border p-3 text-center transition-all ${
                        isSelected
                          ? 'border-violet-500 bg-violet-500/10 text-violet-300'
                          : 'border-border/30 bg-background/50 text-muted-foreground hover:border-border hover:text-foreground'
                      }`}
                    >
                      <Icon className="h-5 w-5" />
                      <span className="text-[11px] font-medium">{style.label}</span>
                      <span className="hidden text-[9px] leading-tight opacity-70 sm:block">{style.description}</span>
                    </button>
                  );
                })}
              </div>

              {/* Text overlay toggle */}
              <div className="flex items-center justify-between rounded-md bg-background/50 px-3 py-2">
                <label htmlFor="include-text" className="text-xs text-muted-foreground">
                  Incluir texto na imagem
                </label>
                <Switch
                  id="include-text"
                  checked={includeText}
                  onCheckedChange={setIncludeText}
                />
              </div>

              {/* Overlay text input */}
              {includeText && (
                <input
                  type="text"
                  value={overlayText}
                  onChange={(e) => setOverlayText(e.target.value)}
                  placeholder="Ex: DE R$99 POR R$49"
                  className="w-full rounded-md border border-border/50 bg-background px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-violet-500"
                />
              )}

              {/* Error message */}
              {error && (
                <div className="flex items-center gap-1.5 text-xs text-red-400">
                  <AlertTriangle className="h-3 w-3" />
                  {error}
                </div>
              )}

              {/* Generate button */}
              <button
                onClick={handleGenerate}
                className="flex w-full items-center justify-center gap-2 rounded-lg bg-violet-600 px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-violet-700"
              >
                <ImageIcon className="h-4 w-4" />
                Gerar Imagem
              </button>
            </>
          )}
        </>
      )}
    </div>
  );
}

// ── Main Component ──────────────────────────────────────────────────────────

interface PromoEditorProps {
  product: Product;
  promoId?: string;
}

export function PromoEditor({ product, promoId }: PromoEditorProps) {
  const [copies, setCopies] = useState<Record<string, string>>({});
  const [activeTab, setActiveTab] = useState('urgente');
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [showPreview, setShowPreview] = useState(true);
  const [showVariations, setShowVariations] = useState(false);
  const [spintaxPreviews, setSpintaxPreviews] = useState<string[]>([]);
  const [isGenerating, setIsGenerating] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [generatedImageUrl, setGeneratedImageUrl] = useState<string | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const fillTemplate = useCallback((template: string) => {
    return template
      .replace('{name}', product.name)
      .replace('{discount}', product.discountPercent.toString())
      .replace('{original}', product.originalPrice.toFixed(2))
      .replace('{promo}', product.promoPrice.toFixed(2))
      .replace('{url}', product.affiliateUrl);
  }, [product]);

  useEffect(() => {
    const newCopies: Record<string, string> = {};
    variations.forEach(v => {
      newCopies[v.id] = fillTemplate(v.template);
    });
    setCopies(newCopies);
  }, [fillTemplate]);

  const currentCopy = copies[activeTab] || '';
  const charCount = currentCopy.length;
  const currentHasSpintax = useMemo(() => hasSpintax(currentCopy), [currentCopy]);

  useEffect(() => {
    if (currentHasSpintax && showVariations) {
      setSpintaxPreviews(generateSpintaxVariations(currentCopy, SPINTAX_PREVIEW_COUNT));
    }
  }, [currentCopy, currentHasSpintax, showVariations]);

  const insertEmoji = (emoji: string) => {
    const textarea = textareaRef.current;
    if (!textarea) return;
    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const text = currentCopy;
    const newText = text.substring(0, start) + emoji + text.substring(end);
    setCopies({ ...copies, [activeTab]: newText });
    requestAnimationFrame(() => {
      textarea.focus();
      textarea.setSelectionRange(start + emoji.length, start + emoji.length);
    });
  };

  const handleGenerate = async () => {
    if (!promoId) return;
    setIsGenerating(true);
    try {
      const res = await fetch(`/api/v1/promos/${promoId}/generate-copy`, { method: 'POST' });
      if (!res.ok) throw new Error('Falha ao gerar copy');
      const data = await res.json() as Array<{ tone: string; text: string }>;
      const updated = { ...copies };
      data.forEach((item) => {
        if (updated[item.tone] !== undefined) {
          updated[item.tone] = item.text;
        }
      });
      setCopies(updated);
    } catch {
      // Silently fail — user can retry
    } finally {
      setIsGenerating(false);
    }
  };

  const handleCopy = async (text: string, id: string) => {
    await navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const refreshVariations = () => {
    setSpintaxPreviews(generateSpintaxVariations(currentCopy, SPINTAX_PREVIEW_COUNT));
  };

  return (
    <Card className="border-border/50 bg-card/50">
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg">Editor de Promoção</CardTitle>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowPreview(!showPreview)}
              className={`flex items-center gap-1 rounded-md px-2 py-1 text-xs transition-colors ${showPreview ? 'bg-primary/20 text-primary' : 'bg-secondary text-muted-foreground hover:text-foreground'}`}
            >
              <Eye className="h-3 w-3" />
              Preview
            </button>
            {promoId && (
              <button
                onClick={handleGenerate}
                disabled={isGenerating}
                className="flex items-center gap-1 rounded-md bg-primary px-3 py-1 text-xs font-medium text-primary-foreground transition-opacity hover:opacity-90 disabled:opacity-50"
              >
                {isGenerating ? <RefreshCw className="h-3 w-3 animate-spin" /> : <Sparkles className="h-3 w-3" />}
                {isGenerating ? 'Gerando...' : 'Gerar com IA'}
              </button>
            )}
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Product info bar */}
        <div className="flex items-center gap-4 rounded-lg bg-secondary/30 p-3">
          <img src={product.imageUrl} alt="" className="h-16 w-16 rounded-md object-cover" />
          <div className="flex flex-col">
            <span className="line-clamp-1 text-sm font-medium">{product.name}</span>
            <div className="flex items-center gap-2">
              <span className="text-sm font-bold text-emerald-500">R$ {product.promoPrice.toFixed(2)}</span>
              <span className="text-xs text-muted-foreground line-through">R$ {product.originalPrice.toFixed(2)}</span>
              <Badge variant="success" className="h-5 text-[10px]">-{product.discountPercent}%</Badge>
            </div>
          </div>
        </div>

        {/* Tabs */}
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="grid w-full grid-cols-5 bg-muted/50">
            {variations.map(v => (
              <TabsTrigger key={v.id} value={v.id} className="text-[10px] md:text-xs">
                {v.label}
              </TabsTrigger>
            ))}
          </TabsList>

          {variations.map(v => (
            <TabsContent key={v.id} value={v.id} className="mt-4">
              <div className="grid gap-4 lg:grid-cols-2">
                {/* Editor side */}
                <div className="space-y-2">
                  <div className="relative">
                    <textarea
                      ref={v.id === activeTab ? textareaRef : undefined}
                      className="min-h-[200px] w-full rounded-lg border border-border/50 bg-background p-3 pb-8 text-sm focus:outline-none focus:ring-1 focus:ring-primary"
                      value={copies[v.id] || ''}
                      onChange={(e) => setCopies({ ...copies, [v.id]: e.target.value })}
                    />

                    {/* Bottom toolbar */}
                    <div className="absolute bottom-2 left-2 right-2 flex items-center justify-between">
                      <div className="relative flex items-center gap-1">
                        <button
                          onClick={() => setShowEmojiPicker(!showEmojiPicker)}
                          className="rounded p-1 text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
                        >
                          <Smile className="h-4 w-4" />
                        </button>
                        <button
                          onClick={() => handleCopy(copies[v.id] || '', v.id)}
                          className="rounded p-1 text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
                        >
                          {copiedId === v.id ? <Check className="h-4 w-4 text-emerald-500" /> : <Copy className="h-4 w-4" />}
                        </button>
                        {v.id === activeTab && showEmojiPicker && (
                          <EmojiPicker
                            onSelect={(emoji) => { insertEmoji(emoji); setShowEmojiPicker(false); }}
                            onClose={() => setShowEmojiPicker(false)}
                          />
                        )}
                      </div>
                      <CharCounter count={(copies[v.id] || '').length} />
                    </div>
                  </div>

                  {/* Spintax variations */}
                  {currentHasSpintax && v.id === activeTab && (
                    <div className="rounded-lg border border-dashed border-border/50 p-3">
                      <button
                        onClick={() => { setShowVariations(!showVariations); if (!showVariations) refreshVariations(); }}
                        className="flex w-full items-center justify-between text-xs font-medium text-muted-foreground"
                      >
                        <span>Spintax detectado — {SPINTAX_PREVIEW_COUNT} variações</span>
                        {showVariations ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
                      </button>
                      {showVariations && (
                        <div className="mt-2 space-y-2">
                          {spintaxPreviews.map((preview, i) => (
                            <div key={i} className="rounded bg-secondary/30 p-2 text-xs text-muted-foreground">
                              <span className="mr-1 font-mono text-[10px] text-primary">#{i + 1}</span>
                              {preview}
                            </div>
                          ))}
                          <button
                            onClick={refreshVariations}
                            className="flex items-center gap-1 text-[10px] text-primary hover:underline"
                          >
                            <RefreshCw className="h-3 w-3" /> Gerar novas variações
                          </button>
                        </div>
                      )}
                    </div>
                  )}
                </div>

                {/* WhatsApp preview side */}
                {showPreview && (
                  <WhatsAppPreview
                    text={currentHasSpintax ? resolveSpintax(copies[v.id] || '') : (copies[v.id] || '')}
                    imageUrl={generatedImageUrl || product.imageUrl}
                  />
                )}
              </div>
            </TabsContent>
          ))}
        </Tabs>

        {/* Image Generator Section */}
        {promoId && (
          <ImageGenerator
            promoId={promoId}
            product={product}
            onImageGenerated={setGeneratedImageUrl}
          />
        )}
      </CardContent>
    </Card>
  );
}
