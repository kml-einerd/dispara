/**
 * Mock PromoEngine — drop-in replacement for @dispara/promo-engine
 * and @dispara/marketplace until those packages are built.
 *
 * All public methods match the planned real interface so they can be
 * swapped out with a single import change.
 */

export interface ScrapedProduct {
  productName: string;
  productUrl: string;
  originalPrice: number;
  promoPrice: number;
  discountPercent: number;
  imageUrl: string | null;
  marketplace: string;
  affiliateUrl: string;
  category: string | null;
}

export interface GeneratedCopy {
  label: string;
  copyText: string;
}

const LABELS = ['urgente', 'casual', 'formal', 'divertido', 'escassez'] as const;

const EMOJIS_BY_LABEL: Record<string, string[]> = {
  urgente: ['🔥', '⚡', '🚨', '⏰'],
  casual: ['😎', '👀', '🤑', '💰'],
  formal: ['📢', '✅', '💎', '🏷️'],
  divertido: ['🎉', '🥳', '🤩', '💥'],
  escassez: ['⏳', '🏃', '❗', '🔒'],
};

function randomPick<T>(arr: readonly T[]): T {
  return arr[Math.floor(Math.random() * arr.length)]!;
}

function formatBRL(value: number): string {
  return `R$ ${value.toFixed(2).replace('.', ',')}`;
}

function generateCopyText(product: ScrapedProduct, label: string): string {
  const emojis = EMOJIS_BY_LABEL[label] ?? EMOJIS_BY_LABEL.casual!;
  const e1 = randomPick(emojis);
  const e2 = randomPick(emojis);
  const name = product.productName;
  const price = formatBRL(product.promoPrice);
  const discount = `${product.discountPercent}%`;
  const url = product.affiliateUrl;

  const templates: Record<string, string> = {
    urgente: `${e1} CORRE! ${name} por apenas ${price} (-${discount})! Promoção por tempo limitado ${e2}\n\n${url}`,
    casual: `${e1} Olha esse precinho! ${name} saindo por ${price} com ${discount} de desconto ${e2}\n\nAproveita: ${url}`,
    formal: `${e1} Oferta especial: ${name}\nPreço promocional: ${price} (desconto de ${discount})\n\n${e2} Confira: ${url}`,
    divertido: `${e1} Para tudo! ${name} tá custando só ${price}! Isso é ${discount} OFF! Tô chocado ${e2}\n\nBora: ${url}`,
    escassez: `${e1} Últimas unidades! ${name} — ${price}, ${discount} de desconto. Quando acabar, acabou ${e2}\n\n${url}`,
  };

  return templates[label] ?? templates.casual!;
}

/**
 * Simulates scraping a product page.
 */
export async function scrapeProduct(url: string): Promise<ScrapedProduct> {
  // Simulate network delay
  await new Promise((r) => setTimeout(r, 100 + Math.random() * 200));

  const marketplace = detectMarketplace(url);
  const originalPrice = 100 + Math.random() * 900;
  const discountPct = Math.round(10 + Math.random() * 60);
  const promoPrice = originalPrice * (1 - discountPct / 100);

  return {
    productName: `Produto Mock - ${marketplace} #${Math.floor(Math.random() * 10000)}`,
    productUrl: url,
    originalPrice: Math.round(originalPrice * 100) / 100,
    promoPrice: Math.round(promoPrice * 100) / 100,
    discountPercent: discountPct,
    imageUrl: `https://placehold.co/600x600/png?text=${encodeURIComponent(marketplace)}`,
    marketplace,
    affiliateUrl: `${url}?ref=dispara&utm_source=dispara`,
    category: null,
  };
}

/**
 * Simulates searching for a product by keyword.
 */
export async function searchProduct(
  keyword: string,
  marketplace?: string,
): Promise<ScrapedProduct> {
  await new Promise((r) => setTimeout(r, 100 + Math.random() * 200));

  const mp = marketplace || 'SHOPEE';
  const originalPrice = 50 + Math.random() * 500;
  const discountPct = Math.round(15 + Math.random() * 50);
  const promoPrice = originalPrice * (1 - discountPct / 100);
  const baseUrl = `https://www.${mp.toLowerCase()}.com.br/search?q=${encodeURIComponent(keyword)}`;

  return {
    productName: `${keyword.charAt(0).toUpperCase() + keyword.slice(1)} — Top Oferta`,
    productUrl: baseUrl,
    originalPrice: Math.round(originalPrice * 100) / 100,
    promoPrice: Math.round(promoPrice * 100) / 100,
    discountPercent: discountPct,
    imageUrl: `https://placehold.co/600x600/png?text=${encodeURIComponent(keyword)}`,
    marketplace: mp,
    affiliateUrl: `${baseUrl}&ref=dispara`,
    category: null,
  };
}

/**
 * Generates multiple copy variations for a scraped product.
 */
export function generateCopyVariations(
  product: ScrapedProduct,
  count = 3,
): GeneratedCopy[] {
  const labels = [...LABELS];
  // Shuffle
  for (let i = labels.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [labels[i], labels[j]] = [labels[j]!, labels[i]!];
  }

  return labels.slice(0, count).map((label) => ({
    label,
    copyText: generateCopyText(product, label),
  }));
}

function detectMarketplace(url: string): string {
  const lower = url.toLowerCase();
  if (lower.includes('shopee')) return 'SHOPEE';
  if (lower.includes('amazon')) return 'AMAZON';
  if (lower.includes('mercadolivre') || lower.includes('mercadolibre')) return 'MERCADOLIVRE';
  if (lower.includes('magalu') || lower.includes('magazineluiza')) return 'MAGALU';
  if (lower.includes('aliexpress')) return 'ALIEXPRESS';
  return 'SHOPEE';
}
