import { randomUUID } from 'node:crypto';
import pino from 'pino';
import { IntentClassifier } from './classifier.js';
import { handleDisparar, handleStatus, type DispatchDeps, type StatusDeps } from './handlers.js';
import { ProductRAG } from './rag.js';
import { ConversationalResponder } from './responder.js';
import type { AgentConfig, AgentInteraction, Intent } from './types.js';

const logger = pino({ name: 'agent-engine' });

interface CooldownEntry {
  lastResponseAt: number;
  responsesThisHour: number;
  hourStart: number;
}

export interface ProcessMessageResult {
  response: string | null;
  interaction: AgentInteraction;
}

/** Intents that trigger RAG product search */
const RAG_INTENTS: Intent[] = ['busca_produto'];

/** Intents the agent should respond to (non-off_topic) */
const ACTIONABLE_INTENTS: Intent[] = ['busca_produto', 'gerar_copy', 'disparar', 'status', 'ajuda'];

export class AgentEngine {
  private classifier: IntentClassifier;
  private rag: ProductRAG;
  private responder: ConversationalResponder;
  private config: AgentConfig;
  private cooldowns: Map<string, CooldownEntry> = new Map();
  private dispatchDeps?: DispatchDeps;
  private statusDeps?: StatusDeps;

  constructor(
    classifier: IntentClassifier,
    rag: ProductRAG,
    responder: ConversationalResponder,
    config: AgentConfig,
    deps?: { dispatchDeps?: DispatchDeps; statusDeps?: StatusDeps },
  ) {
    this.classifier = classifier;
    this.rag = rag;
    this.responder = responder;
    this.config = config;
    this.dispatchDeps = deps?.dispatchDeps;
    this.statusDeps = deps?.statusDeps;
  }

  async processMessage(
    message: string,
    groupId: string,
    platform: 'whatsapp' | 'telegram',
    groupName?: string,
  ): Promise<ProcessMessageResult> {
    const startTime = Date.now();
    const interactionId = randomUUID();

    const baseInteraction: AgentInteraction = {
      id: interactionId,
      tenantId: this.config.tenantId,
      groupId,
      groupName: groupName ?? groupId,
      platform,
      incomingMessage: message,
      intent: 'off_topic',
      confidence: 0,
      responseText: null,
      responseTimeMs: 0,
      productIds: [],
      createdAt: new Date(),
    };

    // 1. Check if agent is enabled for this group
    if (!this.config.enabled || !this.config.enabledGroups.includes(groupId)) {
      logger.debug({ tenantId: this.config.tenantId, groupId }, 'Agent not enabled for this group');
      baseInteraction.responseTimeMs = Date.now() - startTime;
      return { response: null, interaction: baseInteraction };
    }

    // 2. Check cooldown
    if (this.isOnCooldown(groupId)) {
      logger.debug({ tenantId: this.config.tenantId, groupId }, 'Group is on cooldown');
      baseInteraction.responseTimeMs = Date.now() - startTime;
      return { response: null, interaction: baseInteraction };
    }

    // 3. Classify intent
    const classification = await this.classifier.classifyIntent(message);
    baseInteraction.intent = classification.intent;
    baseInteraction.confidence = classification.confidence;

    logger.info(
      { tenantId: this.config.tenantId, groupId, intent: classification.intent, confidence: classification.confidence },
      'Message classified',
    );

    // 4. If off_topic, return null (silence)
    if (!ACTIONABLE_INTENTS.includes(classification.intent)) {
      baseInteraction.responseTimeMs = Date.now() - startTime;
      return { response: null, interaction: baseInteraction };
    }

    // 5a. Handle disparar/status with real handlers if deps provided
    if (classification.intent === 'disparar' && this.dispatchDeps) {
      const responseText = await handleDisparar(this.config.tenantId, this.dispatchDeps);
      const delay = this.calculateDelay();
      await this.sleep(delay);
      this.recordResponse(groupId);
      baseInteraction.responseText = responseText;
      baseInteraction.responseTimeMs = Date.now() - startTime;
      return { response: responseText, interaction: baseInteraction };
    }

    if (classification.intent === 'status' && this.statusDeps) {
      const responseText = await handleStatus(this.config.tenantId, this.statusDeps);
      const delay = this.calculateDelay();
      await this.sleep(delay);
      this.recordResponse(groupId);
      baseInteraction.responseText = responseText;
      baseInteraction.responseTimeMs = Date.now() - startTime;
      return { response: responseText, interaction: baseInteraction };
    }

    // 5. Search products via RAG only for product-related intents
    const ragResults = RAG_INTENTS.includes(classification.intent)
      ? await this.rag.searchProducts(this.config.tenantId, message, classification.entities)
      : [];
    baseInteraction.productIds = ragResults.map((r) => r.product.id);

    // 6. Generate response
    const responseText = await this.responder.generateResponse(
      this.config,
      ragResults,
      message,
      classification.intent,
    );

    // 7. Apply humanized delay
    const delay = this.calculateDelay();
    logger.info({ tenantId: this.config.tenantId, groupId, delayMs: delay }, 'Applying response delay');
    await this.sleep(delay);

    // 8. Record cooldown
    this.recordResponse(groupId);

    baseInteraction.responseText = responseText;
    baseInteraction.responseTimeMs = Date.now() - startTime;

    logger.info(
      {
        tenantId: this.config.tenantId,
        groupId,
        intent: classification.intent,
        productCount: ragResults.length,
        responseTimeMs: baseInteraction.responseTimeMs,
      },
      'Agent response generated',
    );

    return { response: responseText, interaction: baseInteraction };
  }

  private isOnCooldown(groupId: string): boolean {
    const entry = this.cooldowns.get(groupId);
    if (!entry) return false;

    const now = Date.now();
    const cooldownMs = this.config.cooldownMinutes * 60 * 1000;

    if (now - entry.lastResponseAt < cooldownMs) {
      return true;
    }

    const oneHour = 60 * 60 * 1000;
    if (now - entry.hourStart < oneHour && entry.responsesThisHour >= this.config.maxResponsesPerHour) {
      return true;
    }

    return false;
  }

  private recordResponse(groupId: string): void {
    const now = Date.now();
    const entry = this.cooldowns.get(groupId);
    const oneHour = 60 * 60 * 1000;

    if (entry && now - entry.hourStart < oneHour) {
      entry.lastResponseAt = now;
      entry.responsesThisHour += 1;
    } else {
      this.cooldowns.set(groupId, {
        lastResponseAt: now,
        responsesThisHour: 1,
        hourStart: now,
      });
    }
  }

  private calculateDelay(): number {
    const min = this.config.responseDelayMinMs;
    const max = this.config.responseDelayMaxMs;
    return Math.floor(Math.random() * (max - min + 1)) + min;
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  updateConfig(config: AgentConfig): void {
    this.config = config;
    logger.info({ tenantId: config.tenantId }, 'Agent config updated');
  }

  clearCooldowns(): void {
    this.cooldowns.clear();
    logger.info({ tenantId: this.config.tenantId }, 'Cooldowns cleared');
  }
}
