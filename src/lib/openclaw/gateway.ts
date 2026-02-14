import WebSocket from 'ws';
import { randomUUID } from 'crypto';
import type {
  ConnectParams,
  EventFrame,
  HelloOk,
  RequestFrame,
  ResponseFrame,
  SessionsResolveParams,
  ChatSendParams,
  ChatEvent,
  ChatStreamResponse,
  OpenClawMessage,
} from './types';
import { OPENCLAW_PROTOCOL_VERSION } from './types';

interface PendingRequest {
  resolve: (value: unknown) => void;
  reject: (err: Error) => void;
  expectFinal: boolean;
}

export interface OpenClawGatewayOptions {
  url?: string;
  token: string;
  clientName?: string;
  clientVersion?: string;
  platform?: string;
  role?: string;
  scopes?: string[];
  onEvent?: (event: EventFrame) => void;
}

export class OpenClawGateway {
  private ws: WebSocket | null = null;
  private opts: OpenClawGatewayOptions;
  private pending = new Map<string, PendingRequest>();
  private backoffMs = 1000;
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 10;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private closed = false;
  private lastSeq: number | null = null;
  private connectNonce: string | null = null;
  private connectSent = false;
  private connectTimer: ReturnType<typeof setTimeout> | null = null;
  private lastTick: number | null = null;
  private tickIntervalMs = 30_000;
  private tickTimer: ReturnType<typeof setInterval> | null = null;

  private _isConnected = false;
  private _helloOk: HelloOk | null = null;
  private _sessionKey: string | null = null;
  private _onEvent: ((event: EventFrame) => void) | null = null;

  constructor(opts: OpenClawGatewayOptions) {
    this.opts = {
      url: opts.url ?? 'ws://localhost:18789',
      token: opts.token,
      clientName: opts.clientName ?? 'webchat-ui',
      clientVersion: opts.clientVersion ?? '1.0.0',
      platform: opts.platform ?? 'web',
      role: opts.role ?? 'operator',
      scopes: opts.scopes ?? ['operator.admin'],
      onEvent: opts.onEvent,
    };
    this._onEvent = opts.onEvent ?? null;
  }

  set onEvent(callback: (event: EventFrame) => void) {
    this._onEvent = callback;
  }

  get onEvent(): (event: EventFrame) => void {
    return this._onEvent ?? (() => {});
  }

  start(): void {
    if (this.closed) {
      return;
    }

    const url = this.opts.url!;
    this.ws = new WebSocket(url, {
      maxPayload: 25 * 1024 * 1024,
      headers: {
        Origin: 'http://localhost:3005',
      },
    });

    this.ws.on('open', () => {
      console.log('[OpenClawGateway] WebSocket connected, waiting for challenge...');
      this.queueConnect();
    });

    this.ws.on('message', (data) => this.handleMessage(this.rawDataToString(data)));

    this.ws.on('close', (code, reason) => {
      const reasonText = this.rawDataToString(reason);
      console.log(`[OpenClawGateway] WebSocket closed: ${code} ${reasonText}`);
      this.ws = null;
      this._isConnected = false;
      this.flushPendingErrors(new Error(`Gateway closed (${code}): ${reasonText}`));
      this.scheduleReconnect();
    });

    this.ws.on('error', (err) => {
      console.error('[OpenClawGateway] WebSocket error:', err);
    });
  }

  stop(): void {
    this.closed = true;
    if (this.tickTimer) {
      clearInterval(this.tickTimer);
      this.tickTimer = null;
    }
    if (this.connectTimer) {
      clearTimeout(this.connectTimer);
      this.connectTimer = null;
    }
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    this.ws?.close();
    this.ws = null;
    this._isConnected = false;
    this._sessionKey = null;
    this.flushPendingErrors(new Error('Gateway client stopped'));
  }

  async request<T = unknown>(method: string, params?: unknown, opts?: { expectFinal?: boolean }): Promise<T> {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      throw new Error('Gateway not connected');
    }

    const id = randomUUID();
    const frame: RequestFrame = { type: 'req', id, method, params };
    const expectFinal = opts?.expectFinal === true;

    const promise = new Promise<T>((resolve, reject) => {
      this.pending.set(id, {
        resolve: (value) => resolve(value as T),
        reject,
        expectFinal,
      });
    });

    this.ws.send(JSON.stringify(frame));
    return promise;
  }

  async sessionsResolve(params: SessionsResolveParams): Promise<{ key: string; sessionId: string }> {
    const result = await this.request<{ key: string; sessionId: string }>('sessions.resolve', params);
    this._sessionKey = result.key;
    return result;
  }

  async sendMessage(sessionKey: string, message: string): Promise<unknown> {
    const params: ChatSendParams = {
      sessionKey,
      message,
      idempotencyKey: randomUUID(),
    };
    return this.request('chat.send', params, { expectFinal: true });
  }

  async chatAbort(sessionKey: string, runId?: string): Promise<unknown> {
    return this.request('chat.abort', { sessionKey, runId });
  }

  async chatHistory(sessionKey: string, limit?: number): Promise<{
    sessionKey: string;
    sessionId: string;
    messages: unknown[];
  }> {
    return this.request('chat.history', { sessionKey, limit });
  }

  get isConnected(): boolean {
    return this._isConnected;
  }

  get sessionKey(): string | null {
    return this._sessionKey;
  }

  private sendConnect(): void {
    if (this.connectSent) {
      return;
    }
    this.connectSent = true;

    if (this.connectTimer) {
      clearTimeout(this.connectTimer);
      this.connectTimer = null;
    }

    const role = this.opts.role ?? 'operator';
    const scopes = this.opts.scopes ?? ['operator.admin'];

    const params: ConnectParams = {
      minProtocol: OPENCLAW_PROTOCOL_VERSION,
      maxProtocol: OPENCLAW_PROTOCOL_VERSION,
      client: {
        id: 'webchat-ui',
        displayName: 'WhiteNote',
        version: this.opts.clientVersion ?? '1.0.0',
        platform: this.opts.platform ?? 'web',
        mode: 'webchat',
      },
      role,
      scopes,
      auth: {
        token: this.opts.token,
      },
    };

    this.request<HelloOk>('connect', params)
      .then((helloOk) => {
        console.log('[OpenClawGateway] Connected successfully:', helloOk.server.version);
        this._isConnected = true;
        this._helloOk = helloOk;
        this.backoffMs = 1000;
        this.reconnectAttempts = 0;
        this.tickIntervalMs = typeof helloOk.policy?.tickIntervalMs === 'number' ? helloOk.policy.tickIntervalMs : 30_000;
        this.lastTick = Date.now();
        this.startTickWatch();
      })
      .catch((err) => {
        console.error('[OpenClawGateway] Connect failed:', err);
        this.ws?.close(1008, 'connect failed');
      });
  }

  private handleMessage(raw: string): void {
    try {
      const parsed = JSON.parse(raw);

      if (parsed.type === 'event') {
        const evt = parsed as EventFrame;

        if (evt.event === 'connect.challenge') {
          const payload = evt.payload as { nonce?: string } | undefined;
          const nonce = payload?.nonce;
          if (nonce) {
            this.connectNonce = nonce;
            this.sendConnect();
          }
          return;
        }

        const seq = typeof evt.seq === 'number' ? evt.seq : null;
        if (seq !== null) {
          if (this.lastSeq !== null && seq > this.lastSeq + 1) {
            console.warn(`[OpenClawGateway] Event gap: expected ${this.lastSeq + 1}, got ${seq}`);
          }
          this.lastSeq = seq;
        }

        if (evt.event === 'tick') {
          this.lastTick = Date.now();
        }

        this._onEvent?.(evt);
        return;
      }

      if (parsed.type === 'res') {
        const res = parsed as ResponseFrame;
        const pending = this.pending.get(res.id);
        if (!pending) {
          return;
        }

        const payload = res.payload as { status?: string } | undefined;
        if (pending.expectFinal && payload?.status === 'accepted') {
          return;
        }

        this.pending.delete(res.id);
        if (res.ok) {
          pending.resolve(res.payload);
        } else {
          pending.reject(new Error(res.error?.message ?? 'Unknown error'));
        }
      }
    } catch (err) {
      console.error('[OpenClawGateway] Parse error:', err);
    }
  }

  private queueConnect(): void {
    this.connectNonce = null;
    this.connectSent = false;
    if (this.connectTimer) {
      clearTimeout(this.connectTimer);
    }
    this.connectTimer = setTimeout(() => {
      this.sendConnect();
    }, 750);
  }

  private scheduleReconnect(): void {
    if (this.closed) {
      return;
    }
    this.reconnectAttempts++;
    if (this.reconnectAttempts > this.maxReconnectAttempts) {
      console.error(`[OpenClawGateway] Max reconnect attempts reached, giving up`);
      return;
    }
    if (this.tickTimer) {
      clearInterval(this.tickTimer);
      this.tickTimer = null;
    }
    const delay = this.backoffMs;
    this.backoffMs = Math.min(this.backoffMs * 2, 30_000);
    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null;
      this.start();
    }, delay);
  }

  private flushPendingErrors(err: Error): void {
    for (const [, p] of this.pending) {
      p.reject(err);
    }
    this.pending.clear();
  }

  private startTickWatch(): void {
    if (this.tickTimer) {
      clearInterval(this.tickTimer);
    }
    const interval = Math.max(this.tickIntervalMs, 1000);
    this.tickTimer = setInterval(() => {
      if (this.closed) {
        return;
      }
      if (!this.lastTick) {
        return;
      }
      const gap = Date.now() - this.lastTick;
      if (gap > this.tickIntervalMs * 2) {
        console.warn('[OpenClawGateway] Tick timeout, closing connection');
        this.ws?.close(4000, 'tick timeout');
      }
    }, interval);
  }

  private rawDataToString(data: unknown): string {
    if (typeof data === 'string') {
      return data;
    }
    if (Buffer.isBuffer(data)) {
      return data.toString('utf-8');
    }
    if (data instanceof ArrayBuffer) {
      return new TextDecoder().decode(data);
    }
    return String(data);
  }
}

let globalGateway: OpenClawGateway | null = null;

export function getGlobalGateway(): OpenClawGateway | null {
  return globalGateway;
}

export function createGlobalGateway(token: string, url?: string): OpenClawGateway {
  if (globalGateway) {
    globalGateway.stop();
  }
  globalGateway = new OpenClawGateway({
    url: url ?? process.env.OPENCLAW_GATEWAY_URL ?? 'ws://localhost:18789',
    token,
  });
  return globalGateway;
}

export function destroyGlobalGateway(): void {
  if (globalGateway) {
    globalGateway.stop();
    globalGateway = null;
  }
}
