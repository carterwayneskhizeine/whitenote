// OpenClaw content types
export interface OpenClawTextContent {
  type: 'text';
  text: string;
}

export interface OpenClawThinkingContent {
  type: 'thinking';
  thinking: string;
  thinkingSignature?: string;
}

export interface OpenClawToolCallContent {
  type: 'toolCall';
  id: string;
  name: string;
  arguments: Record<string, unknown>;
}

export interface OpenClawToolResultContent {
  type: 'toolResult';
  id?: string;
  name?: string;
  text: string;
}

export interface OpenClawToolCallArguments {
  command?: string;
  path?: string;
  limit?: number;
  [key: string]: unknown;
}

export type OpenClawContentBlock =
  | OpenClawTextContent
  | OpenClawThinkingContent
  | OpenClawToolCallContent
  | OpenClawToolResultContent;

// Tool result message
export interface OpenClawToolResultMessage {
  id: string;
  role: 'toolResult';
  toolCallId: string;
  toolName: string;
  content: OpenClawTextContent[];
  details: {
    status: string;
    exitCode?: number;
    durationMs?: number;
    aggregated?: string;
    cwd?: string;
    isError?: boolean;
  };
  timestamp: number;
}

// Regular message
export interface OpenClawMessage {
  id: string;
  role: 'user' | 'assistant';
  content: OpenClawContentBlock[] | string;  // Support both formats for backward compatibility
  timestamp: number;
  api?: string;
  provider?: string;
  model?: string;
  usage?: unknown;
  stopReason?: string;
  thinkingBlocks?: { type: 'thinking'; thinking: string; thinkingSignature?: string }[];
}

export type ChatMessage = OpenClawMessage | OpenClawToolResultMessage;

export interface ChatState {
  messages: ChatMessage[];
  isLoading: boolean;
  sessionKey: string | null;
  error: string | null;
}
