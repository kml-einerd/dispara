import pino from 'pino';
import { fetchWithTimeout } from '@dispara/shared';
import type { AgentConfig, Intent, RAGResult } from './types.js';

const logger = pino({ name: 'conversational-responder' });

const OPENROUTER_URL = 'https://openrouter.ai/api/v1/chat/completions';

const BASE_SYSTEM_PROMPT = `Voce e um assistente de promocoes em um grupo de compras.
Responda de forma natural e casual, como se fosse um participante do grupo.
Sempre inclua o link de afiliado de forma natural na resposta.
Mantenha a resposta curta e objetiva (maximo 3-4 linhas).
Nunca diga que e um bot ou assistente.
Responda em portugues brasileiro informal.`;

const INTENT_PROMPTS: Record<Intent, string> = {
  busca_produto: `O usuario quer encontrar um produto. Sua resposta deve:
1. Apresentar o produto com nome, preco atual e desconto (se houver)
2. Incluir o link de afiliado INLINE no texto (nao no final isolado)
3. Usar tom de quem achou uma oferta boa e quer compartilhar
4. Se houver mais de 1 produto, compare brevemente (preco, marketplace)
Formato: "Achei esse [nome] por R$XX,XX [link] — tava R$YY antes, desconto de Z%"`,

  gerar_copy: `O usuario quer copy pronta pra divulgar em grupo de WhatsApp. Sua resposta deve:
1. Gerar copy curta (3-5 linhas) com emojis estrategicos (🔥💰⚡)
2. Abrir com gancho de urgencia ou escassez ("Corre!", "Acabando!", "Menor preco do ano!")
3. Incluir preco + desconto + link de afiliado DENTRO do texto
4. Fechar com CTA direto ("Garanta o seu", "Link na bio", "Corre antes que acabe")
5. NÃO usar hashtags. NÃO usar "clique aqui". Parecer mensagem de amigo, nao anuncio.
Formato de grupo de promos no WhatsApp — informal, direto, com urgencia.`,

  disparar: `O usuario quer disparar mensagens para grupos. Responda com instruções PASSO A PASSO:
1. Criar promo na aba Promos (buscar produto → gerar copy)
2. Ir em Disparos → Novo Disparo
3. Selecionar grupos destino
4. Agendar horário (janela segura: 9-12h ou 14-18h)
5. Confirmar envio
Seja direto, sem floreios.`,

  status: `O usuario pergunta sobre status. Responda direcionando para o dashboard:
- Disparos: aba Disparos mostra fila, enviados, falhas
- WhatsApp: aba WhatsApp mostra sessões ativas e health
- Métricas: dashboard tem cards com totais e gráfico de 7 dias
Não invente números — direcione para onde ver.`,

  ajuda: `O usuario precisa de ajuda. Responda com o menu de capacidades:
🔍 Buscar produtos — digite nome, marca ou categoria
✍️ Gerar copy — peça copy de um produto e receba 5 variações
📨 Disparar — envie promos para seus grupos WhatsApp
📊 Status — acompanhe métricas pelo dashboard
🔗 Conectar marketplace — Settings → Shopee/ML
Pergunte "o que voce quer fazer?" no final.`,

  off_topic: `Mensagem fora de contexto. Responda com 1 frase casual e redirecione:
"Haha, boa! Mas bora falar de promo — quer buscar algum produto ou gerar uma copy?"
Nunca ignore a mensagem, sempre responda com simpatia antes de redirecionar.`,
};

const NO_PRODUCTS_RESPONSE = 'Hmm, nao encontrei nada sobre isso no momento 😅 Tenta com outro nome ou marca que eu busco de novo!';

const NON_RAG_RESPONSES: Partial<Record<Intent, string>> = {
  disparar: '📨 Pra disparar:\n1. Crie uma promo na aba Promos\n2. Vá em Disparos → Novo Disparo\n3. Escolha os grupos\n4. Agende (janela segura: 9-12h ou 14-18h)\n5. Confirme!\n\nPrimeiro disparo? Comece com 1-2 grupos pra testar 😉',
  status: '📊 Pra ver status de tudo:\n• Disparos → fila e histórico\n• WhatsApp → sessões ativas\n• Dashboard → métricas gerais\n\nAcessa o painel e me diz se precisa de algo!',
  ajuda: '👋 Posso te ajudar com:\n\n🔍 *Buscar produtos* — digita nome, marca ou categoria\n✍️ *Gerar copy* — peça copy e receba variações prontas\n📨 *Disparar* — envie promos pros grupos\n📊 *Status* — acompanhe pelo dashboard\n🔗 *Marketplaces* — conecte Shopee/ML em Settings\n\nO que voce quer fazer?',
  off_topic: 'Haha, boa! 😄 Mas bora pro que interessa — quer buscar algum produto ou gerar uma copy pra divulgar?',
};

export class ConversationalResponder {
  private apiKey: string;
  private model: string;

  constructor(apiKey?: string, model?: string) {
    this.apiKey = apiKey ?? process.env['OPENROUTER_API_KEY'] ?? '';
    this.model = model ?? 'anthropic/claude-sonnet-4-6';
  }

  async generateResponse(
    config: AgentConfig,
    products: RAGResult[],
    originalMessage: string,
    intent: Intent,
  ): Promise<string> {
    // For non-RAG intents without products, use static responses (cheaper, faster)
    if (products.length === 0 && NON_RAG_RESPONSES[intent]) {
      logger.info({ tenantId: config.tenantId, intent }, 'Using static response for non-RAG intent');
      return NON_RAG_RESPONSES[intent]!;
    }

    // For busca_produto/gerar_copy with no products
    if (products.length === 0 && (intent === 'busca_produto' || intent === 'gerar_copy')) {
      logger.info({ tenantId: config.tenantId, intent }, 'No products found, returning fallback');
      return NO_PRODUCTS_RESPONSE;
    }

    const systemPrompt = this.buildSystemPrompt(config, products, intent);

    try {
      const res = await fetchWithTimeout(OPENROUTER_URL, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: this.model,
          max_tokens: 400,
          temperature: intent === 'gerar_copy' ? 0.85 : 0.7,
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: originalMessage },
          ],
        }),
      }, 30_000);
      const response = res as unknown as { ok: boolean; status: number; text: () => Promise<string>; json: () => Promise<unknown> };

      if (!response.ok) {
        const errorBody = await response.text();
        logger.error({ status: response.status, body: errorBody }, 'OpenRouter API error');
        return NO_PRODUCTS_RESPONSE;
      }

      const data = await response.json() as {
        choices: Array<{ message: { content: string } }>;
      };

      const content = data.choices?.[0]?.message?.content;
      if (!content) {
        logger.warn({ tenantId: config.tenantId }, 'No content in responder output');
        return NO_PRODUCTS_RESPONSE;
      }

      const trimmed = content.trim();

      // Post-processing: ensure affiliate link is present in response
      return this.ensureAffiliateLink(trimmed, products, intent);
    } catch (err) {
      logger.error({ err, tenantId: config.tenantId }, 'Error generating response');
      return NO_PRODUCTS_RESPONSE;
    }
  }

  /**
   * Fallback: if the LLM response doesn't contain any affiliate URL from the products,
   * append the top product link naturally at the end.
   * Only applies to intents that should have links (busca_produto, gerar_copy).
   */
  private ensureAffiliateLink(response: string, products: RAGResult[], intent: Intent): string {
    const LINK_INTENTS: Intent[] = ['busca_produto', 'gerar_copy'];
    if (!LINK_INTENTS.includes(intent) || products.length === 0) {
      return response;
    }

    // Check if any affiliate URL from products is already in the response
    const hasLink = products.some((r) => response.includes(r.product.affiliateUrl));
    if (hasLink) {
      return response;
    }

    // Append the top product's link
    const top = products[0]!.product;
    logger.info({ intent, productId: top.id }, 'Injecting affiliate link post-LLM');
    return `${response}\n\n🔗 ${top.affiliateUrl}`;
  }

  private buildSystemPrompt(config: AgentConfig, products: RAGResult[], intent: Intent): string {
    const tenantInstructions = config.systemPrompt
      ? `\n\nInstrucoes do tenant:\n${config.systemPrompt}`
      : '';

    const intentGuide = INTENT_PROMPTS[intent] ?? '';

    const productContext = products.length > 0
      ? products
          .map((r, i) => {
            const p = r.product;
            const discount = p.originalPrice
              ? ` (era R$${p.originalPrice.toFixed(2)}, ${Math.round((1 - p.price / p.originalPrice) * 100)}% off)`
              : '';
            return `Produto ${i + 1}: ${p.name} — R$${p.price.toFixed(2)}${discount} [${p.marketplace}]\nLink: ${p.affiliateUrl}`;
          })
          .join('\n\n')
      : '';

    let prompt = `${BASE_SYSTEM_PROMPT}${tenantInstructions}\n\n${intentGuide}`;

    if (productContext) {
      prompt += `\n\nProdutos disponíveis:\n${productContext}\n\nREGRA: Você DEVE incluir pelo menos 1 link de afiliado (URL completa) na sua resposta. Se mencionar 2+ produtos, inclua o link de cada um.`;
    }

    return prompt;
  }
}
