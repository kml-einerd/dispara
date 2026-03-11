import { EventEmitter } from 'node:events';
import { mkdir } from 'node:fs/promises';
import { join } from 'node:path';
import makeWASocket, {
  useMultiFileAuthState,
  DisconnectReason,
  fetchLatestBaileysVersion,
  makeCacheableSignalKeyStore,
  type WASocket,
  type GroupMetadata,
  type ConnectionState,
  type BaileysEventMap,
} from '@whiskeysockets/baileys';
import { Boom } from '@hapi/boom';
import pino from 'pino';
import QRCode from 'qrcode';
import { getBrowserTuple } from './browser-fingerprints.js';

export interface SessionConfig {
  sessionId: string;
  tenantId: string;
  phoneNumber: string;
  browserTuple?: [string, string, string];
  onQR?: (qr: string) => void;
  onConnected?: () => void;
  onDisconnected?: (reason: string) => void;
  onBanned?: () => void;
}

export interface SessionHealth {
  status: string;
  lastActivity: Date;
}

interface SessionEntry {
  socket: WASocket;
  tenantId: string;
  phoneNumber: string;
  lastActivity: Date;
  status: 'connecting' | 'connected' | 'disconnected';
  retryCount: number;
}

const AUTH_BASE_DIR = process.env.WA_AUTH_DIR ?? '/tmp/wa-sessions';
const MAX_RETRY_COUNT = 3;

export class WaSessionManager extends EventEmitter {
  private sessions: Map<string, SessionEntry> = new Map();
  private logger = pino({ name: 'wa-session-manager', level: process.env.LOG_LEVEL ?? 'info' });

  /**
   * Create a new WhatsApp session with Baileys.
   * Emits 'qr', 'connected', 'disconnected', 'banned' events.
   */
  async createSession(config: SessionConfig): Promise<void> {
    const { sessionId, tenantId, phoneNumber } = config;

    // Prevent duplicate sessions
    if (this.sessions.has(sessionId)) {
      this.logger.warn({ sessionId }, 'Session already exists, disconnecting old one first');
      await this.disconnectSession(sessionId);
    }

    const authDir = join(AUTH_BASE_DIR, sessionId);
    await mkdir(authDir, { recursive: true });

    const { state, saveCreds } = await useMultiFileAuthState(authDir);
    const { version } = await fetchLatestBaileysVersion();

    const browserTuple = config.browserTuple ?? getBrowserTuple(sessionId);

    const sock = makeWASocket({
      version,
      auth: {
        creds: state.creds,
        keys: makeCacheableSignalKeyStore(state.keys, this.logger.child({ module: 'signal-store' })),
      },
      browser: browserTuple,
      logger: this.logger.child({ sessionId }),
      printQRInTerminal: false,
      generateHighQualityLinkPreview: false,
      syncFullHistory: false,
      markOnlineOnConnect: false,
    });

    const entry: SessionEntry = {
      socket: sock,
      tenantId,
      phoneNumber,
      lastActivity: new Date(),
      status: 'connecting',
      retryCount: 0,
    };
    this.sessions.set(sessionId, entry);

    // Connection update handler
    sock.ev.on('connection.update', async (update: Partial<ConnectionState>) => {
      const { connection, lastDisconnect, qr } = update;

      if (qr) {
        try {
          const qrDataUrl = await QRCode.toDataURL(qr);
          entry.lastActivity = new Date();
          config.onQR?.(qrDataUrl);
          this.emit('qr', { sessionId, tenantId, qr: qrDataUrl });
        } catch (err) {
          this.logger.error({ sessionId, err }, 'Failed to generate QR data URL');
        }
      }

      if (connection === 'close') {
        const boom = lastDisconnect?.error as Boom | undefined;
        const statusCode = boom?.output?.statusCode ?? 0;
        const reason = boom?.message ?? 'unknown';

        this.logger.info({ sessionId, statusCode, reason }, 'Connection closed');

        // Ban detection: 401, 403, or DisconnectReason.loggedOut
        if (
          statusCode === DisconnectReason.loggedOut ||
          statusCode === 401 ||
          statusCode === 403
        ) {
          entry.status = 'disconnected';
          config.onBanned?.();
          this.emit('banned', { sessionId, tenantId, reason });
          this.sessions.delete(sessionId);
          return;
        }

        // Retry logic for recoverable disconnects
        const shouldReconnect = statusCode !== DisconnectReason.loggedOut;
        if (shouldReconnect && entry.retryCount < MAX_RETRY_COUNT) {
          entry.retryCount++;
          this.logger.info({ sessionId, retryCount: entry.retryCount }, 'Reconnecting...');
          try {
            await this.createSession(config);
          } catch (err) {
            this.logger.error({ sessionId, err }, 'Reconnection failed');
          }
        } else {
          entry.status = 'disconnected';
          config.onDisconnected?.(reason);
          this.emit('disconnected', { sessionId, tenantId, reason });
          this.sessions.delete(sessionId);
        }
      }

      if (connection === 'open') {
        entry.status = 'connected';
        entry.lastActivity = new Date();
        entry.retryCount = 0;
        this.logger.info({ sessionId }, 'Session connected');
        config.onConnected?.();
        this.emit('connected', { sessionId, tenantId });
      }
    });

    // Persist credentials on update
    sock.ev.on('creds.update', saveCreds);

    // Group participant tracking
    sock.ev.on('group-participants.update', (update) => {
      this.emit('group-participants-update', {
        sessionId,
        tenantId,
        ...update,
      });
    });

    // Incoming messages
    sock.ev.on('messages.upsert', (msg) => {
      entry.lastActivity = new Date();
      this.emit('message', { sessionId, tenantId, ...msg });
    });
  }

  /**
   * Disconnect a session gracefully without removing credentials.
   */
  async disconnectSession(sessionId: string): Promise<void> {
    const entry = this.sessions.get(sessionId);
    if (!entry) {
      this.logger.warn({ sessionId }, 'Session not found for disconnect');
      return;
    }

    try {
      entry.socket.end(undefined);
    } catch (err) {
      this.logger.error({ sessionId, err }, 'Error during disconnect');
    }

    entry.status = 'disconnected';
    this.sessions.delete(sessionId);
    this.logger.info({ sessionId }, 'Session disconnected');
  }

  /**
   * Logout and delete credentials for a session.
   */
  async logoutSession(sessionId: string): Promise<void> {
    const entry = this.sessions.get(sessionId);
    if (!entry) {
      this.logger.warn({ sessionId }, 'Session not found for logout');
      return;
    }

    try {
      await entry.socket.logout();
    } catch (err) {
      this.logger.error({ sessionId, err }, 'Error during logout');
    }

    this.sessions.delete(sessionId);
    this.logger.info({ sessionId }, 'Session logged out');

    // Clean up auth files
    const { rm } = await import('node:fs/promises');
    const authDir = join(AUTH_BASE_DIR, sessionId);
    try {
      await rm(authDir, { recursive: true, force: true });
    } catch {
      // Ignore cleanup errors
    }
  }

  /**
   * Get the raw WASocket for a session (for direct Baileys operations).
   */
  getSession(sessionId: string): WASocket | undefined {
    return this.sessions.get(sessionId)?.socket;
  }

  /**
   * Get all active session IDs.
   */
  getActiveSessions(): string[] {
    return Array.from(this.sessions.keys());
  }

  /**
   * Send a text message to a group with typing simulation.
   */
  async sendTextMessage(sessionId: string, groupJid: string, text: string): Promise<void> {
    const sock = this.getSessionOrThrow(sessionId);
    await sock.sendMessage(groupJid, { text });
    this.updateActivity(sessionId);
  }

  /**
   * Send an image message to a group.
   */
  async sendImageMessage(
    sessionId: string,
    groupJid: string,
    imageUrl: string,
    caption: string,
  ): Promise<void> {
    const sock = this.getSessionOrThrow(sessionId);
    await sock.sendMessage(groupJid, {
      image: { url: imageUrl },
      caption,
    });
    this.updateActivity(sessionId);
  }

  /**
   * Simulate typing before sending a message.
   * Sequence:
   * 1. Set presence to available
   * 2. Mark chat as read
   * 3. Start composing
   * 4. Wait proportional to text length
   * 5. Pause composing
   * 6. Brief random pause
   * 7. Return (caller sends the actual message)
   * 8. Set presence to unavailable
   */
  async simulateTyping(sessionId: string, chatJid: string, durationMs: number): Promise<void> {
    const sock = this.getSessionOrThrow(sessionId);

    try {
      // 1. Appear online
      await sock.sendPresenceUpdate('available');

      // 2. Mark messages as read
      await sock.readMessages([{ id: '', remoteJid: chatJid }]).catch(() => {
        // Ignore read errors — sometimes there are no unread messages
      });

      // 3. Start composing
      await sock.sendPresenceUpdate('composing', chatJid);

      // 4. Wait for the typing duration
      await this.sleep(durationMs);

      // 5. Pause composing
      await sock.sendPresenceUpdate('paused', chatJid);

      // 6. Brief random pause (500-2000ms)
      const briefPause = 500 + Math.random() * 1500;
      await this.sleep(briefPause);

      // 8. Go unavailable (step 7 is the caller sending the message)
      await sock.sendPresenceUpdate('unavailable');
    } catch (err) {
      this.logger.error({ sessionId, chatJid, err }, 'Error during typing simulation');
      // Don't throw — typing simulation is non-critical
    }
  }

  /**
   * Fetch all groups the session is a member of.
   */
  async fetchGroups(sessionId: string): Promise<GroupMetadata[]> {
    const sock = this.getSessionOrThrow(sessionId);
    const groups = await sock.groupFetchAllParticipating();
    return Object.values(groups);
  }

  /**
   * Get health status for a session.
   */
  getSessionHealth(sessionId: string): SessionHealth {
    const entry = this.sessions.get(sessionId);
    if (!entry) {
      return { status: 'not_found', lastActivity: new Date(0) };
    }
    return {
      status: entry.status,
      lastActivity: entry.lastActivity,
    };
  }

  /**
   * Disconnect all sessions (for graceful shutdown).
   */
  async disconnectAll(): Promise<void> {
    const ids = this.getActiveSessions();
    this.logger.info({ count: ids.length }, 'Disconnecting all sessions');
    await Promise.allSettled(ids.map((id) => this.disconnectSession(id)));
  }

  // ---- Private helpers ----

  private getSessionOrThrow(sessionId: string): WASocket {
    const entry = this.sessions.get(sessionId);
    if (!entry) {
      throw new Error(`Session ${sessionId} not found`);
    }
    if (entry.status !== 'connected') {
      throw new Error(`Session ${sessionId} is not connected (status: ${entry.status})`);
    }
    return entry.socket;
  }

  private updateActivity(sessionId: string): void {
    const entry = this.sessions.get(sessionId);
    if (entry) {
      entry.lastActivity = new Date();
    }
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}

// Singleton instance
let instance: WaSessionManager | null = null;

export function getWaSessionManager(): WaSessionManager {
  if (!instance) {
    instance = new WaSessionManager();
  }
  return instance;
}
