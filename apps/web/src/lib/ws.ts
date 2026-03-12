'use client';

import { useEffect, useRef, useCallback, useState } from 'react';
const WS_BASE = process.env.NEXT_PUBLIC_WS_URL || 'ws://localhost:3001';

interface WsMessage {
  type: string;
  channel?: string;
  data?: unknown;
  timestamp?: number;
  clientId?: string;
  message?: string;
}

type MessageHandler = (data: unknown, channel: string) => void;

export function useWebSocket() {
  const wsRef = useRef<WebSocket | null>(null);
  const handlersRef = useRef<Map<string, Set<MessageHandler>>>(new Map());
  const subscribedChannelsRef = useRef<Set<string>>(new Set());
  const reconnectTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [connected, setConnected] = useState(false);

  const connect = useCallback(() => {
    if (wsRef.current?.readyState === WebSocket.OPEN) return;

    const ws = new WebSocket(`${WS_BASE}/ws`);
    wsRef.current = ws;

    ws.onopen = () => {
      setConnected(true);
      // Re-subscribe to all channels on reconnect
      for (const channel of subscribedChannelsRef.current) {
        ws.send(JSON.stringify({ type: 'subscribe', channel }));
      }
    };

    ws.onmessage = (event) => {
      try {
        const msg: WsMessage = JSON.parse(event.data);

        if (msg.type === 'heartbeat') {
          ws.send(JSON.stringify({ type: 'ping' }));
          return;
        }

        if (msg.type === 'event' && msg.channel && msg.data !== undefined) {
          const handlers = handlersRef.current.get(msg.channel);
          if (handlers) {
            for (const handler of handlers) {
              handler(msg.data, msg.channel);
            }
          }
        }
      } catch {
        // Ignore parse errors
      }
    };

    ws.onclose = () => {
      setConnected(false);
      wsRef.current = null;
      // Reconnect after 3 seconds
      reconnectTimeoutRef.current = setTimeout(connect, 3000);
    };

    ws.onerror = () => {
      ws.close();
    };
  }, []);

  const subscribe = useCallback((channel: string, handler: MessageHandler) => {
    subscribedChannelsRef.current.add(channel);

    if (!handlersRef.current.has(channel)) {
      handlersRef.current.set(channel, new Set());
    }
    handlersRef.current.get(channel)!.add(handler);

    // Send subscribe message if connected
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ type: 'subscribe', channel }));
    }

    // Return unsubscribe function
    return () => {
      const handlers = handlersRef.current.get(channel);
      if (handlers) {
        handlers.delete(handler);
        if (handlers.size === 0) {
          handlersRef.current.delete(channel);
          subscribedChannelsRef.current.delete(channel);
          if (wsRef.current?.readyState === WebSocket.OPEN) {
            wsRef.current.send(JSON.stringify({ type: 'unsubscribe', channel }));
          }
        }
      }
    };
  }, []);

  useEffect(() => {
    connect();
    return () => {
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
      }
      wsRef.current?.close();
    };
  }, [connect]);

  return { subscribe, connected };
}
