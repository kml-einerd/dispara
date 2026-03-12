import type { Product } from '@dispara/marketplace';
import type { CopyVariation } from '@dispara/shared';

const OPENROUTER_URL = 'https://openrouter.ai/api/v1/chat/completions';

export class CopyGenerator {
  private apiKey: string;
  private model: string;

  constructor(apiKey: string, model?: string) {
    this.apiKey = apiKey;
    this.model = model ?? 'anthropic/claude-haiku-4-5-20251001';
  }

  async generateVariations(product: Product, count: number = 3): Promise<CopyVariation[]> {
    const savings = product.originalPrice - product.promoPrice;
    const formattedOriginal = this.formatBRL(product.originalPrice);
    const formattedPromo = this.formatBRL(product.promoPrice);
    const formattedSavings = this.formatBRL(savings);

    const systemPrompt = `Voce e um copywriter especialista em marketing de afiliados brasileiro.
Seu objetivo e criar textos promocionais curtos e persuasivos para WhatsApp e Telegram.

REGRAS:
- Maximo 500 caracteres por variacao
- Portugues brasileiro informal
- Use emojis estrategicamente (fogo, seta, dinheiro, sirene)
- Inclua gatilhos de urgencia (limitado, ultimas unidades, so hoje, corre)
- Destaque o beneficio principal (economia, desconto)
- CTA forte no final (aproveita, corre, garanta ja)
- NAO use hashtags
- NAO invente dados que nao foram fornecidos
- Formate precos em BRL (R$ X,XX)

FORMATO DE RESPOSTA (JSON):
[
  {"label": "urgente", "tone": "urgente", "text": "..."},
  {"label": "casual", "tone": "casual", "text": "..."},
  {"label": "formal", "tone": "formal", "text": "..."}
]`;

    const userPrompt = `Crie ${count} variacoes de copy para este produto:

Produto: ${product.name}
Preco original: ${formattedOriginal}
Preco promo: ${formattedPromo}
Desconto: ${product.discountPercent}%
Economia: ${formattedSavings}
Categoria: ${product.category ?? 'Geral'}
Marketplace: ${product.marketplace}
${product.rating ? `Avaliacao: ${product.rating}/5` : ''}
${product.soldCount ? `Vendidos: ${product.soldCount.toLocaleString('pt-BR')}+` : ''}

Gere exatamente ${count} variacoes com tons diferentes: urgente, casual e formal.
Responda APENAS com o JSON array, sem markdown.`;

    try {
      const parsed = await this.callOpenRouter(systemPrompt, userPrompt);
      return parsed.map(item => ({
        label: item.label,
        text: item.text,
        tone: item.tone as CopyVariation['tone'],
        charCount: item.text.length,
      }));
    } catch {
      // Retry once on failure
      try {
        const retryParsed = await this.callOpenRouter(systemPrompt, userPrompt);
        return retryParsed.map(item => ({
          label: item.label,
          text: item.text,
          tone: item.tone as CopyVariation['tone'],
          charCount: item.text.length,
        }));
      } catch {
        return this.generateFallbackCopies(product);
      }
    }
  }

  private async callOpenRouter(
    systemPrompt: string,
    userPrompt: string,
  ): Promise<Array<{ label: string; tone: string; text: string }>> {
    const response = await fetch(OPENROUTER_URL, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${this.apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: this.model,
        max_tokens: 1024,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt },
        ],
      }),
    });

    if (!response.ok) {
      throw new Error(`OpenRouter API error: ${response.status}`);
    }

    const data = await response.json() as {
      choices: Array<{ message: { content: string } }>;
    };

    const content = data.choices?.[0]?.message?.content;
    if (!content) {
      throw new Error('No content in OpenRouter response');
    }

    return JSON.parse(content);
  }

  private generateFallbackCopies(product: Product): CopyVariation[] {
    const savings = product.originalPrice - product.promoPrice;
    const formattedPromo = this.formatBRL(product.promoPrice);
    const formattedOriginal = this.formatBRL(product.originalPrice);
    const formattedSavings = this.formatBRL(savings);

    const variations: CopyVariation[] = [
      {
        label: 'urgente',
        tone: 'urgente',
        text: `🔥 ALERTA DE PRECO BAIXO! 🔥\n\n${product.name}\n\nDe ${formattedOriginal} por apenas ${formattedPromo}!\n💰 Economia de ${formattedSavings} (${product.discountPercent}% OFF)\n\n⚡ Ultimas unidades com esse preco!\n\n👉 Corre que acaba rapido!`,
        charCount: 0,
      },
      {
        label: 'casual',
        tone: 'casual',
        text: `Gente, olha esse preco! 👀\n\n${product.name}\n\nTava ${formattedOriginal}, agora so ${formattedPromo} 🤑\nIsso e ${product.discountPercent}% de desconto!\n\nQuem precisava, aproveita que ta valendo muito! 🏃‍♂️`,
        charCount: 0,
      },
      {
        label: 'formal',
        tone: 'formal',
        text: `📢 Oferta Especial\n\n${product.name}\n\nPreco original: ${formattedOriginal}\nPreco promocional: ${formattedPromo}\nDesconto: ${product.discountPercent}% | Economia: ${formattedSavings}\n\n✅ Aproveite esta oportunidade antes que o estoque acabe.\n\n🔗 Acesse o link abaixo para garantir o seu.`,
        charCount: 0,
      },
    ];

    return variations.map(v => ({
      ...v,
      charCount: v.text.length,
    }));
  }

  private formatBRL(value: number): string {
    return `R$ ${value.toFixed(2).replace('.', ',')}`;
  }
}
