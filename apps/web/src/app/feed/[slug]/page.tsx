import type { Metadata } from 'next';
import Image from 'next/image';

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/v1';
const APP_URL = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';

interface Promo {
  id: string;
  product_name: string;
  image_url: string | null;
  original_price: number | null;
  promo_price: number | null;
  discount: number | null;
  marketplace: string | null;
  affiliate_url: string | null;
  short_code: string | null;
  position: number;
}

interface FeedData {
  feed: { id: string; name: string; slug: string };
  promos: Promo[];
}

async function getFeed(slug: string): Promise<FeedData | null> {
  try {
    const res = await fetch(`${API_BASE}/feeds/${slug}`, {
      next: { revalidate: 60 },
    });
    if (!res.ok) return null;
    return res.json();
  } catch {
    return null;
  }
}

function formatBRL(value: number | null | undefined): string {
  if (value == null) return '-';
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(value);
}

function getPromoLink(promo: Promo): string {
  if (promo.short_code) {
    return `${APP_URL}/l/${promo.short_code}`;
  }
  return promo.affiliate_url || '#';
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const data = await getFeed(slug);

  if (!data) {
    return { title: 'Feed no encontrado' };
  }

  return {
    title: `${data.feed.name} - Ofertas`,
    description: `Confira ${data.promos.length} ofertas selecionadas em ${data.feed.name}`,
    openGraph: {
      title: `${data.feed.name} - Ofertas`,
      description: `${data.promos.length} ofertas com desconto`,
    },
  };
}

export default async function FeedPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const data = await getFeed(slug);

  if (!data) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-gray-900 mb-2">
            Feed nao encontrado
          </h1>
          <p className="text-gray-500">
            Este feed pode ter sido removido ou o link esta incorreto.
          </p>
        </div>
      </div>
    );
  }

  const { feed, promos } = data;

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b border-gray-200 sticky top-0 z-10">
        <div className="max-w-2xl mx-auto px-4 py-4">
          <h1 className="text-xl font-bold text-gray-900">{feed.name}</h1>
          <p className="text-sm text-gray-500 mt-0.5">
            {promos.length} {promos.length === 1 ? 'oferta' : 'ofertas'}
          </p>
        </div>
      </header>

      {/* Promo list */}
      <main className="max-w-2xl mx-auto px-4 py-6">
        {promos.length === 0 ? (
          <div className="text-center py-16">
            <p className="text-gray-500">Nenhuma oferta neste feed ainda.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {promos.map((promo) => (
              <a
                key={promo.id}
                href={getPromoLink(promo)}
                target="_blank"
                rel="noopener noreferrer"
                className="block bg-white rounded-xl border border-gray-200 p-4 hover:border-indigo-300 hover:shadow-sm transition-all active:scale-[0.98]"
              >
                <div className="flex gap-4">
                  {/* Product image */}
                  <div className="w-20 h-20 rounded-lg bg-gray-100 flex-shrink-0 overflow-hidden">
                    {promo.image_url ? (
                      <img
                        src={promo.image_url}
                        alt={promo.product_name}
                        className="w-full h-full object-cover"
                        loading="lazy"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-gray-300">
                        <svg
                          className="w-8 h-8"
                          fill="none"
                          viewBox="0 0 24 24"
                          strokeWidth={1}
                          stroke="currentColor"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            d="M2.25 15.75l5.159-5.159a2.25 2.25 0 013.182 0l5.159 5.159m-1.5-1.5l1.409-1.409a2.25 2.25 0 013.182 0l2.909 2.909M3.75 21h16.5A2.25 2.25 0 0022.5 18.75V5.25A2.25 2.25 0 0020.25 3H3.75A2.25 2.25 0 001.5 5.25v13.5A2.25 2.25 0 003.75 21z"
                          />
                        </svg>
                      </div>
                    )}
                  </div>

                  {/* Content */}
                  <div className="flex-1 min-w-0">
                    <h2 className="text-sm font-medium text-gray-900 line-clamp-2 leading-snug">
                      {promo.product_name}
                    </h2>

                    {promo.marketplace && (
                      <span className="inline-block mt-1 px-1.5 py-0.5 rounded text-[10px] font-medium bg-gray-100 text-gray-600 uppercase">
                        {promo.marketplace}
                      </span>
                    )}

                    <div className="flex items-center gap-2 mt-2">
                      {promo.promo_price != null && (
                        <span className="text-base font-bold text-gray-900">
                          {formatBRL(promo.promo_price)}
                        </span>
                      )}
                      {promo.original_price != null &&
                        promo.original_price !== promo.promo_price && (
                          <span className="text-xs text-gray-400 line-through">
                            {formatBRL(promo.original_price)}
                          </span>
                        )}
                      {promo.discount != null && promo.discount > 0 && (
                        <span className="px-1.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-700">
                          -{Math.round(promo.discount)}%
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Arrow */}
                  <div className="flex-shrink-0 flex items-center">
                    <svg
                      className="w-5 h-5 text-gray-400"
                      fill="none"
                      viewBox="0 0 24 24"
                      strokeWidth={2}
                      stroke="currentColor"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        d="M8.25 4.5l7.5 7.5-7.5 7.5"
                      />
                    </svg>
                  </div>
                </div>
              </a>
            ))}
          </div>
        )}
      </main>

      {/* Footer */}
      <footer className="max-w-2xl mx-auto px-4 py-8 text-center">
        <p className="text-xs text-gray-400">
          Ofertas selecionadas por afiliados. Precos sujeitos a alteracao.
        </p>
      </footer>
    </div>
  );
}
