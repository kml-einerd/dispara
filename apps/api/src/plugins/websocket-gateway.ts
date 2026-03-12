import type { FastifyInstance, FastifyRequest } from 'fastify';
import type { WebSocket } from '@fastify/websocket';

interface WsClient {
  socket: WebSocket;
  tenantId: string;
  channels: Set<string>;
}

/**
 * WebSocket Gateway plugin for real-time updates.
 *
 * Channels:
 * - wa:qr:{session_id}     — QR code updates for WhatsApp scan
 * - dispatch:{dispatch_id}  — dispatch progress updates
 * - health:{session_id}     — session health status
 */
export class WebSocketGateway {
  private clients: Map<string, WsClient> = new Map();
  private heartbeatInterval: ReturnType<typeof setInterval> | null = null;

  constructor(private readonly app: FastifyInstance) {}

  async register(): Promise<void> {
    this.app.get('/ws', { websocket: true }, (socket: WebSocket, req: FastifyRequest) => {
      const clientId = crypto.randomUUID();
      const tenantId = (req.query as Record<string, string>).tenant_id ?? '';

      if (!tenantId) {
        socket.send(JSON.stringify({ type: 'error', message: 'tenant_id required' }));
        socket.close(4001, 'tenant_id required');
        return;
      }

      const client: WsClient = { socket, tenantId, channels: new Set() };
      this.clients.set(clientId, client);

      this.app.log.info({ clientId, tenantId }, 'WebSocket client connected');

      socket.on('message', (raw: any) => {
        try {
          const msg = JSON.parse(raw.toString());
          this.handleMessage(clientId, msg);
        } catch {
          socket.send(JSON.stringify({ type: 'error', message: 'Invalid JSON' }));
        }
      });

      socket.on('close', () => {
        this.clients.delete(clientId);
        this.app.log.info({ clientId }, 'WebSocket client disconnected');
      });

      socket.on('error', (err: Error) => {
        this.app.log.error({ clientId, err }, 'WebSocket error');
        this.clients.delete(clientId);
      });

      socket.send(JSON.stringify({ type: 'connected', clientId }));
    });

    this.startHeartbeat();
  }

  private handleMessage(clientId: string, msg: { type: string; channel?: string }): void {
    const client = this.clients.get(clientId);
    if (!client) return;

    switch (msg.type) {
      case 'subscribe':
        if (msg.channel) {
          client.channels.add(msg.channel);
          client.socket.send(JSON.stringify({ type: 'subscribed', channel: msg.channel }));
        }
        break;

      case 'unsubscribe':
        if (msg.channel) {
          client.channels.delete(msg.channel);
          client.socket.send(JSON.stringify({ type: 'unsubscribed', channel: msg.channel }));
        }
        break;

      case 'ping':
        client.socket.send(JSON.stringify({ type: 'pong', timestamp: Date.now() }));
        break;

      default:
        client.socket.send(JSON.stringify({ type: 'error', message: `Unknown type: ${msg.type}` }));
    }
  }

  /**
   * Broadcast to all clients subscribed to a channel.
   * Only sends to clients of the matching tenant.
   */
  broadcast(channel: string, tenantId: string, data: unknown): void {
    for (const client of this.clients.values()) {
      if (client.tenantId !== tenantId) continue;
      if (!client.channels.has(channel)) continue;

      try {
        client.socket.send(JSON.stringify({ type: 'event', channel, data, timestamp: Date.now() }));
      } catch (err) {
        this.app.log.error({ channel, err }, 'Failed to send WebSocket message');
      }
    }
  }

  /**
   * Send to a specific client by ID.
   */
  sendTo(clientId: string, data: unknown): void {
    const client = this.clients.get(clientId);
    if (!client) return;

    try {
      client.socket.send(JSON.stringify(data));
    } catch (err) {
      this.app.log.error({ clientId, err }, 'Failed to send to client');
    }
  }

  /**
   * Broadcast QR code update for a session.
   */
  broadcastQR(sessionId: string, tenantId: string, qrDataUrl: string): void {
    this.broadcast(`wa:qr:${sessionId}`, tenantId, { sessionId, qr: qrDataUrl });
  }

  /**
   * Broadcast dispatch progress update.
   */
  broadcastDispatchProgress(
    dispatchId: string,
    tenantId: string,
    progress: { sent: number; failed: number; total: number; status: string },
  ): void {
    this.broadcast(`dispatch:${dispatchId}`, tenantId, { dispatchId, ...progress });
  }

  /**
   * Broadcast session health update.
   */
  broadcastSessionHealth(
    sessionId: string,
    tenantId: string,
    health: { status: string; healthScore: number; dailyMsgCount: number },
  ): void {
    this.broadcast(`health:${sessionId}`, tenantId, { sessionId, ...health });
  }

  private startHeartbeat(): void {
    this.heartbeatInterval = setInterval(() => {
      const now = Date.now();
      for (const [clientId, client] of this.clients.entries()) {
        try {
          client.socket.send(JSON.stringify({ type: 'heartbeat', timestamp: now }));
        } catch {
          this.clients.delete(clientId);
        }
      }
    }, 30_000); // 30s heartbeat
  }

  getClientCount(): number {
    return this.clients.size;
  }

  shutdown(): void {
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
    }
    for (const client of this.clients.values()) {
      try {
        client.socket.close(1001, 'Server shutting down');
      } catch { /* ignore */ }
    }
    this.clients.clear();
  }
}
