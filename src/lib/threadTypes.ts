/**
 * Thread-specific types for the ThreadsOverview component
 */

import type { Thread } from './types';

export interface ThreadsOverviewProps {
  uploadedThreads?: Thread[];
  onThreadSelect?: (thread: Thread) => void;
  onConversationSelect?: (conversationId: string, position?: number) => void;
  onFetchedConversationsChange?: (conversations: Map<string, ConversationData>) => void;
  onThreadOrderChange?: (threadOrder: string[]) => void;
  onConversationViewed?: (conversationId: string) => void;
  onThreadsChange?: (threads: Thread[]) => void;
  savedConversationIds?: Set<string>;
}

export interface ConversationUpload {
  id: string;
  title?: string;
  messages?: MessageUpload[];
  [key: string]: unknown;
}

export interface MessageUpload {
  id: string;
  role: string;
  content?: ContentItem[];
  created_at?: string;
  createdAt?: string;
  sentAt?: string;
  [key: string]: unknown;
}

export interface ContentItem {
  kind?: string;
  text?: string;
  content?: string;
  [key: string]: unknown;
}

export interface ConversationData {
  id: string;
  title?: string;
  messages?: MessageUpload[];
  [key: string]: unknown;
}

export interface ToolWithCount {
  name: string;
  count: number;
}

export interface WorkflowWithCount {
  name: string;
  count: number;
}

export interface ThreadFilters {
  searchTerm: string;
  hasUiFilter: boolean;
  selectedTools: Set<string>;
  selectedWorkflows: Set<string>;
  showErrorsOnly: boolean;
  showTimeoutsOnly: boolean;
  selectedTopic: string;
  messageSearchEnabled: boolean;
  messageSearchTerm: string;
  messageRoles: Set<'user' | 'assistant'>;
  minMessages: number | '';
  maxMessages: number | '';
  minDuration: number | '';
  maxDuration: number | '';
  minResponseTime: number | '';
  maxResponseTime: number | '';
}

export interface LoadingProgress {
  current: number;
  total: number;
  currentDate: string;
}

export interface ChunkStatus {
  chunk: number;
  status: string;
  date: string;
}

export interface BulkResults {
  results: BulkResultItem[];
  errors: BulkErrorItem[];
}

export interface BulkResultItem {
  threadId: {
    threadId: string;
  };
  meta: {
    success: boolean;
    status: string;
    scheduledFor: string;
  };
}

export interface BulkErrorItem {
  threadId: {
    threadId: string;
  };
  code: string;
  message: string;
}

export interface ThreadRowData {
  parsed: {
    namespace: string;
    id: string;
    full: string;
  };
  uiCount: number;
  messageCount: number;
  firstUserMessageText: string;
  conversationDuration: number;
  durationMinutes: number;
  durationSeconds: number;
  responseTimeSeconds: number;
}
