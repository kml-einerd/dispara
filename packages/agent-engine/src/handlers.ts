import pino from 'pino';

const logger = pino({ name: 'agent-handlers' });

// ─── Dependency injection types ───────────────────────────────────────────────

export interface PromoSummary {
  id: string;
  name: string;
  productName: string;
  createdAt: Date;
}

export interface GroupSummary {
  id: string;
  name: string;
  platform: 'whatsapp' | 'telegram';
}

export interface DispatchRecord {
  id: string;
  promoId: string;
  groupCount: number;
  status: string;
}

export interface DispatchStatus {
  id: string;
  status: 'pending' | 'running' | 'completed' | 'failed' | 'cancelled';
  totalCount: number;
  sentCount: number;
  failedCount: number;
  createdAt: Date;
  promoName: string;
}

export interface DispatchDeps {
  getLatestPromo: (tenantId: string) => Promise<PromoSummary | null>;
  getActiveGroups: (tenantId: string) => Promise<GroupSummary[]>;
  createDispatch: (tenantId: string, promoId: string, groupIds: string[]) => Promise<DispatchRecord>;
}

export interface StatusDeps {
  getLatestDispatch: (tenantId: string) => Promise<DispatchStatus | null>;
}

// ─── Handlers ─────────────────────────────────────────────────────────────────

export async function handleDisparar(
  tenantId: string,
  deps: DispatchDeps,
): Promise<string> {
  logger.info({ tenantId }, 'Handling disparar intent');

  const promo = await deps.getLatestPromo(tenantId);
  if (!promo) {
    return '⚠️ Você ainda não tem nenhuma promo criada. Primeiro crie uma promo na aba Promos, depois volte aqui pra disparar!';
  }

  const groups = await deps.getActiveGroups(tenantId);
  if (groups.length === 0) {
    return '⚠️ Nenhum grupo ativo encontrado. Conecte pelo menos um grupo em Settings → WhatsApp antes de disparar.';
  }

  const groupIds = groups.map((g) => g.id);

  try {
    const dispatch = await deps.createDispatch(tenantId, promo.id, groupIds);

    const estimatedMinutes = Math.ceil(groups.length * 0.5); // ~30s per group
    return [
      `📨 Disparo criado com sucesso!`,
      ``,
      `• Promo: *${promo.name || promo.productName}*`,
      `• Grupos: ${groups.length}`,
      `• Tempo estimado: ~${estimatedMinutes} min`,
      `• ID: \`${dispatch.id.slice(0, 8)}\``,
      ``,
      `Acompanhe o status pelo dashboard ou me pergunte "qual o status do disparo?"`,
    ].join('\n');
  } catch (err) {
    logger.error({ err, tenantId }, 'Failed to create dispatch');
    return '❌ Erro ao criar o disparo. Tente novamente ou acesse Disparos no painel.';
  }
}

export async function handleStatus(
  tenantId: string,
  deps: StatusDeps,
): Promise<string> {
  logger.info({ tenantId }, 'Handling status intent');

  const dispatch = await deps.getLatestDispatch(tenantId);
  if (!dispatch) {
    return '📊 Nenhum disparo encontrado. Quando você criar um disparo, pode acompanhar o status por aqui!';
  }

  const total = dispatch.totalCount || 1;
  const progress = Math.round((dispatch.sentCount / total) * 100);

  const STATUS_LABELS: Record<string, string> = {
    pending: '⏳ Aguardando',
    running: '🚀 Enviando',
    completed: '✅ Concluído',
    failed: '❌ Falhou',
    cancelled: '🚫 Cancelado',
  };

  const statusLabel = STATUS_LABELS[dispatch.status] ?? dispatch.status;

  return [
    `📊 Status do último disparo:`,
    ``,
    `• Promo: *${dispatch.promoName}*`,
    `• Status: ${statusLabel}`,
    `• Enviados: ${dispatch.sentCount}/${total} (${progress}%)`,
    dispatch.failedCount > 0 ? `• Falhas: ${dispatch.failedCount}` : null,
    `• Criado em: ${dispatch.createdAt.toLocaleString('pt-BR')}`,
  ]
    .filter(Boolean)
    .join('\n');
}
