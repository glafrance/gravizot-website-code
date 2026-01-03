export type ChatRole = 'user' | 'assistant' | 'system';

export interface ChatMessage {
  role: ChatRole;
  content: string;
}

export interface ChatRequest {
  client?: string;                  // store id/name if your backend expects it
  messages: ChatMessage[];
  // add other knobs as needed (temperature, tools, etc.)
}

export interface ChatResponse {
  id?: string;
  message?: ChatMessage;
  // include other fields you return (e.g., usage, tool calls, etc.)
  [key: string]: unknown;
}

export interface VectorStoreItem {
  id: string;
  name: string;
}
export interface VectorStoreSummary {
  ok: boolean;
  stores: VectorStoreItem[];
}

export interface VectorFileItem {
  id: string;
  name: string;
  bytes?: number;
}

export interface UploadResponse {
  fileCount?: number;
  files?: Array<VectorFileItem>;
  ok: boolean;
  totalBytes?: number;
  vectorStoreId?: string;
}

export interface UsageSnapshotResponse {
  client: string;
  ok: boolean;
  usage: UsageSnapshot;
}

export interface UsageSnapshot {
  chats: number;
  fileSearches: number;
  tokensIn: number;
  tokensOut: number;
  totalTokens: number;
}

export interface StoreUsageSnapshot {
  fileCount: number;
  totalSizeMB: number;
  billableSizeMB: number;
  estimatedDailyCost: number;
}

export interface ApiOk {
  ok: boolean;
  [key: string]: unknown;
}
