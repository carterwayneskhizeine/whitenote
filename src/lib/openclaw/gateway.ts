import { EventEmitter } from 'events';
import WebSocket from 'ws';
import { randomUUID } from 'crypto';
import type {
  ConnectParams,
  EventFrame,
  HelloOk,
  RequestFrame,
  ChatSendParams,
} from './types';
import { OPENCLAW_PROTOCOL_VERSION } from './types';
import {
  loadOrCreateDeviceIdentity,
  buildDeviceAuthPayloadV3,
  publicKeyRawBase64UrlFromPem,
  signDevicePayload,
  type DeviceIdentity,
} from './deviceIdentity';
import { loadDeviceAuthToken, storeDeviceAuthToken, clearDeviceAuthToken } from './deviceAuthStore';

interface PendingRequest {
  resolve: (value: unknown) => void;
  reject: (err: Error) => void;
  timeout: ReturnType<typeof setTimeout> | null;
}

export interface OpenClawGatewayOptions {
  url?: string;
  token: string;
  password?: string;
  clientName?: string;
  clientVersion?: string;
  platform?: string;
  deviceFamily?: string;
  role?: string;
  scopes?: string[];
  caps?: string[];
}

export class OpenClawGateway extends EventEmitter {
  private ws: WebSocket | null = null;
  private opts: OpenClawGatewayOptions;
  private pending = new Map<string, PendingRequest>();
  private backoffMs = 1000;
  private closed = false;
  private lastSeq: number | null = null;
  private connectNonce: string | null = null;
  private connectSent = false;
  private connectTimer: ReturnType<typeof setTimeout> | null = null;
  private lastTick: number | null = null;
  private tickIntervalMs = 30_000;
  private tickTimer: ReturnType<typeof setInterval> | null = null;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;

  private _isConnected = false;
  private _helloOk: HelloOk | null = null;

  private deviceIdentity: DeviceIdentity;

  constructor(opts: OpenClawGatewayOptions) {
    super();
    this.deviceIdentity = loadOrCreateDeviceIdentity();

    this.opts = {
      url: opts.url ?? 'ws://localhost:18789',
      token: opts.token,
      clientName: opts.clientName ?? 'gateway-client',
      clientVersion: opts.clientVersion ?? '1.0.0',
      platform: opts.platform ?? process.platform,
      deviceFamily: opts.deviceFamily,
      role: opts.role ?? 'operator',
      scopes: opts.scopes ?? ['operator.admin', 'operator.read', 'operator.write'],
      caps: opts.caps ?? ['tool-events'],
    };
  }

  start(): void {
    if (this.closed) {
      return;
    }

    const url = this.opts.url!;
    const gatewayUrl = new URL(url);
    this.ws = new WebSocket(url, {
      maxPayload: 25 * 1024 * 1024,
    });

    this.ws.on('open', () => {
      this.beginPreauthHandshake();
    });

    this.ws.on('message', (data) => {
      this.handleMessage(this.rawDataToString(data));
    });

    this.ws.on('close', (code, reason) => {
      const reasonText = this.rawDataToString(reason);
      if (this.ws === null) {
        // already cleaned up
      } else {
        console.log(`[OpenClawGateway] WebSocket closed: ${code} ${reasonText}`);
      }
      this.ws = null;
      this._isConnected = false;
      this.flushPendingErrors(new Error(`Gateway closed (${code}): ${reasonText}`));
      this.scheduleReconnect();
    });

    this.ws.on('error', (err) => {
      console.error('[OpenClawGateway] WebSocket error:', err.message);
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
    this.flushPendingErrors(new Error('Gateway client stopped'));
    this.removeAllListeners();
  }

  async request<T = unknown>(method: string, params?: unknown, opts?: { timeoutMs?: number }): Promise<T> {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      throw new Error('Gateway not connected');
    }

    const id = randomUUID();
    const frame: RequestFrame = { type: 'req', id, method, params };
    const timeoutMs = opts?.timeoutMs ?? 30_000;

    const promise = new Promise<T>((resolve, reject) => {
      const timeout = timeoutMs > 0
        ? setTimeout(() => {
            this.pending.delete(id);
            reject(new Error(`Gateway request timeout for ${method}`));
          }, timeoutMs)
        : null;
      this.pending.set(id, {
        resolve: (value) => resolve(value as T),
        reject,
        timeout,
      });
    });

    this.ws.send(JSON.stringify(frame));
    return promise;
  }

  async sendMessage(sessionKey: string, message: string): Promise<unknown> {
    const params: ChatSendParams = {
      sessionKey,
      message,
      deliver: false,
      idempotencyKey: randomUUID(),
    };
    return this.request('chat.send', params, { timeoutMs: 30_000 });
  }

  async chatAbort(sessionKey: string, runId?: string): Promise<unknown> {
    return this.request('chat.abort', { sessionKey, runId });
  }

  async chatHistory(sessionKey: string, limit?: number): Promise<{
    sessionKey: string;
    sessionId: string;
    messages: unknown[];
  }> {
    return this.request('chat.history', { sessionKey, limit })
  }

  get isConnected(): boolean {
    return this._isConnected;
  }

  waitForConnection(timeoutMs: number = 15_000): Promise<void> {
    if (this._isConnected) return Promise.resolve();
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        this.off('connected', onConnected);
        reject(new Error('Connection timeout'));
      }, timeoutMs);
      const onConnected = () => {
        clearTimeout(timer);
        resolve();
      };
      this.once('connected', onConnected);
    });
  }

  private beginPreauthHandshake(): void {
    if (this.connectSent) {
      return;
    }
    if (this.connectNonce && !this.connectSent) {
      this.armConnectChallengeTimeout();
      this.sendConnect();
      return;
    }
    this.armConnectChallengeTimeout();
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
    const signedAtMs = Date.now();
    const nonce = this.connectNonce ?? '';

    const storedAuth = loadDeviceAuthToken({ deviceId: this.deviceIdentity.deviceId, role });
    const storedToken = storedAuth?.token;
    const authToken = this.opts.token ?? storedToken ?? undefined;

    const hasAuth = authToken || this.opts.password;
    const auth = hasAuth
      ? {
          token: authToken,
          deviceToken: storedToken && authToken === this.opts.token ? storedToken : undefined,
          password: this.opts.password,
        }
      : undefined;

    const platform = this.opts.platform ?? process.platform;

    const device = (() => {
      const payload = buildDeviceAuthPayloadV3({
        deviceId: this.deviceIdentity.deviceId,
        clientId: this.opts.clientName ?? 'gateway-client',
        clientMode: 'backend',
        role,
        scopes,
        signedAtMs,
        token: authToken ?? null,
        nonce,
        platform,
        deviceFamily: this.opts.deviceFamily,
      });
      const signature = signDevicePayload(this.deviceIdentity.privateKeyPem, payload);
      return {
        id: this.deviceIdentity.deviceId,
        publicKey: publicKeyRawBase64UrlFromPem(this.deviceIdentity.publicKeyPem),
        signature,
        signedAt: signedAtMs,
        nonce,
      };
    })();

    const params: ConnectParams = {
      minProtocol: OPENCLAW_PROTOCOL_VERSION,
      maxProtocol: OPENCLAW_PROTOCOL_VERSION,
      client: {
        id: this.opts.clientName ?? 'gateway-client',
        displayName: 'WhiteNote',
        version: this.opts.clientVersion ?? '1.0.0',
        platform,
        deviceFamily: this.opts.deviceFamily,
        mode: 'backend',
      },
      caps: this.opts.caps ?? [],
      role,
      scopes,
      auth,
      device,
    };

    this.request<HelloOk>('connect', params, { timeoutMs: 10_000 })
      .then((helloOk) => {
        const authInfo = helloOk?.auth;
        if (authInfo?.deviceToken) {
          storeDeviceAuthToken({
            deviceId: this.deviceIdentity.deviceId,
            role: authInfo.role ?? role,
            token: authInfo.deviceToken,
            scopes: authInfo.scopes ?? [],
          });
        }

        this._isConnected = true;
        this._helloOk = helloOk;
        this.backoffMs = 1000;
        this.tickIntervalMs = typeof helloOk.policy?.tickIntervalMs === 'number' ? helloOk.policy.tickIntervalMs : 30_000;
        this.lastTick = Date.now();
        this.startTickWatch();
        this.emit('connected');
      })
      .catch((err) => {
        console.error('[OpenClawGateway] Connect failed:', err.message);

        if (storedToken && this.opts.token) {
          clearDeviceAuthToken({
            deviceId: this.deviceIdentity.deviceId,
            role,
          });
        }

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
          if (nonce && nonce.trim().length > 0) {
            this.connectNonce = nonce.trim();
            this.sendConnect();
          }
          return;
        }

        const seq = typeof evt.seq === 'number' ? evt.seq : null;
        if (seq !== null) {
          if (this.lastSeq !== null && seq > this.lastSeq + 1) {
            // gap detected
          }
          this.lastSeq = seq;
        }

        if (evt.event === 'tick') {
          this.lastTick = Date.now();
        }

        this.emit('event', evt);
        return;
      }

      if (parsed.type === 'res') {
        const res = parsed as { id: string; ok: boolean; payload?: unknown; error?: { code?: string; message?: string; details?: unknown; retryable?: boolean; retryAfterMs?: number } };
        const pending = this.pending.get(res.id);
        if (!pending) {
          return;
        }

        this.pending.delete(res.id);
        if (pending.timeout) {
          clearTimeout(pending.timeout);
        }
        if (res.ok) {
          pending.resolve(res.payload);
        } else {
          const err = new Error(res.error?.message ?? 'Unknown error');
          (err as Error & { code?: string }).code = res.error?.code;
          (err as Error & { details?: unknown }).details = res.error?.details;
          pending.reject(err);
        }
      }
    } catch {
      // ignore parse errors
    }
  }

  private armConnectChallengeTimeout(): void {
    if (this.connectTimer) {
      clearTimeout(this.connectTimer);
    }
    this.connectTimer = setTimeout(() => {
      if (this.connectSent || !this.ws || this.ws.readyState !== WebSocket.OPEN) {
        return;
      }
      this.ws.close(1008, 'connect challenge timeout');
    }, 10_000);
  }

  private scheduleReconnect(): void {
    if (this.closed) {
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
      if (p.timeout) {
        clearTimeout(p.timeout);
      }
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
let globalGatewayToken: string | null = null;

export function getGlobalGateway(): OpenClawGateway | null {
  return globalGateway;
}

export function createGlobalGateway(token: string, url?: string, forceRecreate?: boolean): OpenClawGateway {
  if (!forceRecreate && globalGateway && globalGatewayToken === token) {
    return globalGateway;
  }

  if (globalGateway) {
    try {
      globalGateway.stop();
    } catch {
      // Ignore errors when stopping
    }
  }

  globalGatewayToken = token;

  globalGateway = new OpenClawGateway({
    url: url ?? process.env.OPENCLAW_GATEWAY_URL ?? 'ws://localhost:18789',
    token,
    scopes: ['operator.admin', 'operator.read', 'operator.write'],
  });
  return globalGateway;
}

export function destroyGlobalGateway(): void {
  if (globalGateway) {
    globalGateway.stop();
    globalGateway = null;
    globalGatewayToken = null;
  }
}
