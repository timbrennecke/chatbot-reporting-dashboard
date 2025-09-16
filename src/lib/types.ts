// Core API response types based on the exact schemas provided

export interface MessageContent {
  kind: 'text' | 'ui' | 'linkout';
  content?: string;
  ui?: {
    interactive: boolean;
    final: boolean;
    kind: string;
    customUiInstanceId: string;
    namespace: string;
    identifier: string;
    state: Record<string, any>;
    initialState: Record<string, any>;
  };
  url?: string;
  text?: string;
}

export interface Message {
  id: string;
  role: 'assistant' | 'user';
  content: MessageContent[];
  sentAt: string;
}

export interface Conversation {
  id: string;
  title: string;
  createdAt: string;
  lastMessageAt: string;
  messages: Message[];
  threadIds: string[];
}

export interface Thread {
  id: string;
  conversationId: string;
  createdAt: string;
  messages: Message[];
}

export interface ThreadsResponse {
  threads: Array<{
    thread: Thread;
  }>;
}

export interface AttributesMeta {
  success: boolean;
  status: string;
  scheduledFor: string;
}

export interface AttributesResponse {
  meta: AttributesMeta;
}

export interface BulkAttributesRequest {
  threads: Array<{
    threadId: string;
  }>;
}

export interface BulkAttributesResponse {
  results: Array<{
    threadId: {
      threadId: string;
    };
    meta: AttributesMeta;
  }>;
  errors: Array<{
    threadId: {
      threadId: string;
    };
    code: string;
    message: string;
  }>;
}

export interface ThreadsRequest {
  startTimestamp: string;
  endTimestamp: string;
}

// Utility types for analytics
export interface ThreadAnalytics {
  totalThreads: number;
  totalConversations: number;
  totalMessages: number;
  avgMessagesPerThread: number;
  assistantMessagePercent: number;
  userMessagePercent: number;
  namespaceBreakdown: Record<string, number>;
  uiEventCounts: Record<string, number>;
  linkoutCounts: Record<string, number>;
}

export interface ParsedThreadId {
  namespace: string;
  id: string;
  full: string;
}

// Upload file types
export type UploadedData = {
  conversations?: Conversation[];
  threadsResponse?: ThreadsResponse;
  attributesResponses?: AttributesResponse[];
  bulkAttributesResponses?: BulkAttributesResponse[];
};