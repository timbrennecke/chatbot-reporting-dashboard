import { Thread, Conversation } from './types';
import { getEnvironmentSpecificItem, setEnvironmentSpecificItem } from './api';

interface ThreadCacheEntry {
  startTimestamp: string;
  endTimestamp: string;
  threads: Thread[];
  fetchedAt: number;
  expiresAt: number;
}

interface ConversationCacheEntry {
  conversation: Conversation;
  fetchedAt: number;
  expiresAt: number;
}

export class DataCache {
  private static THREAD_CACHE_KEY = 'chatbot-dashboard-thread-cache';
  private static CONVERSATION_CACHE_KEY = 'chatbot-dashboard-conversation-cache';
  private static CACHE_TTL = 30 * 60 * 1000; // 30 minutes
  private static MAX_CACHE_ENTRIES = 10; // Limit memory usage

  // Thread caching methods
  static getThreadCache(): ThreadCacheEntry[] {
    try {
      const cached = getEnvironmentSpecificItem(this.THREAD_CACHE_KEY);
      if (!cached) return [];
      
      const entries: ThreadCacheEntry[] = JSON.parse(cached);
      const now = Date.now();
      
      // Filter out expired entries
      const validEntries = entries.filter(entry => entry.expiresAt > now);
      
      // Save back the cleaned cache if we removed expired entries
      if (validEntries.length !== entries.length) {
        this.saveThreadCache(validEntries);
      }
      
      return validEntries;
    } catch (error) {
      console.error('Failed to load thread cache:', error);
      return [];
    }
  }

  static saveThreadCache(entries: ThreadCacheEntry[]): void {
    try {
      // Limit cache size - keep most recent entries
      const limitedEntries = entries
        .sort((a, b) => b.fetchedAt - a.fetchedAt)
        .slice(0, this.MAX_CACHE_ENTRIES);
      
      setEnvironmentSpecificItem(this.THREAD_CACHE_KEY, JSON.stringify(limitedEntries));
    } catch (error) {
      console.error('Failed to save thread cache:', error);
    }
  }

  static findCachedThreads(startTimestamp: string, endTimestamp: string): Thread[] | null {
    const cache = this.getThreadCache();
    
    // Look for exact match first
    const exactMatch = cache.find(entry => 
      entry.startTimestamp === startTimestamp && 
      entry.endTimestamp === endTimestamp
    );
    
    if (exactMatch) {
      console.log('🎯 Cache hit: Exact match found', exactMatch.threads.length, 'threads');
      return exactMatch.threads;
    }

    // Look for a cached range that contains the requested range
    const containerMatch = cache.find(entry => {
      const entryStart = new Date(entry.startTimestamp).getTime();
      const entryEnd = new Date(entry.endTimestamp).getTime();
      const requestStart = new Date(startTimestamp).getTime();
      const requestEnd = new Date(endTimestamp).getTime();
      
      return entryStart <= requestStart && entryEnd >= requestEnd;
    });

    if (containerMatch) {
      console.log('🎯 Cache hit: Filtering from larger dataset');
      // Filter threads to match the requested time range
      const requestStart = new Date(startTimestamp).getTime();
      const requestEnd = new Date(endTimestamp).getTime();
      
      const filteredThreads = containerMatch.threads.filter(thread => {
        const threadTime = new Date(thread.createdAt).getTime();
        return threadTime >= requestStart && threadTime <= requestEnd;
      });
      
      console.log('✂️ Filtered', filteredThreads.length, 'threads from', containerMatch.threads.length, 'cached threads');
      return filteredThreads;
    }

    console.log('❌ Cache miss: No suitable cached data found');
    return null;
  }

  static cacheThreads(startTimestamp: string, endTimestamp: string, threads: Thread[]): void {
    const now = Date.now();
    const newEntry: ThreadCacheEntry = {
      startTimestamp,
      endTimestamp,
      threads,
      fetchedAt: now,
      expiresAt: now + this.CACHE_TTL
    };

    const cache = this.getThreadCache();
    
    // Remove any existing entry with the same time range
    const filteredCache = cache.filter(entry => 
      !(entry.startTimestamp === startTimestamp && entry.endTimestamp === endTimestamp)
    );
    
    // Add new entry
    filteredCache.push(newEntry);
    
    this.saveThreadCache(filteredCache);
    console.log('💾 Cached thread data:', { startTimestamp, endTimestamp, count: threads.length });
  }

  // Conversation caching methods
  static getConversationCache(): Map<string, ConversationCacheEntry> {
    try {
      const cached = getEnvironmentSpecificItem(this.CONVERSATION_CACHE_KEY);
      if (!cached) return new Map();
      
      const entries: Record<string, ConversationCacheEntry> = JSON.parse(cached);
      const now = Date.now();
      const validEntries = new Map<string, ConversationCacheEntry>();
      
      // Filter out expired entries
      Object.entries(entries).forEach(([id, entry]) => {
        if (entry.expiresAt > now) {
          validEntries.set(id, entry);
        }
      });
      
      // Save back cleaned cache if we removed expired entries
      if (validEntries.size !== Object.keys(entries).length) {
        this.saveConversationCache(validEntries);
      }
      
      return validEntries;
    } catch (error) {
      console.error('Failed to load conversation cache:', error);
      return new Map();
    }
  }

  static saveConversationCache(cache: Map<string, ConversationCacheEntry>): void {
    try {
      // Convert Map to object for JSON storage
      const entries = Object.fromEntries(cache);
      
      // Limit cache size - keep most recent entries
      const sortedEntries = Object.entries(entries)
        .sort(([, a], [, b]) => b.fetchedAt - a.fetchedAt)
        .slice(0, this.MAX_CACHE_ENTRIES * 5); // Allow more conversation cache entries
      
      setEnvironmentSpecificItem(
        this.CONVERSATION_CACHE_KEY, 
        JSON.stringify(Object.fromEntries(sortedEntries))
      );
    } catch (error) {
      console.error('Failed to save conversation cache:', error);
    }
  }

  static getCachedConversation(conversationId: string): Conversation | null {
    const cache = this.getConversationCache();
    const entry = cache.get(conversationId);
    
    if (entry) {
      console.log('🎯 Conversation cache hit:', conversationId);
      return entry.conversation;
    }
    
    return null;
  }

  static cacheConversation(conversation: Conversation): void {
    const now = Date.now();
    const entry: ConversationCacheEntry = {
      conversation,
      fetchedAt: now,
      expiresAt: now + this.CACHE_TTL
    };

    const cache = this.getConversationCache();
    cache.set(conversation.id, entry);
    
    this.saveConversationCache(cache);
    console.log('💾 Cached conversation:', conversation.id);
  }

  // Cache management methods
  static clearExpiredEntries(): void {
    // This is automatically done when loading cache, but can be called explicitly
    this.getThreadCache();
    this.getConversationCache();
  }

  static clearAllCache(): void {
    try {
      setEnvironmentSpecificItem(this.THREAD_CACHE_KEY, '[]');
      setEnvironmentSpecificItem(this.CONVERSATION_CACHE_KEY, '{}');
      console.log('🗑️ Cleared all cache data');
    } catch (error) {
      console.error('Failed to clear cache:', error);
    }
  }

  static getCacheStats(): { threadEntries: number; conversationEntries: number; totalSize: string } {
    const threadCache = this.getThreadCache();
    const conversationCache = this.getConversationCache();
    
    // Rough size calculation (in characters, not exact bytes)
    const threadCacheSize = JSON.stringify(threadCache).length;
    const conversationCacheSize = JSON.stringify(Object.fromEntries(conversationCache)).length;
    const totalSize = threadCacheSize + conversationCacheSize;
    
    return {
      threadEntries: threadCache.length,
      conversationEntries: conversationCache.size,
      totalSize: `${Math.round(totalSize / 1024)}KB`
    };
  }

  // Debug function to check localStorage
  static debugCache(): void {
    console.log('🐛 DEBUG: Cache debugging info');
    console.log('Environment:', localStorage.getItem('chatbot-dashboard-environment') || 'staging');
    
    const threadKey = this.getEnvironmentSpecificKey(this.THREAD_CACHE_KEY);
    const conversationKey = this.getEnvironmentSpecificKey(this.CONVERSATION_CACHE_KEY);
    
    console.log('Thread cache key:', threadKey);
    console.log('Conversation cache key:', conversationKey);
    
    const threadData = localStorage.getItem(threadKey);
    const conversationData = localStorage.getItem(conversationKey);
    
    console.log('Thread cache raw data:', threadData ? `${threadData.length} chars` : 'null');
    console.log('Conversation cache raw data:', conversationData ? `${conversationData.length} chars` : 'null');
    
    if (threadData) {
      try {
        const parsed = JSON.parse(threadData);
        console.log('Parsed thread cache:', parsed.length, 'entries');
      } catch (e) {
        console.error('Failed to parse thread cache:', e);
      }
    }
    
    if (conversationData) {
      try {
        const parsed = JSON.parse(conversationData);
        console.log('Parsed conversation cache:', Object.keys(parsed).length, 'entries');
      } catch (e) {
        console.error('Failed to parse conversation cache:', e);
      }
    }
  }

  private static getEnvironmentSpecificKey(key: string): string {
    const environment = localStorage.getItem('chatbot-dashboard-environment') || 'staging';
    return `${key}-${environment}`;
  }
}
