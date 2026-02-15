export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string | unknown[];
  timestamp: number;
}

export interface ChatState {
  messages: ChatMessage[];
  isLoading: boolean;
  sessionKey: string | null;
  error: string | null;
}
