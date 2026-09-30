type EventHandler = (data: any) => void;
export type ConnectionStatus = 'LIVE' | 'RECONNECTING' | 'OFFLINE';
type StatusListener = (status: ConnectionStatus) => void;

class WebSocketClient {
  private ws: WebSocket | null = null;
  private listeners: Map<string, EventHandler[]> = new Map();
  private statusListeners: Set<StatusListener> = new Set();
  private reconnectTimeout: any = null;
  private pollingTimer: any = null;
  private pollFallbackCallback: (() => void) | null = null;
  private _status: ConnectionStatus = 'OFFLINE';
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 6;
  private recentMessages: Set<string> = new Set();

  constructor() {}

  public get status(): ConnectionStatus {
    return this._status;
  }

  private setStatus(newStatus: ConnectionStatus) {
    if (this._status !== newStatus) {
      this._status = newStatus;
      this.statusListeners.forEach((listener) => {
        try {
          listener(newStatus);
        } catch (e) {
          console.warn('[WS Client] Status listener error:', e);
        }
      });
    }
  }

  public onStatusChange(listener: StatusListener): () => void {
    this.statusListeners.add(listener);
    listener(this._status);
    return () => {
      this.statusListeners.delete(listener);
    };
  }

  public setFallbackPoll(cb: () => void) {
    this.pollFallbackCallback = cb;
  }

  private startFallbackPolling() {
    if (this.pollingTimer) return;
    console.info('[CrisisCommand WS] Activating HTTP fallback polling stream.');
    // Immediate poll
    if (this.pollFallbackCallback) {
      this.pollFallbackCallback();
    }
    this.pollingTimer = setInterval(() => {
      if (this.pollFallbackCallback) {
        this.pollFallbackCallback();
      }
    }, 4500);
  }

  private stopFallbackPolling() {
    if (this.pollingTimer) {
      clearInterval(this.pollingTimer);
      this.pollingTimer = null;
      console.info('[CrisisCommand WS] Deactivated HTTP fallback polling (WebSocket is LIVE).');
    }
  }

  private getWebSocketUrl(): string {
    const wsProto = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const backendHost = import.meta.env.VITE_BACKEND_HOST || 'localhost:8000';
    const token = localStorage.getItem('crisis_token');
    const tokenParam = token ? `?token=${encodeURIComponent(token)}` : '';
    return `${wsProto}//${backendHost}/ws/command${tokenParam}`;
  }

  connect() {
    if (this.ws && (this.ws.readyState === WebSocket.OPEN || this.ws.readyState === WebSocket.CONNECTING)) {
      return;
    }

    const url = this.getWebSocketUrl();
    this.setStatus(this.reconnectAttempts > 0 ? 'RECONNECTING' : 'OFFLINE');

    try {
      this.ws = new WebSocket(url);

      this.ws.onopen = () => {
        this.setStatus('LIVE');
        this.reconnectAttempts = 0;
        this.stopFallbackPolling();
        console.log('[CrisisCommand WS] Connected to authenticated emergency channel.');

        // Send auth handshake frame with token
        const token = localStorage.getItem('crisis_token');
        if (token) {
          this.send({ type: 'AUTH', token });
        }
      };

      this.ws.onmessage = (event) => {
        try {
          const payload = JSON.parse(event.data);
          const { event: eventType, data } = payload;

          // Message deduplication (safe: data may be undefined for PONG-type frames)
          const dataStr = data !== undefined ? (JSON.stringify(data) ?? '') : '';
          const msgKey = `${eventType}:${dataStr.slice(0, 100)}`;
          if (this.recentMessages.has(msgKey)) {
            return;
          }
          this.recentMessages.add(msgKey);
          if (this.recentMessages.size > 200) {
            this.recentMessages.clear();
          }

          if (eventType && this.listeners.has(eventType)) {
            this.listeners.get(eventType)?.forEach((handler) => handler(data));
          }
          if (this.listeners.has('*')) {
            this.listeners.get('*')?.forEach((handler) => handler(payload));
          }
        } catch (e) {
          console.error('[CrisisCommand WS] Parse error:', e);
        }
      };

      this.ws.onclose = () => {
        this.ws = null;
        this.reconnectAttempts += 1;

        if (this.reconnectAttempts > this.maxReconnectAttempts) {
          this.setStatus('OFFLINE');
        } else {
          this.setStatus('RECONNECTING');
        }

        // Engage fallback polling immediately on disconnect
        this.startFallbackPolling();

        // Auto-reconnect with slight exponential delay
        if (!this.reconnectTimeout) {
          const delay = Math.min(2000 * Math.pow(1.3, Math.min(this.reconnectAttempts, 5)), 8000);
          this.reconnectTimeout = setTimeout(() => {
            this.reconnectTimeout = null;
            this.connect();
          }, delay);
        }
      };

      this.ws.onerror = () => {
        this.ws?.close();
      };
    } catch (e) {
      console.warn('[CrisisCommand WS] Connection error:', e);
      this.setStatus('OFFLINE');
      this.startFallbackPolling();
    }
  }

  on(eventType: string, handler: EventHandler) {
    if (!this.listeners.has(eventType)) {
      this.listeners.set(eventType, []);
    }
    const handlers = this.listeners.get(eventType)!;
    if (!handlers.includes(handler)) {
      handlers.push(handler);
    }
    return () => {
      const currentHandlers = this.listeners.get(eventType) || [];
      this.listeners.set(eventType, currentHandlers.filter((h) => h !== handler));
    };
  }

  send(data: any) {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(data));
    }
  }

  disconnect() {
    if (this.reconnectTimeout) {
      clearTimeout(this.reconnectTimeout);
      this.reconnectTimeout = null;
    }
    this.stopFallbackPolling();
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
    this.setStatus('OFFLINE');
  }
}

export const wsClient = new WebSocketClient();
