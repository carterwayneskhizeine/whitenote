export const OPENCLAW_PROTOCOL_VERSION = 3 as const;

export interface RequestFrame {
  type: 'req';
  id: string;
  method: string;
  params?: unknown;
}

export interface ResponseFrame {
  type: 'res';
  id: string;
  ok: boolean;
  payload?: unknown;
  error?: ErrorShape;
}

export interface EventFrame {
  type: 'event';
  event: string;
  payload?: unknown;
  seq?: number;
  stateVersion?: StateVersion;
}

export interface ErrorShape {
  code: string;
  message: string;
  details?: unknown;
  retryable?: boolean;
  retryAfterMs?: number;
}

export interface StateVersion {
  snapshot: number;
  presence: number;
}

export interface ConnectParams {
  minProtocol: number;
  maxProtocol: number;
  client: {
    id: string;
    displayName?: string;
    version: string;
    platform: string;
    mode: string;
    instanceId?: string;
  };
  role?: string;
  scopes?: string[];
  auth?: {
    token?: string;
    password?: string;
  };
}

export interface HelloOk {
  type: 'hello-ok';
  protocol: number;
  server: {
    version: string;
    commit?: string;
    host?: string;
    connId: string;
  };
  features: {
    methods: string[];
    events: string[];
  };
  snapshot: Snapshot;
  auth?: {
    deviceToken: string;
    role: string;
    scopes: string[];
  };
  policy: {
    maxPayload: number;
    maxBufferedBytes: number;
    tickIntervalMs: number;
  };
}

export interface Snapshot {
  presence: PresenceEntry[];
  stateVersion: StateVersion;
}

export interface PresenceEntry {
  connId: string;
  clientId: string;
  displayName?: string;
  role: string;
  scopes: string[];
  mode: string;
  caps: string[];
}

export interface ChatSendParams {
  sessionKey: string;
  message: string;
  thinking?: string;
  deliver?: boolean;
  attachments?: unknown[];
  timeoutMs?: number;
  idempotencyKey: string;
}

export interface ChatAbortParams {
  sessionKey: string;
  runId?: string;
}

export interface SessionsResolveParams {
  key?: string;
  sessionId?: string;
  label?: string;
  agentId?: string;
  spawnedBy?: string;
  includeGlobal?: boolean;
  includeUnknown?: boolean;
}

export interface ChatEvent {
  runId: string;
  sessionKey: string;
  seq: number;
  state: 'delta' | 'final' | 'aborted' | 'error';
  message?: unknown;
  errorMessage?: string;
  usage?: unknown;
  stopReason?: string;
}

export interface ChatBroadcastEvent {
  state: 'delta' | 'final' | 'aborted' | 'error';
  runId?: string;
  message?: {
    content?: Array<{ text?: string; type?: string }>;
  };
  errorMessage?: string;
  usage?: unknown;
  stopReason?: string;
}

export interface OpenClawMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: number;
}

export interface ChatStreamResponse {
  type: 'start' | 'content' | 'finish' | 'error';
  runId?: string;
  sessionKey?: string;
  delta?: string;
  content?: string;
  usage?: unknown;
  stopReason?: string;
  error?: string;
}
