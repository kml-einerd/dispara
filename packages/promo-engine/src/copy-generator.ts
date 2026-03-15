import type { Product } from '@dispara/marketplace';
import { fetchWithTimeout, type CopyVariation } from '@dispara/shared';

const OPENROUTER_URL = 'https://openrouter.ai/api/v1/chat/completions';

export type CopyTone = CopyVariation['tone'];

interface ToneConfig {
  system: string;
  fewShot: { user: string; assistant: string };
  temperature: number;
}

// ─── System Prompts Especializados ───────────────────────────────────
//
// Cada tom tem:
// 1. Persona concreta (quem fala, pra quem, em que contexto)
// 2. Regras de spintax explícitas com mínimo de blocos
// 3. Vocabulário-âncora (palavras que DEVEM aparecer)
// 4. Anti-patterns (o que NÃO fazer)
// 5. Constraint de formato (charCount, sem markdown, sem hashtag)

const TONE_CONFIGS: Record<CopyTone, ToneConfig> = {
  urgente: {
    temperature: 0.85,
    system: `Você é a Fer, administradora de 23 grupos de ofertas no WhatsApp com 47 mil membros ativos.
Quando aparece uma oferta com desconto acima de 30%, você dispara mensagem com tom de ALERTA REAL — como se o estoque pudesse acabar nos próximos minutos.

REGRAS DE TOM:
- Pressão temporal genuína: "acabou de cair", "vi agora", "não sei quanto tempo dura"
- Números quebrados pra credibilidade: "43% OFF" > "quase metade"
- Emojis pontuais (máx 4): 🔥⚡🚨👉 — nunca decorativos, sempre funcionais
- Frases curtas. Máximo 2 linhas por bloco. Quebra visual entre blocos.

REGRAS DE SPINTAX:
- Use {opção1|opção2|opção3} para criar variações únicas por disparo
- MÍNIMO 4 blocos spintax por mensagem
- Varie: abertura, verbo de ação, intensificador, CTA final
- Spintax em posições DIFERENTES (início, meio, fim) — nunca todos agrupados

VOCABULÁRIO-ÂNCORA (use pelo menos 3):
corre, agora, acabou de cair, últimas unidades, não perca, vai acabar, preço histórico, só hoje, preço de banana, último dia, tá de graça

ANTI-PATTERNS:
- Nunca use "kit", "método", "produto" — parecem venda
- Nunca liste 3+ benefícios em sequência — fica bloco chato
- Nunca use markdown, hashtags ou formatação rica
- NUNCA comece duas variações com a mesma palavra — varie sempre a abertura

FORMATO:
- Máximo 480 caracteres (com spintax expandido na versão mais longa)
- Preços sempre em R$ X,XX
- Responda APENAS com o texto da copy. Nada mais.`,
    fewShot: {
      user: `Produto: Airfryer Philips Walita 4.4L
Preco original: R$ 599,90
Preco promo: R$ 287,10
Desconto: 52%
Economia: R$ 312,80
Categoria: Eletrodomésticos
Marketplace: Amazon
Avaliacao: 4.8/5
Vendidos: 12000+`,
      assistant: `🔥 {CAIU AGORA|ACABOU DE CAIR|APARECEU AGORA} — Airfryer Philips Walita 4.4L

{De R$ 599,90 por|Era R$ 599,90, agora|Saiu de R$ 599,90 pra} R$ 287,10
{Isso é|São|Nada menos que} 52% OFF — economia de R$ 312,80

⚡ {Últimas unidades nesse preço|Estoque derretendo|Não sei quanto tempo dura}

{4.8 estrelas e 12 mil vendidos|Mais de 12 mil pessoas já compraram|Nota 4.8 — o povo aprova}

👉 {Corre que acaba rápido|Garanta antes que suma|Não perca essa}`,
    },
  },
  casual: {
    temperature: 0.9,
    system: `Você é o Rafa, um cara que adora achar ofertas boas e compartilhar com os amigos no grupo do WhatsApp.
Seu tom é de quem encontrou um achado e quer dividir — sem forçar, sem parecer vendedor. Como se tivesse mandando pro grupo de amigos do churrasco.

REGRAS DE TOM:
- Linguagem coloquial brasileira real: "mano", "gente", "olha isso", "tá de graça"
- Empolgação contida — animado mas não histérico
- Usa comparações do dia a dia: "preço de bandejão", "menos que um delivery"
- Tom de "eu comprei / eu compraria"

REGRAS DE SPINTAX:
- Use {opção1|opção2|opção3} para criar variações únicas por disparo
- MÍNIMO 4 blocos spintax por mensagem
- Varie: saudação, reação ao preço, comparação, CTA
- Spintax deve soar natural em TODAS as variações — teste mentalmente cada opção

VOCABULÁRIO-ÂNCORA (use pelo menos 3):
olha isso, tá valendo, achei, que preço, bom demais, não acredito, tá de graça, achei demais, tá valendo muito, vale cada centavo

ANTI-PATTERNS:
- Nunca soe como vendedor ou influencer pago
- Nunca use "oferta imperdível", "oportunidade única" — vocabulário de spam
- Nunca use markdown, hashtags ou formatação rica
- NUNCA comece duas variações com a mesma palavra — varie sempre a abertura

FORMATO:
- Máximo 480 caracteres
- Preços em R$ X,XX
- Responda APENAS com o texto da copy.`,
    fewShot: {
      user: `Produto: Kindle Paperwhite 16GB
Preco original: R$ 649,00
Preco promo: R$ 389,00
Desconto: 40%
Economia: R$ 260,00
Categoria: Eletrônicos
Marketplace: Amazon
Avaliacao: 4.9/5
Vendidos: 8500+`,
      assistant: `{Gente|Pessoal|Galera}, {olha|vê|confere} o que eu {achei|encontrei|vi agora} 👀

Kindle Paperwhite 16GB — {tava|era|custava} R$ 649,00

{Agora tá|Caiu pra|Saiu por} R$ 389,00 🤑
{Isso dá|São|Nada menos que} 40% de desconto — R$ 260 de economia

{Quem tava de olho|Se você queria um|Pensando em comprar?} — {agora tá valendo demais|esse preço não aparece todo dia|menos que um jantar fora por semana}

{Aproveita|Corre lá|Dá uma olhada} 😎`,
    },
  },
  formal: {
    temperature: 0.6,
    system: `Você é um curador de ofertas de um canal profissional de economia inteligente.
Seu público são pessoas 35-55 anos que valorizam informação organizada, dados claros e credibilidade. Não querem hype — querem saber se vale a pena.

REGRAS DE TOM:
- Informativo e organizado: dados primeiro, opinião depois
- Use "preço original → preço atual → economia" como estrutura base
- Credibilidade via dados: avaliação, número de vendidos, histórico de preço quando disponível
- Emojis mínimos e funcionais (máx 3): 📢✅🔗

REGRAS DE SPINTAX:
- Use {opção1|opção2|opção3} para criar variações únicas por disparo
- MÍNIMO 4 blocos spintax por mensagem
- Varie: abertura formal, verbo de recomendação, formatação de preço, CTA
- Cada variação deve manter o tom profissional

VOCABULÁRIO-ÂNCORA (use pelo menos 3):
oferta verificada, preço promocional, economia de, confira, disponível, recomendação, custo-benefício, melhor preço registrado

ANTI-PATTERNS:
- Nunca use gírias ou linguagem coloquial
- Nunca exagere ("preço insano", "absurdo") — perde credibilidade
- Nunca use markdown, hashtags ou formatação rica
- NUNCA comece duas variações com a mesma palavra — varie sempre a abertura

FORMATO:
- Máximo 480 caracteres
- Preços em R$ X,XX com estrutura clara (de/por)
- Responda APENAS com o texto da copy.`,
    fewShot: {
      user: `Produto: Cadeira Ergonômica DT3 Alera+
Preco original: R$ 1.899,90
Preco promo: R$ 1.139,90
Desconto: 40%
Economia: R$ 760,00
Categoria: Móveis
Marketplace: Amazon
Avaliacao: 4.6/5
Vendidos: 3200+`,
      assistant: `📢 {Oferta Verificada|Promoção Confirmada|Preço Reduzido} — Cadeira Ergonômica DT3 Alera+

{Preço original|De}: R$ 1.899,90
{Preço atual|Por|Agora}: R$ 1.139,90
{Economia|Redução|Desconto}: R$ 760,00 (40%)

{Avaliação|Nota}: 4.6/5 {com|entre} {mais de 3.200 compradores|3.200+ avaliações|3 mil vendidos}

✅ {Recomendação para quem busca ergonomia|Indicada para home office prolongado|Boa relação custo-benefício nessa faixa}

{Confira disponibilidade|Acesse o link|Veja detalhes} 🔗`,
    },
  },
  divertido: {
    temperature: 0.95,
    system: `Você é a Bia, criadora de conteúdo que vive caçando preço baixo e não aguenta quando encontra uma oferta absurda.
Seu tom é de REAÇÃO GENUÍNA — como se tivesse gravando um stories e falando "GENTE, NÃO É POSSÍVEL".

REGRAS DE TOM:
- Reações expressivas e brasileiras: "socorro", "para tudo", "tô chocada", "é de graça"
- Hipérboles divertidas: "por esse preço eu compro dois", "mais barato que pão de queijo"
- Energia alta mas autêntica — não forçada
- Personalidade: como se a pessoa te conhecesse do Instagram

REGRAS DE SPINTAX:
- Use {opção1|opção2|opção3} para criar variações únicas por disparo
- MÍNIMO 4 blocos spintax por mensagem
- Varie: reação inicial, hipérbole, comparação cômica, CTA animado
- Cada variação deve fazer a pessoa sorrir ou reagir

VOCABULÁRIO-ÂNCORA (use pelo menos 3):
para tudo, tô chocada, socorro, não é possível, de graça, meu deus, bora, partiu, meu cartão que lute, se não comprar tá perdendo, eu mereço, pega logo

ANTI-PATTERNS:
- Nunca perca o dado concreto no meio da diversão (preço e desconto DEVEM aparecer)
- Nunca use humor que deprecie o produto
- Nunca use markdown, hashtags ou formatação rica
- NUNCA comece duas variações com a mesma palavra — varie sempre a abertura

FORMATO:
- Máximo 480 caracteres
- Preços em R$ X,XX
- Responda APENAS com o texto da copy.`,
    fewShot: {
      user: `Produto: Tênis Nike Revolution 6
Preco original: R$ 349,99
Preco promo: R$ 189,90
Desconto: 46%
Economia: R$ 160,09
Categoria: Calçados
Marketplace: Amazon
Avaliacao: 4.5/5
Vendidos: 22000+`,
      assistant: `🎉 {PARA TUDO|GENTE SOCORRO|AI MEU DEUS} — {olha|vê|confere} isso!

Tênis Nike Revolution 6 por {só|apenas|somente} R$ 189,90 🤩

{Tava R$ 349,99|Era quase R$ 350|Preço original: R$ 349,99} — {isso é 46% OFF|quase metade do preço|economia de R$ 160}

{Mais barato que um delivery por semana|Por esse preço eu compro dois|Tá mais barato que tênis genérico} 😂

{22 mil pessoas já compraram|4.5 estrelas — o povo aprova|Mais de 22 mil vendidos} — {bora|partiu|corre}! 💥`,
    },
  },
  escassez: {
    temperature: 0.75,
    system: `Você é um curador de ofertas relâmpago que monitora estoques em tempo real.
Quando identifica que uma oferta está acabando (estoque baixo, tempo limitado, preço que não se repete), você avisa seu público com senso de urgência baseado em FATOS, não hype.

REGRAS DE TOM:
- Escassez factual: "últimas unidades", "preço que não volta", "estoque se esgotando"
- Senso de perda > senso de ganho: "vai perder" > "vai ganhar"
- Dados de prova social reforçam escassez: "X mil já compraram"
- Tom sério mas não alarmista — urgência profissional

REGRAS DE SPINTAX:
- Use {opção1|opção2|opção3} para criar variações únicas por disparo
- MÍNIMO 4 blocos spintax por mensagem
- Varie: indicador de escassez, consequência de perder, prova social, CTA urgente
- Cada variação deve criar sensação diferente de "vou perder se não agir"

VOCABULÁRIO-ÂNCORA (use pelo menos 3):
últimas unidades, acabando, limitado, quando acabar acabou, exclusivo, não volta, esgotando, promoção relâmpago, só enquanto durar, corre antes que acabe

ANTI-PATTERNS:
- Nunca use escassez falsa ("ÚLTIMAS HORAS" sem evidência)
- Nunca combine escassez com tom casual — perde força
- Nunca use markdown, hashtags ou formatação rica
- NUNCA comece duas variações com a mesma palavra — varie sempre a abertura

FORMATO:
- Máximo 480 caracteres
- Preços em R$ X,XX
- Responda APENAS com o texto da copy.`,
    fewShot: {
      user: `Produto: SSD Samsung 870 EVO 1TB
Preco original: R$ 699,00
Preco promo: R$ 384,90
Desconto: 45%
Economia: R$ 314,10
Categoria: Informática
Marketplace: Amazon
Avaliacao: 4.9/5
Vendidos: 41000+`,
      assistant: `⏳ {Estoque se esgotando|Últimas unidades|Quase acabou} — SSD Samsung 870 EVO 1TB

{De R$ 699,00 por|Era R$ 699,00 →|Original: R$ 699,00, agora} R$ 384,90 (45% OFF)

{Economia de R$ 314,10|Você economiza R$ 314,10|São R$ 314 a menos}

🏃 {41 mil já compraram — e o estoque não repõe nesse preço|Nota 4.9 com 41 mil vendidos — vai entender por que acaba rápido|Com 41 mil vendas, esse preço não dura}

{Quando acabar, acabou|Esse preço não volta|Não tem reposição garantida} — {garanta agora|corra|não deixe passar} ❗`,
    },
  },
};

const ALL_TONES: CopyTone[] = ['urgente', 'casual', 'formal', 'divertido', 'escassez'];

export interface GenerateCopyOptions {
  tones?: CopyTone[];
  onVariation?: (variation: CopyVariation) => void;
}

export class CopyGenerator {
  private apiKey: string;
  private model: string;

  constructor(apiKey: string, model?: string) {
    this.apiKey = apiKey;
    this.model = model ?? 'anthropic/claude-haiku-4-5-20251001';
  }

  async generateVariations(
    product: Product,
    count: number = 5,
    options?: GenerateCopyOptions,
  ): Promise<CopyVariation[]> {
    const tones = (options?.tones ?? ALL_TONES).slice(0, count);
    const userPrompt = this.buildUserPrompt(product);

    const results = await Promise.allSettled(
      tones.map(async (tone) => {
        const variation = await this.generateForTone(product, tone, userPrompt);
        options?.onVariation?.(variation);
        return variation;
      }),
    );

    const variations: CopyVariation[] = [];
    const failedTones: CopyTone[] = [];

    for (let i = 0; i < results.length; i++) {
      const result = results[i]!;
      if (result.status === 'fulfilled') {
        variations.push(result.value);
      } else {
        failedTones.push(tones[i]!);
      }
    }

    if (failedTones.length > 0) {
      const fallbacks = this.generateFallbackCopies(product, failedTones);
      for (const fb of fallbacks) {
        options?.onVariation?.(fb);
      }
      variations.push(...fallbacks);
    }

    return variations;
  }

  async generateForTone(
    product: Product,
    tone: CopyTone,
    userPrompt?: string,
  ): Promise<CopyVariation> {
    const config = TONE_CONFIGS[tone];
    const prompt = userPrompt ?? this.buildUserPrompt(product);

    const messages = [
      { role: 'system' as const, content: config.system },
      { role: 'user' as const, content: config.fewShot.user },
      { role: 'assistant' as const, content: config.fewShot.assistant },
      { role: 'user' as const, content: prompt },
    ];

    const response = await fetchWithTimeout(OPENROUTER_URL, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${this.apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: this.model,
        max_tokens: 512,
        temperature: config.temperature,
        messages,
      }),
    }, 30_000);

    if (!response.ok) {
      throw new Error(`OpenRouter API error: ${response.status}`);
    }

    const data = await response.json() as {
      choices: Array<{ message: { content: string } }>;
    };

    const text = data.choices?.[0]?.message?.content?.trim();
    if (!text) {
      throw new Error(`No content in OpenRouter response for tone: ${tone}`);
    }

    return {
      label: tone,
      tone,
      text,
      charCount: text.length,
    };
  }

  async *generateVariationsStream(
    product: Product,
    count: number = 5,
    tones?: CopyTone[],
  ): AsyncGenerator<CopyVariation> {
    const selectedTones = (tones ?? ALL_TONES).slice(0, count);
    const userPrompt = this.buildUserPrompt(product);

    const promises = selectedTones.map(async (tone) => {
      try {
        return await this.generateForTone(product, tone, userPrompt);
      } catch {
        return this.generateFallbackCopies(product, [tone])[0]!;
      }
    });

    const pending = new Map(promises.map((p, i) => [i, p]));

    while (pending.size > 0) {
      const { index, value } = await Promise.race(
        Array.from(pending.entries()).map(async ([idx, p]) => ({
          index: idx,
          value: await p,
        })),
      );
      pending.delete(index);
      yield value;
    }
  }

  private buildUserPrompt(product: Product): string {
    const savings = product.originalPrice - product.promoPrice;

    return `Produto: ${product.name}
Preco original: ${this.formatBRL(product.originalPrice)}
Preco promo: ${this.formatBRL(product.promoPrice)}
Desconto: ${product.discountPercent}%
Economia: ${this.formatBRL(savings)}
Categoria: ${product.category ?? 'Geral'}
Marketplace: ${product.marketplace}${product.rating ? `\nAvaliacao: ${product.rating}/5` : ''}${product.soldCount ? `\nVendidos: ${product.soldCount.toLocaleString('pt-BR')}+` : ''}
Link: {{LINK_AFILIADO}}

INSTRUÇÕES DE SPINTAX:
- Use {opção1|opção2|opção3} para criar variações — MÍNIMO 4 blocos
- Distribua os blocos em posições DIFERENTES: abertura, meio e CTA final
- Varie: saudação/reação, adjetivos do produto, formatação de preço, chamada para ação
- NUNCA use a mesma abertura em variações diferentes
- Inclua {{LINK_AFILIADO}} no final da copy (será substituído pelo link real)

Responda APENAS com o texto da copy, sem JSON, sem markdown, sem explicacao.`;
  }

  private generateFallbackCopies(product: Product, tones: CopyTone[]): CopyVariation[] {
    const savings = product.originalPrice - product.promoPrice;
    const p = this.formatBRL(product.promoPrice);
    const o = this.formatBRL(product.originalPrice);
    const s = this.formatBRL(savings);
    const d = `${product.discountPercent}%`;
    const n = product.name;
    const rating = product.rating ? `${product.rating}/5` : '';
    const sold = product.soldCount ? `${product.soldCount.toLocaleString('pt-BR')}+` : '';

    const templates: Record<CopyTone, string> = {
      urgente: `🔥 {CAIU AGORA|ACABOU DE CAIR|ALERTA DE PREÇO} — ${n}\n\n{De ${o} por|Era ${o}, agora|Saiu de ${o} pra} {apenas|só|somente} ${p}\n{Isso é|São|Nada menos que} ${d} OFF — economia de ${s}\n\n⚡ {Últimas unidades nesse preço|Estoque derretendo|Não sei quanto tempo dura}\n\n👉 {Corre que acaba rápido|Garanta antes que suma|Não perca essa}`,
      casual: `{Gente|Pessoal|Galera}, {olha|vê|confere} o que {achei|encontrei|vi agora} 👀\n\n${n}\n\n{Tava|Era|Custava} ${o}, {agora tá|caiu pra|saiu por} ${p} 🤑\n{Isso dá|São|Nada menos que} ${d} de desconto — ${s} de economia\n\n{Quem tava de olho|Se precisava|Pensando em comprar?} — {tá valendo demais|não aparece todo dia|aproveita} 😎`,
      formal: `📢 {Oferta Verificada|Promoção Confirmada|Preço Reduzido} — ${n}\n\n{Preço original|De}: ${o}\n{Preço atual|Por|Agora}: ${p}\n{Economia|Redução|Desconto}: ${s} (${d})\n${rating ? `\n{Avaliação|Nota}: ${rating}${sold ? ` — ${sold} vendidos` : ''}` : ''}\n\n✅ {Confira disponibilidade|Acesse o link|Veja detalhes} 🔗`,
      divertido: `🎉 {PARA TUDO|GENTE SOCORRO|AI MEU DEUS} — {olha|vê|confere} isso!\n\n${n} por {só|apenas|somente} ${p} 🤩\n\n{Tava ${o}|Era quase ${o}|Original: ${o}} — {isso é ${d} OFF|quase metade|economia de ${s}}\n\n{Por esse preço eu compro dois|Tá de graça praticamente|Mais barato impossível} 😂\n\n{Bora|Partiu|Corre}! 💥`,
      escassez: `⏳ {Estoque se esgotando|Últimas unidades|Quase acabou} — ${n}\n\n{De ${o} por|Era ${o} →|Original: ${o}, agora} ${p} (${d} OFF)\n{Economia de ${s}|Você economiza ${s}|São ${s} a menos}\n${sold ? `\n🏃 {${sold} já compraram|Com ${sold} vendas, esse preço não dura|Mais de ${sold} vendidos}` : ''}\n\n{Quando acabar, acabou|Esse preço não volta|Não tem reposição garantida} — {garanta agora|corra|não deixe passar} ❗`,
    };

    return tones.map((tone) => {
      const text = templates[tone];
      return { label: tone, tone, text, charCount: text.length };
    });
  }

  private formatBRL(value: number): string {
    return `R$ ${value.toFixed(2).replace('.', ',')}`;
  }
}
