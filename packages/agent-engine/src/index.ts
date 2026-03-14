export { IntentClassifier } from './classifier.js';
export { ProductRAG } from './rag.js';
export type { ProductQueryFn } from './rag.js';
export { ConversationalResponder } from './responder.js';
export { AgentEngine } from './agent.js';
export type { ProcessMessageResult } from './agent.js';
export { processAgentMessage } from './process-message.js';
export type { ProcessAgentMessageOptions, ProcessAgentMessageResult } from './process-message.js';
export { handleDisparar, handleStatus } from './handlers.js';
export type {
  DispatchDeps,
  StatusDeps,
  PromoSummary,
  GroupSummary,
  DispatchRecord,
  DispatchStatus,
} from './handlers.js';
export type {
  Intent,
  ClassificationResult,
  AgentConfig,
  AgentInteraction,
  ProductForRAG,
  RAGResult,
} from './types.js';
