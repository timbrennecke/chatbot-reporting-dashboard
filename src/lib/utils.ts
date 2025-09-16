import { ParsedThreadId, ThreadAnalytics, Thread, Message } from './types';

export function parseThreadId(threadId: string): ParsedThreadId {
  const parts = threadId.split('/');
  if (parts.length < 2) {
    return {
      namespace: 'unknown',
      id: threadId,
      full: threadId,
    };
  }
  
  return {
    namespace: parts[0],
    id: parts.slice(1).join('/'),
    full: threadId,
  };
}

export function formatTimestamp(
  timestamp: string, 
  timezone: 'UTC' | 'Europe/Berlin' = 'Europe/Berlin'
): string {
  const date = new Date(timestamp);
  
  if (timezone === 'UTC') {
    return date.toISOString().replace('T', ' ').slice(0, 19) + ' UTC';
  }
  
  return date.toLocaleString('en-GB', {
    timeZone: 'Europe/Berlin',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  }) + ' CET';
}

export function calculateThreadAnalytics(threads: Thread[]): ThreadAnalytics {
  let totalMessages = 0;
  let assistantMessages = 0;
  let userMessages = 0;
  const namespaceBreakdown: Record<string, number> = {};
  const uiEventCounts: Record<string, number> = {};
  const linkoutCounts: Record<string, number> = {};
  const conversationIds = new Set<string>();

  threads.forEach(thread => {
    conversationIds.add(thread.conversationId);
    const parsed = parseThreadId(thread.id);
    namespaceBreakdown[parsed.namespace] = (namespaceBreakdown[parsed.namespace] || 0) + 1;

    thread.messages.forEach(message => {
      // Skip system messages for metrics calculation
      if (message.role !== 'system') {
        totalMessages++;
        if (message.role === 'assistant') {
          assistantMessages++;
        } else if (message.role === 'user') {
          userMessages++;
        }
      }

      message.content.forEach(content => {
        if (content.kind === 'ui' && content.ui) {
          const key = `${content.ui.namespace}/${content.ui.identifier}`;
          uiEventCounts[key] = (uiEventCounts[key] || 0) + 1;
        } else if (content.kind === 'linkout' && content.url) {
          try {
            const domain = new URL(content.url).hostname;
            linkoutCounts[domain] = (linkoutCounts[domain] || 0) + 1;
          } catch {
            linkoutCounts['invalid-url'] = (linkoutCounts['invalid-url'] || 0) + 1;
          }
        }
      });
    });
  });

  const avgMessagesPerThread = threads.length > 0 ? totalMessages / threads.length : 0;
  const assistantMessagePercent = totalMessages > 0 ? (assistantMessages / totalMessages) * 100 : 0;
  const userMessagePercent = totalMessages > 0 ? (userMessages / totalMessages) * 100 : 0;

  return {
    totalThreads: threads.length,
    totalConversations: conversationIds.size,
    totalMessages,
    avgMessagesPerThread,
    assistantMessagePercent,
    userMessagePercent,
    namespaceBreakdown,
    uiEventCounts,
    linkoutCounts,
  };
}

export function validateJsonStructure(data: any, expectedType: string): { valid: boolean; error?: string } {
  try {
    switch (expectedType) {
      case 'conversation':
        if (!data.id || !data.title || !data.createdAt || !Array.isArray(data.messages)) {
          return { valid: false, error: 'Missing required fields: id, title, createdAt, or messages array' };
        }
        break;
      
      case 'threads':
        if (!Array.isArray(data.threads)) {
          return { valid: false, error: 'Missing required field: threads array' };
        }
        break;
      
      case 'attributes':
        if (!data.meta || typeof data.meta.success !== 'boolean') {
          return { valid: false, error: 'Missing required field: meta.success' };
        }
        break;
      
      case 'bulkAttributes':
        if (!Array.isArray(data.results) || !Array.isArray(data.errors)) {
          return { valid: false, error: 'Missing required fields: results and errors arrays' };
        }
        break;
      
      default:
        return { valid: false, error: 'Unknown data type' };
    }
    
    return { valid: true };
  } catch (error) {
    return { valid: false, error: `Validation error: ${error instanceof Error ? error.message : 'Unknown error'}` };
  }
}

export function detectJsonType(data: any): string | null {
  if (data.id && data.title && data.messages) return 'conversation';
  if (data.threads && Array.isArray(data.threads)) return 'threads';
  if (data.meta && typeof data.meta.success === 'boolean') return 'attributes';
  if (data.results && data.errors) return 'bulkAttributes';
  return null;
}

export function debounce<T extends (...args: any[]) => any>(
  func: T,
  wait: number
): (...args: Parameters<T>) => void {
  let timeout: NodeJS.Timeout;
  
  return (...args: Parameters<T>) => {
    clearTimeout(timeout);
    timeout = setTimeout(() => func(...args), wait);
  };
}